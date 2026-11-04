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

  /* Shading: look for it automatically */
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
