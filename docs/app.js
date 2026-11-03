var map = L.map('map', {maxZoom: 19, minZoom: 5}).setView([36.6, 3.0], 6);

L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19, maxNativeZoom: 17, attribution: 'Tiles © Esri'
}).addTo(map);

map.createPane('labels');
map.getPane('labels').style.zIndex = 650;
map.getPane('labels').style.pointerEvents = 'none';
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
  pane: 'labels', maxZoom: 19, maxNativeZoom: 17
}).addTo(map);

/* إخفاء كل أزرار ولوحات الأعماق */
['bChl', 'bDepth', 'bPal', 'bShade', 'dtools', 'dlegend'].forEach(function (id) {
  var el = document.getElementById(id);
  if (el) el.style.display = 'none';
});
document.getElementById('legend').style.display = 'block';

/* ===== الكلوروفيل ===== */
var palette = [
  [30, 40, 160], [20, 110, 240], [0, 200, 255], [0, 230, 150], [120, 235, 60],
  [255, 240, 0], [255, 160, 0], [255, 60, 0], [190, 0, 60]
];
var N = palette.length;
var LMIN = Math.log10(0.05), LMAX = Math.log10(5);

var parts = [];
for (var s = 0; s < N; s++) {
  var cc = palette[s];
  var colr = 'rgb(' + cc[0] + ',' + cc[1] + ',' + cc[2] + ')';
  parts.push(colr + ' ' + (s / N * 100) + '%');
  parts.push(colr + ' ' + ((s + 1) / N * 100) + '%');
}
document.getElementById('bar').style.background = 'linear-gradient(to right,' + parts.join(',') + ')';

var data = null;
var bnd = null;
document.getElementById('info').textContent = 'جاري التحميل...';

map.on('click', function (e) {
  var txt = 'خارج منطقة بيانات الكلوروفيل';
  if (data && bnd) {
    var d = data;
    var ny = d.lats.length, nx = d.lons.length;
    var latAsc = d.lats[0] < d.lats[ny - 1];
    var f = (e.latlng.lat - bnd.minLat) / (bnd.maxLat - bnd.minLat);
    var g2 = (e.latlng.lng - bnd.minLon) / (bnd.maxLon - bnd.minLon);
    if (f >= 0 && f <= 1 && g2 >= 0 && g2 <= 1) {
      var k = Math.round(f * (ny - 1));
      var i2 = latAsc ? k : ny - 1 - k;
      var j2 = Math.round(g2 * (nx - 1));
      var val = d.values[i2][j2];
      txt = (val === null) ? 'لا توجد بيانات كلوروفيل هنا (يابسة أو غيوم)' : 'الكلوروفيل: ' + val + ' ملغ/م³';
    }
  }
  L.popup().setLatLng(e.latlng).setContent(txt).openOn(map);
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

    var scale = Math.max(1, Math.min(4, Math.floor(2400 / nx)));
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
        var col2 = palette[Math.floor(t * N)];
        var p = (y * W + x) * 4;
        img.data[p] = col2[0];
        img.data[p + 1] = col2[1];
        img.data[p + 2] = col2[2];
        img.data[p + 3] = 225;
      }
    }
    bctx.putImageData(img, 0, 0);

    var bounds = [[minLat, minLon], [maxLat, maxLon]];
    L.imageOverlay(big.toDataURL(), bounds, {opacity: 1}).addTo(map);
    document.getElementById('info').innerHTML = 'الكلوروفيل في سواحل الجزائر<br>تاريخ البيانات: ' + d.date;
    map.fitBounds(bounds);
  })
  .catch(function () {
    document.getElementById('info').textContent = 'تعذر تحميل بيانات الكلوروفيل';
  });
