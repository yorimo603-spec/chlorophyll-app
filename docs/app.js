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
