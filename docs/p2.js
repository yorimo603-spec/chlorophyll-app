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


