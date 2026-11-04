/* ===== الخريطة ===== */
var map = L.map('map', {maxZoom: 19, minZoom: 5}).setView([36.6, 3.0], 6);

var sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19, maxNativeZoom: 17, attribution: 'Tiles © Esri'
}).addTo(map);

/* إخفاء العناصر القديمة من الصفحة */
['modes', 'bChl', 'bDepth', 'bPal', 'bShade', 'dtools', 'dlegend'].forEach(function (id) {
  var el = document.getElementById(id);
  if (el) el.style.display = 'none';
});

/* ===== تنسيق الأزرار والمفتاح (يُضاف من هنا) ===== */
var st = document.createElement('style');
st.textContent =
  '.mbox{position:absolute;z-index:1000;background:rgba(255,255,255,.92);padding:6px;border-radius:10px;box-shadow:0 1px 5px rgba(0,0,0,.4);font-size:12px;color:#111}' +
  '.mbox button{border:0;border-radius:8px;padding:9px 14px;font-size:15px;background:#e5e7eb;color:#111}' +
  '.mbox button.on{background:#0b63d6;color:#fff}' +
  '#mmodes{top:10px;left:50%;transform:translateX(-50%);display:flex;gap:6px}' +
  '#mtools{top:76px;left:50%;transform:translateX(-50%);display:none;gap:6px}' +
  '#mtools button{font-size:13px;padding:7px 10px}' +
  '#mlegend{bottom:20px;right:10px;display:none;padding:8px 12px}' +
  '#mtitle{text-align:center;margin-bottom:4px}' +
  '#mwrap{display:flex;direction:ltr;gap:6px;align-items:stretch}' +
  '#mcol{display:flex;flex-direction:column;width:22px}' +
  '#mlab{position:relative;width:46px}' +
  '#mlab span{position:absolute;left:0;transform:translateY(-50%);white-space:nowrap}';
document.head.appendChild(st);

function addBox(id, html) {
  var d = document.createElement('div');
  d.id = id; d.className = 'mbox'; d.innerHTML = html;
  document.body.appendChild(d);
  return d;
}
addBox('mmodes', '<button id="mChl" class="on">🌊 الكلوروفيل</button><button id="mDepth">📏 Depth</button><button id="mWorld">🌍 World</button>');
addBox('mtools', '<button id="mPal">🎨 Palette</button><button id="mShade">⛰️ Shading</button>');
addBox('mlegend', '<div id="mtitle">Depth (m)</div><div id="mwrap"><div id="mcol"></div><div id="mlab"></div></div>');

document.getElementById('info').textContent = 'جاري التحميل...';

/* ===== ألوان الأعماق ===== */
function hex2rgb(h) {
  return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)];
}
function toHex(n) {
  var x = Math.max(0, Math.min(255, Math.round(n))).toString(16);
  return x.length < 2 ? '0' + x : x;
}
function lerpPal(stops, t) {
  var n = stops.length - 1;
  var x = Math.max(0, Math.min(1, t)) * n;
  var i = Math.min(n - 1, Math.floor(x));
  var u = x - i;
  var a = hex2rgb(stops[i]), b = hex2rgb(stops[i + 1]);
  return '#' + toHex(a[0] + (b[0] - a[0]) * u) + toHex(a[1] + (b[1] - a[1]) * u) + toHex(a[2] + (b[2] - a[2]) * u);
}
var PALETTES = [
  {name: 'Spectrum', stops: ['#d7191c', '#f46d43', '#fdae61', '#fee08b', '#e6f598', '#abdda4', '#66c2a5', '#3288bd', '#5e4fa2'], tail: ['#4a2f80', '#33225f', '#1f1640', '#0e0a24']},
  {name: 'Viridis', stops: ['#fde725', '#5ec962', '#21918c', '#3b528b', '#440154'], tail: ['#2c0b45', '#1f0933', '#150624', '#0b0314']},
  {name: 'Blue', stops: ['#e6f5ff', '#a6d8f5', '#5aa9e0', '#2a6fba', '#123f86'], tail: ['#0c2f6b', '#082254', '#05173d', '#030d26']}
];
var palIdx = 0;
var shadeOn = false;
var curCols = [];

function buildCols() {
  var p = PALETTES[palIdx];
  curCols = [];
  for (var i = 0; i < 20; i++) curCols.push(lerpPal(p.stops, i / 19));
  for (var j = 0; j < 4; j++) curCols.push(p.tail[j]);
}

function buildSld(shade) {
  var e = '';
  e += '<ColorMapEntry color="' + curCols[23] + '" quantity="-2000"/>';
  e += '<ColorMapEntry color="' + curCols[22] + '" quantity="-1000"/>';
  e += '<ColorMapEntry color="' + curCols[21] + '" quantity="-500"/>';
  e += '<ColorMapEntry color="' + curCols[20] + '" quantity="-200"/>';
  for (var j = 19; j >= 0; j--) {
    e += '<ColorMapEntry color="' + curCols[j] + '" quantity="' + (-10 * j) + '"/>';
  }
  e += '<ColorMapEntry color="#000000" opacity="0" quantity="100000"/>';
  var sh = shade ? '<ShadedRelief><ReliefFactor>80</ReliefFactor></ShadedRelief>' : '';
  return '<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld"><NamedLayer><Name>emodnet:mean</Name><UserStyle><FeatureTypeStyle><Rule><RasterSymbolizer><ColorMap type="intervals">' + e + '</ColorMap>' + sh + '</RasterSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>';
}

function buildLegend() {
  var col = document.getElementById('mcol');
  col.innerHTML = '';
  for (var i = 0; i < 24; i++) {
    var d = document.createElement('div');
    d.style.height = (i < 20 ? 9 : 16) + 'px';
    d.style.background = curCols[i];
    col.appendChild(d);
  }
  var lab = document.getElementById('mlab');
  lab.innerHTML = '';
  lab.style.height = (20 * 9 + 4 * 16) + 'px';
  var marks = [[0, '0'], [45, '50'], [90, '100'], [135, '150'], [180, '200'], [196, '500'], [212, '1000'], [236, '2000+']];
  for (var m = 0; m < marks.length; m++) {
    var s = document.createElement('span');
    s.textContent = marks[m][1];
    s.style.top = marks[m][0] + 'px';
    lab.appendChild(s);
  }
}

buildCols();
buildLegend();
document.getElementById('mPal').textContent = '🎨 ' + PALETTES[palIdx].name;

/* ===== طبقات EMODnet ===== */
var WMS = 'https://ows.emodnet-bathymetry.eu/wms';
var depthStyled = L.tileLayer.wms(WMS, {
  layers: 'emodnet:mean', format: 'image/png', transparent: true, opacity: 0.88, maxZoom: 19,
  sld_body: buildSld(false), attribution: 'Bathymetry © EMODnet'
});
var depthRainbow = L.tileLayer.wms(WMS, {
  layers: 'emodnet:mean_rainbowcolour', format: 'image/png', transparent: true, opacity: 0.9, maxZoom: 19, attribution: 'Bathymetry © EMODnet'
});

map.createPane('depth');
map.getPane('depth').style.zIndex = 450;
map.getPane('depth').style.pointerEvents = 'none';
var contours = L.tileLayer.wms(WMS, {
  layers: 'emodnet:contours', format: 'image/png', transparent: true, pane: 'depth', maxZoom: 19, attribution: 'Bathymetry © EMODnet'
});

var gebco = L.tileLayer.wms('https://wms.gebco.net/mapserv?', {
  layers: 'GEBCO_LATEST', format: 'image/png', version: '1.3.0', transparent: true, opacity: 0.9, maxZoom: 19,
  attribution: 'Bathymetry © GEBCO'
});

map.createPane('labels');
map.getPane('labels').style.zIndex = 650;
map.getPane('labels').style.pointerEvents = 'none';
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
  pane: 'labels', maxZoom: 19, maxNativeZoom: 17
}).addTo(map);

var mode = 'chl';
var usingFallback = false;
var gotTile = false;
var errCount = 0;
var chlLayer = null;
var data = null;
var bnd = null;
var chlInfo = 'جاري التحميل...';

function applySld() {
  gotTile = false;
  errCount = 0;
  depthStyled.setParams({sld_body: buildSld(shadeOn)});
}

depthStyled.on('tileload', function () { gotTile = true; });
depthStyled.on('tileerror', function () {
  errCount++;
  if (!gotTile && errCount >= 4) {
    if (shadeOn) {
      shadeOn = false;
      document.getElementById('mShade').className = '';
      applySld();
      document.getElementById('info').innerHTML = 'Shading is not supported by the server<br>It was turned off';
    } else if (!usingFallback) {
      usingFallback = true;
      if (map.hasLayer(depthStyled)) map.removeLayer(depthStyled);
      if (mode === 'depth') depthRainbow.addTo(map);
      document.getElementById('mlegend').style.display = 'none';
      document.getElementById('mtools').style.display = 'none';
      document.getElementById('info').innerHTML = 'Could not colour every 10 m<br>Showing standard EMODnet colours';
    }
  }
});

document.getElementById('mPal').onclick = function () {
  palIdx = (palIdx + 1) % PALETTES.length;
  buildCols();
  buildLegend();
  applySld();
  document.getElementById('mPal').textContent = '🎨 ' + PALETTES[palIdx].name;
};
document.getElementById('mShade').onclick = function () {
  shadeOn = !shadeOn;
  document.getElementById('mShade').className = shadeOn ? 'on' : '';
  applySld();
};

/* ===== تبديل الوضع: كلوروفيل / أعماق ===== */
function setMode(m) {
  mode = m;
  var isChl = (m === 'chl'), isWorld = (m === 'world'), isDepth = (m === 'depth');
  var dl = usingFallback ? depthRainbow : depthStyled;
  if (!isChl && chlLayer && map.hasLayer(chlLayer)) map.removeLayer(chlLayer);
  if (!isDepth) {
    if (map.hasLayer(depthStyled)) map.removeLayer(depthStyled);
    if (map.hasLayer(depthRainbow)) map.removeLayer(depthRainbow);
    if (map.hasLayer(contours)) map.removeLayer(contours);
  }
  if (!isWorld && map.hasLayer(gebco)) map.removeLayer(gebco);
  if (isChl) {
    if (chlLayer && !map.hasLayer(chlLayer)) chlLayer.addTo(map);
  } else if (isDepth) {
    if (!map.hasLayer(dl)) dl.addTo(map);
    if (!map.hasLayer(contours)) contours.addTo(map);
  } else {
    if (!map.hasLayer(gebco)) gebco.addTo(map);
  }
  document.getElementById('legend').style.display = isChl ? 'block' : 'none';
  document.getElementById('mlegend').style.display = (isDepth && !usingFallback) ? 'block' : 'none';
  document.getElementById('mtools').style.display = (isDepth && !usingFallback) ? 'flex' : 'none';
  document.getElementById('info').innerHTML = isChl ? chlInfo : (isWorld ? 'World depth map (GEBCO)<br>Lower detail than EMODnet' : (usingFallback ? 'Depth map (EMODnet colours)' : 'Depth map: one colour per 10 m<br>Source: EMODnet (Europe and Mediterranean)'));
  document.getElementById('mChl').className = isChl ? 'on' : '';
  document.getElementById('mDepth').className = isDepth ? 'on' : '';
  document.getElementById('mWorld').className = isWorld ? 'on' : '';
}
document.getElementById('mChl').onclick = function () { setMode('chl'); };
document.getElementById('mDepth').onclick = function () { setMode('depth'); };
document.getElementById('mWorld').onclick = function () { setMode('world'); };

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

/* ===== العمق عند النقر ===== */
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

/* ===== النقر على الخريطة ===== */
map.on('click', function (e) {
  var txt = '';
  if (mode === 'chl' && data && bnd) {
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
  var popup = L.popup({maxWidth: 270}).setLatLng(e.latlng).setContent(txt || 'Measuring depth...').openOn(map);
  getDepth(e.latlng).then(function (dep) {
    var all = txt;
    if (dep) all = all ? all + '<br>' + dep : dep;
    if (!all) all = 'Depth not available here';
    popup.setContent(all);
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
    chlLayer = L.imageOverlay(big.toDataURL(), bounds, {opacity: 1});
    chlInfo = 'الكلوروفيل في سواحل الجزائر<br>تاريخ البيانات: ' + d.date;
    map.fitBounds(bounds);
    setMode(mode);
  })
  .catch(function () {
    chlInfo = 'تعذر تحميل بيانات الكلوروفيل';
    document.getElementById('info').textContent = chlInfo;
  });
