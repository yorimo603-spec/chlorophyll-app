/* ===== الخريطة ===== */
var map = L.map('map', {maxZoom: 19, minZoom: 5}).setView([36.6, 3.0], 6);

var sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19, maxNativeZoom: 17, attribution: 'Tiles © Esri'
}).addTo(map);

map.createPane('labels');
map.getPane('labels').style.zIndex = 650;
map.getPane('labels').style.pointerEvents = 'none';
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
  pane: 'labels', maxZoom: 19, maxNativeZoom: 17
}).addTo(map);

/* إخفاء أزرار الأعماق القديمة */
['bChl', 'bDepth', 'bPal', 'bShade', 'dtools', 'dlegend'].forEach(function (id) {
  var el = document.getElementById(id);
  if (el) el.style.display = 'none';
});

var chlLayer = null;
var data = null;
var bnd = null;
var layersCtl = L.control.layers(null, null, {collapsed: true}).addTo(map);
document.getElementById('info').textContent = 'جاري التحميل...';

function getDepth(latlng) {
  var url = 'https://rest.emodnet-bathymetry.eu/depth_sample?geom=POINT(' + latlng.lng + '%20' + latlng.lat + ')';
  return fetch(url)
    .then(function (r) { return r.json(); })
    .then(function (j) {
      var v = null;
      if (typeof j === 'number') v = j;
      else if (j && typeof j.avg === 'number') v = j.avg;
      else if (j && typeof j.depth === 'number') v = j.depth;
      if (v === null || v >= 0) return '';
      return 'Depth: ' + Math.abs(Math.round(v)) + ' m';
    })
    .catch(function () { return ''; });
}

/* ===== واجهة المستخدم ===== */
function updateUi() {
  var chlOn = chlLayer && map.hasLayer(chlLayer);
  document.getElementById('legend').style.display = chlOn ? 'block' : 'none';
}
map.on('overlayadd', function (e) {
  updateUi();
});
map.on('overlayremove', updateUi);

/* ===== الكلوروفيل ===== */
var STOPS = [
  [0.00, [45, 20, 140]], [0.15, [20, 70, 220]], [0.30, [0, 170, 255]],
  [0.45, [0, 225, 170]], [0.60, [110, 235, 60]], [0.75, [255, 235, 0]],
  [0.88, [255, 110, 0]], [1.00, [200, 0, 40]]
];
var LMIN = Math.log10(0.05), LMAX = Math.log10(1.2); /* أحمر عند 1.2 فأكثر */

function colorAt(t) {
  t = Math.max(0, Math.min(1, t));
  for (var i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      var a0 = STOPS[i - 1], b0 = STOPS[i];
      var u = (t - a0[0]) / (b0[0] - a0[0]);
      return [
        a0[1][0] + (b0[1][0] - a0[1][0]) * u,
        a0[1][1] + (b0[1][1] - a0[1][1]) * u,
        a0[1][2] + (b0[1][2] - a0[1][2]) * u
      ];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

var gp = [];
for (var si = 0; si < STOPS.length; si++) {
  var sc = STOPS[si][1];
  gp.push('rgb(' + sc[0] + ',' + sc[1] + ',' + sc[2] + ') ' + (STOPS[si][0] * 100) + '%');
}
/* تحديث أرقام شريط الألوان */
(function () {
  var all = document.getElementById('legend').getElementsByTagName('*');
  for (var q = 0; q < all.length; q++) {
    if (all[q].children.length === 0) {
      var tx = all[q].textContent.trim();
      if (tx === '5') all[q].textContent = '1.2+';
      else if (tx === '0.5') all[q].textContent = '0.25';
    }
  }
})();
document.getElementById('bar').style.background = 'linear-gradient(to right,' + gp.join(',') + ')';

/* تنعيم الشبكة (يتجاهل الخلايا الفارغة) */
function smoothGrid(src, nx, ny) {
  var out = new Float32Array(nx * ny);
  for (var y = 0; y < ny; y++) {
    for (var x = 0; x < nx; x++) {
      var i = y * nx + x;
      if (src[i] !== src[i]) { out[i] = NaN; continue; }
      var sum = 0, wt = 0;
      for (var dy = -1; dy <= 1; dy++) {
        var yy = y + dy;
        if (yy < 0 || yy >= ny) continue;
        for (var dx = -1; dx <= 1; dx++) {
          var xx = x + dx;
          if (xx < 0 || xx >= nx) continue;
          var v = src[yy * nx + xx];
          if (v !== v) continue;
          var k = (dx === 0 && dy === 0) ? 4 : ((dx === 0 || dy === 0) ? 2 : 1);
          sum += v * k; wt += k;
        }
      }
      out[i] = sum / wt;
    }
  }
  return out;
}

/* ===== النقر على الخريطة ===== */
map.on('click', function (e) {
  var txt = '';
  if (chlLayer && map.hasLayer(chlLayer) && data && bnd) {
    var d = data;
    var ny = d.lats.length, nx = d.lons.length;
    var latAsc = d.lats[0] < d.lats[ny - 1];
    var f = (e.latlng.lat - bnd.minLat) / (bnd.maxLat - bnd.minLat);
    var g2 = (e.latlng.lng - bnd.minLon) / (bnd.maxLon - bnd.minLon);
    txt = 'خارج منطقة بيانات الكلوروفيل';
    if (f >= 0 && f <= 1 && g2 >= 0 && g2 <= 1) {
      var k = Math.round(f * (ny - 1));
      var i2 = latAsc ? k : ny - 1 - k;
      var j2 = Math.round(g2 * (nx - 1));
      var val = d.values[i2][j2];
      txt = (val === null) ? 'لا توجد بيانات كلوروفيل هنا (يابسة أو غيوم)' : 'الكلوروفيل: ' + val + ' ملغ/م³';
    }
  }
  var popup = L.popup({maxWidth: 270}).setLatLng(e.latlng).setContent((txt || '') + (txt ? '<br>' : '') + 'جاري تحميل المعلومات...').openOn(map);
  getDepth(e.latlng).then(function (dep) {
    var parts2 = [];
    if (txt) parts2.push(txt);
    if (dep) parts2.push(dep);
    if (!parts2.length) parts2.push('المعلومات غير متوفرة هنا');
    popup.setContent(parts2.join('<br>'));
  });
});

/* ===== تحميل بيانات الكلوروفيل ===== */
fetch('chl_latest.json?' + Date.now())
  .then(function (r) { return r.json(); })
  .then(function (d) {
    data = d;
    var ny = d.lats.length, nx = d.lons.length;
    var latAsc = d.lats[0] < d.lats[ny - 1];
    var minLat = Math.min.apply(null, d.lats), maxLat = Math.max.apply(null, d.lats);
    var minLon = Math.min.apply(null, d.lons), maxLon = Math.max.apply(null, d.lons);
    bnd = {minLat: minLat, maxLat: maxLat, minLon: minLon, maxLon: maxLon};

    var grid = new Float32Array(nx * ny);
    for (var r = 0; r < ny; r++) {
      var di = latAsc ? ny - 1 - r : r;
      for (var c = 0; c < nx; c++) {
        var v = d.values[di][c];
        grid[r * nx + c] = (v === null || v === undefined || v <= 0) ? NaN : Math.log10(v);
      }
    }

    grid = smoothGrid(smoothGrid(grid, nx, ny), nx, ny);
    var scale = Math.max(2, Math.min(4, Math.floor(3000 / nx)));
    var W = nx * scale, H = ny * scale;
    var big = document.createElement('canvas');
    big.width = W; big.height = H;
    var bctx = big.getContext('2d');
    var img = bctx.createImageData(W, H);

    for (var y = 0; y < H; y++) {
      var fy = (y + 0.5) / scale - 0.5;
      var y0 = Math.floor(fy), ty = fy - y0;
      for (var x = 0; x < W; x++) {
        var fx = (x + 0.5) / scale - 0.5;
        var x0 = Math.floor(fx), tx = fx - x0;
        var sum = 0, wsum = 0;
        for (var dy = 0; dy < 2; dy++) {
          var yy = y0 + dy;
          if (yy < 0 || yy >= ny) continue;
          for (var dx = 0; dx < 2; dx++) {
            var xx = x0 + dx;
            if (xx < 0 || xx >= nx) continue;
            var g = grid[yy * nx + xx];
            if (g !== g) continue;
            var w = (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty);
            sum += g * w; wsum += w;
          }
        }
        if (wsum < 0.5) continue;
        var t = (sum / wsum - LMIN) / (LMAX - LMIN);
        t = Math.max(0, Math.min(0.9999, t));
        var col2 = colorAt(t);
        var p = (y * W + x) * 4;
        img.data[p] = col2[0];
        img.data[p + 1] = col2[1];
        img.data[p + 2] = col2[2];
        img.data[p + 3] = 215;
      }
    }
    bctx.putImageData(img, 0, 0);

    var bounds = [[minLat, minLon], [maxLat, maxLon]];
    chlLayer = L.imageOverlay(big.toDataURL(), bounds, {opacity: 1, zIndex: 400}).addTo(map);
    chlLayer.getElement().style.imageRendering = 'auto';
    layersCtl.addOverlay(chlLayer, 'الكلوروفيل');
    document.getElementById('info').innerHTML = 'الكلوروفيل في سواحل الجزائر<br>تاريخ البيانات: ' + d.date;
    map.fitBounds(bounds);
    updateUi();
  })
  .catch(function () {
    document.getElementById('info').textContent = 'تعذر تحميل بيانات الكلوروفيل';
  });

/* ===== الأعماق + الكنتور + التظليل (EMODnet) ===== */
(function () {
  map.createPane('depthPane');
  map.getPane('depthPane').style.zIndex = 300;
  map.getPane('depthPane').style.pointerEvents = 'none';
  map.createPane('shadePane');
  map.getPane('shadePane').style.zIndex = 310;
  map.getPane('shadePane').style.pointerEvents = 'none';

  var wms = 'https://ows.emodnet-bathymetry.eu/wms';
  function opts(pane, extra) {
    return Object.assign({
      format: 'image/png', transparent: true, version: '1.3.0',
      pane: pane, attribution: '© EMODnet Bathymetry'
    }, extra);
  }

  var depth = L.tileLayer.wms(wms, opts('depthPane', {layers: 'emodnet:mean_multicolour', opacity: 0.6}));
  var cont = L.tileLayer.wms(wms, opts('depthPane', {layers: 'emodnet:contours'}));
  layersCtl.addOverlay(depth, '🌊 Depth');
  layersCtl.addOverlay(cont, '〰️ Contours');
  depth.addTo(map);

  /* التظليل: نبحث عنه تلقائياً في قائمة طبقات الخادم */
  fetch(wms + '?service=WMS&request=GetCapabilities&version=1.3.0')
    .then(function (r) { return r.text(); })
    .then(function (t) {
      var xml = new DOMParser().parseFromString(t, 'text/xml');
      var names = Array.prototype.map.call(xml.getElementsByTagName('Name'), function (n) { return n.textContent; });
      var found = names.filter(function (n) { return /hillshade|shade|relief/i.test(n); })[0];
      console.log('EMODnet layers:', names.join(', '));
      if (found) {
        var shade = L.tileLayer.wms(wms, opts('shadePane', {layers: found, opacity: 0.5}));
        layersCtl.addOverlay(shade, '⛰️ Shading');
        shade.addTo(map);
      } else {
        layersCtl.addOverlay(L.layerGroup([]), '⛰️ Shading (not available)');
      }
    })
    .catch(function () {});

  var levels = [0.92, 0.55, 0.3], idx = 1;
  var eye = L.control({position: 'topleft'});
  eye.onAdd = function () {
    var d = L.DomUtil.create('div', 'leaflet-bar');
    var a = L.DomUtil.create('a', '', d);
    a.href = '#';
    a.title = 'Depth transparency';
    a.innerHTML = '👁️';
    a.style.cssText = 'font-size:18px;line-height:30px;text-align:center;width:30px;height:30px;display:block;background:#fff';
    L.DomEvent.disableClickPropagation(d);
    L.DomEvent.on(a, 'click', function (e) {
      L.DomEvent.preventDefault(e);
      idx = (idx + 1) % levels.length;
      depth.setOpacity(levels[idx]);
    });
    return d;
  };
  eye.addTo(map);
})();
