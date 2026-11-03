/* weather.js - طبقات الطقس (رياح، حرارة، ضغط، أمطار) فوق خريطة الكلوروفيل */
(function () {
  var LAT0 = 32, LAT1 = 42, LON0 = -4, LON1 = 12, STEP = 1;
  var lats = [], lons = [];
  for (var la = LAT1; la >= LAT0; la -= STEP) lats.push(la);
  for (var lo = LON0; lo <= LON1; lo += STEP) lons.push(lo);
  var NY = lats.length, NX = lons.length;
  var data = null, times = [], hour = 0, opacity = 0.75, ready = null;
  var active = [];

  /* ---------- لوحة التحكم (الوقت + الشفافية) ---------- */
  var panel = document.createElement('div');
  panel.style.cssText = 'position:absolute;z-index:1000;top:10px;left:56px;right:64px;padding:6px 10px;' +
    'background:rgba(20,24,32,.9);color:#fff;border-radius:10px;font-size:12px;display:none;direction:rtl';
  panel.innerHTML = '<div id="wxT">...</div>' +
    '<div>الوقت <input id="wxS" type="range" min="0" max="0" value="0" style="width:70%"></div>' +
    '<div>الشفافية <input id="wxO" type="range" min="0.1" max="1" step="0.05" value="0.75" style="width:70%"></div>';
  map.getContainer().appendChild(panel);
  L.DomEvent.disableClickPropagation(panel);
  var slT = document.getElementById('wxS'), slO = document.getElementById('wxO'), lbl = document.getElementById('wxT');

  function updatePanel() {
    panel.style.display = active.length ? 'block' : 'none';
    lbl.textContent = times[hour] ? times[hour].replace('T', ' ') + ' UTC' : 'جاري التحميل...';
  }
  slT.oninput = function () {
    hour = +slT.value;
    updatePanel();
