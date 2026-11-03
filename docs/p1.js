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


