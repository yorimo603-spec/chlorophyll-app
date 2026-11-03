var map = L.map('map', {maxZoom: 19, minZoom: 5}).setView([36.6, 3.0], 6);

var sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom: 19, maxNativeZoom: 17, attribution: 'Tiles © Esri'});
var ocean = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', {maxZoom: 19, maxNativeZoom: 10, attribution: 'Tiles © Esri'});
sat.addTo(map);
L.control.layers({'قمر صناعي': sat, 'خريطة البحر': ocean}, null, {collapsed: true}).addTo(map);

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
  {name: 'نافيونيكس', smooth: true, stops: ['#0a5fa8', '#1e86d0', '#4fb3e8', '#8fd0f2', '#c9e9f8'], tail: ['#d9eef9', '#e4f3fa', '#eef8fc', '#f5fbfd']},
  {name: 'طيف', stops: ['#d7191c', '#f46d43', '#fdae61', '#fee08b', '#e6f598', '#abdda4', '#66c2a5', '#3288bd', '#5e4fa2'], tail: ['#4a2f80', '#33225f', '#1f1640', '#0e0a24']},
  {name: 'Viridis', stops: ['#fde725', '#5ec962', '#21918c', '#3b528b', '#440154'], tail: ['#2c0b45', '#1f0933', '#150624', '#0b0314']},
  {name: 'أزرق', stops: ['#e6f5ff', '#a6d8f5', '#5aa9e0', '#2a6fba', '#123f86'], tail: ['#0c2f6b', '#082254', '#05173d', '#030d26']}
];
var palIdx = 0;
var shadeOn = true;
var curCols = [];
var SHALLOW_OP = [0.3, 0.3, 0.3, 0.6];

function buildCols() {
  var p = PALETTES[palIdx];
  curCols = [];
  for (var i = 0; i < 20; i++) curCols.push(lerpPal(p.stops, i / 19));
  for (var j = 0; j < 4; j++) curCols.push(p.tail[j]);
}

function buildSld(shade) {
  var smooth = PALETTES[palIdx].smooth;
  var e = '';
  e += '<ColorMapEntry color="' + curCols[23] + '" quantity="-2000"/>';
  e += '<ColorMapEntry color="' + curCols[22] + '" quantity="-1000"/>';
  e += '<ColorMapEntry color="' + curCols[21] + '" quantity="-500"/>';
  e += '<ColorMapEntry color="' + curCols[20] + '" quantity="-200"/>';
  for (var j = 19; j >= 0; j--) {
    var op = (smooth && j < 4) ? SHALLOW_OP[j] : 1;
    e += '<ColorMapEntry color="' + curCols[j] + '" opacity="' + op + '" quantity="' + (-10 * j) + '"/>';
  }
  e += '<ColorMapEntry color="#000000" opacity="0" quantity="' + (smooth ? 1 : 100000) + '"/>';
  var sh = shade ? '<ShadedRelief><ReliefFactor>20</ReliefFactor></ShadedRelief>' : '';
  return '<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld"><NamedLayer><Name>emodnet:mean</Name><UserStyle><FeatureTypeStyle><Rule><RasterSymbolizer><ColorMap type="' + (smooth ? 'ramp' : 'intervals') + '">' + e + '</ColorMap>' + sh + '</RasterSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>';
}

function buildLegend() {
  var col = document.getElementById('dcol');
  col.innerHTML = '';
  for (var i = 0; i < 24; i++) {
    var d = document.createElement('div');
    d.style.height = (i < 20 ? 9 : 16) + 'px';
    d.style.background = curCols[i];
    col.appendChild(d);
  }
  var lab = document.getElementById('dlab');
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
document.getElementById('bPal').textContent = '🎨 ' + PALETTES[palIdx].name;

/* ===== طبقات EMODnet ===== */
var WMS = 'https://ows.emodnet-bathymetry.eu/wms';
var depthStyled = L.tileLayer.wms(WMS, {
  layers: 'emodnet:mean', format: 'image/png', transparent: true, opacity: 0.92, maxZoom: 19, maxNativeZoom: 10,
  sld_body: buildSld(shadeOn), attribution: 'Bathymetry © EMODnet'
});
var depthRainbow = L.tileLayer.wms(WMS, {
  layers: 'emodnet:mean_rainbowcolour', format: 'image/png', transparent: true, opacity: 0.9, maxZoom: 19, maxNativeZoom: 10, attribution: 'Bathymetry © EMODnet'
});

map.createPane('depth');
map.getPane('depth').style.zIndex = 450;
map.getPane('depth').style.pointerEvents = 'none';
var contours = L.tileLayer.wms(WMS, {
  layers: 'emodnet:contours', format: 'image/png', transparent: true, pane: 'depth', maxZoom: 19, attribution: 'Bathymetry © EMODnet'
});
contours.addTo(map);

map.createPane('labels');
map.getPane('labels').style.zIndex = 650;
map.getPane('labels').style.pointerEvents = 'none';
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {pane: 'labels', maxZoom: 19, maxNativeZoom: 17}).addTo(map);

var mode = 'chl';
var usingFallback = false;
var gotTile = false;
var errCount = 0;

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
      document.getElementById('bShade').className = '';
      applySld();
      document.getElementById('info').innerHTML = 'التضليل غير مدعوم من الخادم<br>تم إيقافه';
    } else if (!usingFallback) {
      usingFallback = true;
      if (map.hasLayer(depthStyled)) map.removeLayer(depthStyled);
      if (mode === 'depth') depthRainbow.addTo(map);
      document.getElementById('dlegend').style.display = 'none';
      document.getElementById('info').innerHTML = 'تعذر التلوين كل 10 متر<br>تم عرض ألوان EMODnet العادية';
    }
  }
});

document.getElementById('bPal').onclick = function () {
  palIdx = (palIdx + 1) % PALETTES.length;
  buildCols();
  buildLegend();
  applySld();
  document.getElementById('bPal').textContent = '🎨 ' + PALETTES[palIdx].name;
};
document.getElementById('bShade').onclick = function () {
  shadeOn = !shadeOn;
  document.getElementById('bShade').className = shadeOn ? 'on' : '';
  applySld();
};

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

var chlLayer = null;
var data = null;
var bnd = null;
var chlInfo = 'جاري التحميل...';

function setMode(m) {
  mode = m;
  var isChl = (m === 'chl');
  var dl = usingFallback ? depthRainbow : depthStyled;
  if (isChl) {
    if (map.hasLayer(depthStyled)) map.removeLayer(depthStyled);
    if (map.hasLayer(depthRainbow)) map.removeLayer(depthRainbow);
    if (chlLayer && !map.hasLayer(chlLayer)) chlLayer.addTo(map);
  } else {
    if (chlLayer && map.hasLayer(chlLayer)) map.removeLayer(chlLayer);
    if (!map.hasLayer(dl)) dl.addTo(map);
  }
  document.getElementById('legend').style.display = isChl ? 'block' : 'none';
  document.getElementById('dlegend').style.display = (!isChl && !usingFallback) ? 'block' : 'none';
  document.getElementById('dtools').style.display = (!isChl && !usingFallback) ? 'flex' : 'none';
  document.getElementById('info').innerHTML = isChl ? chlInfo : (usingFallback ? 'خريطة الأعماق (ألوان EMODnet)' : 'خريطة الأعماق<br>المصدر: EMODnet');
  document.getElementById('bChl').className = isChl ? 'on' : '';
  document.getElementById('bDepth').className = isChl ? '' : 'on';
}
document.getElementById('bChl').onclick = function () { setMode('chl'); };
document.getElementById('bDepth').onclick = function () { setMode('depth'); };

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

map.on('click', function (e) {
  var chlTxt = '';
  if (mode === 'chl' && data && bnd) {
    var d = data;
    var ny = d.lats.length, nx = d.lons.length;
    var latAsc = d.lats[0] < d.lats[ny - 1];
    var f = (e.latlng.lat - bnd.minLat) / (bnd.maxLat - bnd.minLat);
    var g2 = (e.latlng.lng - bnd.minLon) / (bnd.maxLon - bnd.minLon);
    chlTxt = 'خارج منطقة بيانات الكلوروفيل';
    if (f >= 0 && f <= 1 && g2 >= 0 && g2 <= 1) {
      var k = Math.round(f * (ny - 1));
      var i2 = latAsc ? k : ny - 1 - k;
      var j2 = Math.round(g2 * (nx - 1));
      var val = d.values[i2][j2];
      chlTxt = (val === null) ? 'لا توجد بيانات كلوروفيل هنا (يابسة أو غيوم)' : 'الكلوروفيل: ' + val + ' ملغ/م³';
    }
  }
  var popup = L.popup().setLatLng(e.latlng).setContent(chlTxt || 'جاري قياس العمق...').openOn(map);
  getDepth(e.latlng).then(function (dtxt) {
    var all = chlTxt;
    if (dtxt) all = all ? all + '<br>' + dtxt : dtxt;
    if (!all) all = 'العمق غير متوفر هنا';
    popup.setContent(all);
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
    chlLayer = L.imageOverlay(big.toDataURL(), bounds, {opacity: 1});
    chlInfo = 'الكلوروفيل في سواحل الجزائر<br>تاريخ البيانات: ' + d.date;
    map.fitBounds(bounds);
    setMode(mode);
  })
  .catch(function () {
    chlInfo = 'تعذر تحميل بيانات الكلوروفيل';
    document.getElementById('info').textContent = chlInfo;
  });
/* === لوحات ألوان جديدة === */
PALETTES.unshift(
  {name: 'كلاسيكي', smooth: true,
   stops: ['#bff0f5', '#7fd6ec', '#3fb0e0', '#1f86c8', '#14559e'],
   tail: ['#0f3f85', '#0b2f6b', '#08224f', '#051634']},
  {name: 'فيروزي', smooth: true,
   stops: ['#d9f7ef', '#8fe3d0', '#3fc3c4', '#2490c4', '#2a4fa0'],
   tail: ['#243f8a', '#1b2e6c', '#131f4c', '#0b1230']}
);
palIdx = 0;
buildCols();
buildLegend();
document.getElementById('bPal').textContent = '🎨 ' + PALETTES[palIdx].name;
applySld();
/* === أزرار: شفافية الأعماق + الكنتور === */
sat.getContainer().style.filter = 'contrast(1.15) saturate(1.1)';
var dt = document.getElementById('dtools');
dt.style.width = 'max-content';
dt.style.maxWidth = '94vw';
dt.style.flexWrap = 'wrap';
dt.style.justifyContent = 'center';

var OPS = [0.92, 0.55, 0.3, 0];
var opIdx = 0;
var bOp = document.createElement('button');
bOp.id = 'bOp';
bOp.textContent = '👁️ 92%';
dt.appendChild(bOp);
bOp.onclick = function () {
  opIdx = (opIdx + 1) % OPS.length;
  depthStyled.setOpacity(OPS[opIdx]);
  bOp.textContent = '👁️ ' + Math.round(OPS[opIdx] * 100) + '%';
};

var bCont = document.createElement('button');
bCont.id = 'bCont';
bCont.textContent = '〰️ كنتور';
bCont.className = 'on';
dt.appendChild(bCont);
bCont.onclick = function () {
  if (map.hasLayer(contours)) {
    map.removeLayer(contours);
    bCont.className = '';
  } else {
    contours.addTo(map);
    bCont.className = 'on';
  }
};
/* === لون كل 40 متر === */
var STEP = 40;

function buildSld(shade) {
  var smooth = PALETTES[palIdx].smooth;
  var e = '';
  e += '<ColorMapEntry color="' + curCols[23] + '" quantity="-3000"/>';
  e += '<ColorMapEntry color="' + curCols[22] + '" quantity="-2000"/>';
  e += '<ColorMapEntry color="' + curCols[21] + '" quantity="-1500"/>';
  e += '<ColorMapEntry color="' + curCols[20] + '" quantity="-1000"/>';
  for (var j = 19; j >= 0; j--) {
    var op = (smooth && j < 4) ? SHALLOW_OP[j] : 1;
    e += '<ColorMapEntry color="' + curCols[j] + '" opacity="' + op + '" quantity="' + (-STEP * j) + '"/>';
  }
  e += '<ColorMapEntry color="#000000" opacity="0" quantity="' + (smooth ? 1 : 100000) + '"/>';
  var sh = shade ? '<ShadedRelief><ReliefFactor>20</ReliefFactor></ShadedRelief>' : '';
  return '<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld"><NamedLayer><Name>emodnet:mean</Name><UserStyle><FeatureTypeStyle><Rule><RasterSymbolizer><ColorMap type="intervals">' + e + '</ColorMap>' + sh + '</RasterSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>';
}

function buildLegend() {
  var col = document.getElementById('dcol');
  col.innerHTML = '';
  for (var i = 0; i < 24; i++) {
    var d = document.createElement('div');
    d.style.height = (i < 20 ? 9 : 16) + 'px';
    d.style.background = curCols[i];
    col.appendChild(d);
  }
  var lab = document.getElementById('dlab');
  lab.innerHTML = '';
  lab.style.height = (20 * 9 + 4 * 16) + 'px';
  var marks = [[0, '0'], [45, '200'], [90, '400'], [135, '600'], [180, '800'], [196, '1000'], [212, '1500'], [236, '2000+']];
  for (var m = 0; m < marks.length; m++) {
    var s = document.createElement('span');
    s.textContent = marks[m][1];
    s.style.top = marks[m][0] + 'px';
    lab.appendChild(s);
  }
}

buildLegend();
applySld();
