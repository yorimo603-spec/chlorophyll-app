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
      return 'العمق: ' + Math.abs(Math.round(v)) + ' متر';
    })
    .catch(function () { return ''; });
}


/* ===== الرياح والأمواج (Open-Meteo، مجاني) ===== */
var DIRS = ['الشمال', 'الشمال الشرقي', 'الشرق', 'الجنوب الشرقي', 'الجنوب', 'الجنوب الغربي', 'الغرب', 'الشمال الغربي'];
function dirName(deg) {
  if (typeof deg !== 'number') return '—';
  return DIRS[Math.round(deg / 45) % 8];
}
function num(v, d) {
  return (typeof v === 'number') ? v.toFixed(d) : '—';
}
function getJson(u) {
  return fetch(u).then(function (r) { return r.json(); }).catch(function () { return null; });
}
function getSea(latlng) {
  var la = latlng.lat.toFixed(4), lo = latlng.lng.toFixed(4);
  var mu = 'https://marine-api.open-meteo.com/v1/marine?latitude=' + la + '&longitude=' + lo +
    '&current=wave_height,wave_direction,wave_period&hourly=wave_height&forecast_days=2&timezone=auto';
  var wu = 'https://api.open-meteo.com/v1/forecast?latitude=' + la + '&longitude=' + lo +
    '&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=wind_speed_10m,wind_gusts_10m&wind_speed_unit=kn&forecast_days=2&timezone=auto';
  return Promise.all([getJson(mu), getJson(wu)]).then(function (r) {
    var m = r[0], w = r[1];
    var lines = [];
    var wc = w && w.current, mc = m && m.current;
    if (wc) {
      lines.push('الرياح: ' + num(wc.wind_speed_10m, 0) + ' عقدة (هبات ' + num(wc.wind_gusts_10m, 0) + ') من ' + dirName(wc.wind_direction_10m));
    }
    if (mc && typeof mc.wave_height === 'number') {
      lines.push('الموج: ' + num(mc.wave_height, 1) + ' م، الفترة ' + num(mc.wave_period, 0) + ' ث، من ' + dirName(mc.wave_direction));
    }
    if (wc && w.hourly && w.hourly.time) {
      var times = w.hourly.time, start = 0;
      while (start < times.length && times[start] <= wc.time) start++;
      var fc = [];
      for (var k = 2; k <= 11; k += 3) {
        var i = start + k;
        if (i >= times.length) break;
        var wh = (m && m.hourly && m.hourly.wave_height) ? m.hourly.wave_height[i] : null;
        fc.push(times[i].substr(11, 5) + ' → رياح ' + num(w.hourly.wind_speed_10m[i], 0) + ' عقدة' +
          (typeof wh === 'number' ? '، موج ' + num(wh, 1) + ' م' : ''));
      }
      if (fc.length) lines.push('<b>الساعات القادمة:</b><br>' + fc.join('<br>'));
    }
    return lines.join('<br>');
  });
}

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
  Promise.all([getDepth(e.latlng), getSea(e.latlng)]).then(function (res) {
    var parts2 = [];
    if (txt) parts2.push(txt);
    if (res[0]) parts2.push(res[0]);
    if (res[1]) parts2.push(res[1]);
    if (!parts2.length) parts2.push('المعلومات غير متوفرة هنا');
    popup.setContent(parts2.join('<br>'));
  });
});


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
