/* temp.js - حرارة سطح البحر + الفواصل الحرارية
   يقرأ طبقة tem من forecast_latest.json ويستعمل دوال forecast.js (FC) */
(function () {
  'use strict';
  if (!(window.L && L.Map && L.Map.addInitHook)) return;

  var DATA_URL = 'forecast_latest.json';
  var T0 = 14, SPAN = 12, PX = 4;
  var STOPS = [[0, '#5b21b6'], [2, '#2563eb'], [4, '#06b6d4'], [6, '#22c55e'], [8, '#eab308'], [10, '#f97316'], [12, '#dc2626']];
  var map = null, ui = null, cv = null, ctx = null, g = null, pal = null;
  var base = 0, step = 10800000;
  var on = false, fronts = false, loading = false, raf = 0;
  var st = { f: 0 };

  function fmtTime(ms) {
    try {
      return new Date(ms).toLocaleString('ar-DZ-u-nu-latn', {
        timeZone: 'Africa/Algiers', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
      });
    } catch (e) {
      return new Date(ms).toISOString().substr(0, 16).replace('T', ' ');
    }
  }
  function gradientCss() {
    var parts = [];
    for (var i = 0; i < STOPS.length; i++) parts.push(STOPS[i][1] + ' ' + (STOPS[i][0] / SPAN * 100) + '%');
    return 'linear-gradient(to right,' + parts.join(',') + ')';
  }
  function buildUI() {
    var p = document.createElement('div');
    p.id = 'tpanel';
    p.className = 'box';
    p.style.cssText = 'display:none;left:50%;transform:translateX(-50%);bottom:88px;width:min(94vw,400px);box-sizing:border-box;z-index:1001;font-size:12px;padding:6px 8px';
    p.innerHTML =
      '<div style="text-align:center;font-size:11px">حرارة سطح البحر (°م)</div>' +
      '<div style="height:8px;border-radius:4px;margin:3px 0 1px;background:' + gradientCss() + '"></div>' +
      '<div style="display:flex;justify-content:space-between;direction:ltr;font-size:10px"><span>14</span><span>17</span><span>20</span><span>23</span><span>26</span></div>' +
      '<div style="display:flex;gap:6px;align-items:center;margin:4px 0">' +
      '<input id="tSlider" type="range" min="0" max="1" step="0.05" value="0" style="flex:1;min-width:0">' +
      '<span id="tTime" style="min-width:74px;text-align:center;font-size:11px">...</span></div>' +
      '<div style="display:flex;gap:6px"><button id="tFront" style="flex:1;padding:6px 4px;font-size:13px">〰️ الفواصل الحرارية</button></div>' +
      '<div id="tRead" style="font-size:12px;line-height:1.5;margin-top:3px">جاري تحميل بيانات الحرارة...</div>';
    document.body.appendChild(p);
    return {
      panel: p,
      slider: document.getElementById('tSlider'),
      time: document.getElementById('tTime'),
      front: document.getElementById('tFront'),
      read: document.getElementById('tRead')
    };
  }
  function resize() {
    var c = map.getContainer();
    cv.width = c.clientWidth;
    cv.height = c.clientHeight;
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function sst(lat, lon) { return FC.sample(g, g.sst, st.f, lat, lon); }

  function draw() {
    if (!on || !g) return;
    var W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    var dl = 0.06;
    for (var y = 0; y < H; y += PX) {
      for (var x = 0; x < W; x += PX) {
        var ll = map.containerPointToLatLng([x + PX / 2, y + PX / 2]);
        var v = sst(ll.lat, ll.lng);
        if (v !== v) continue;
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = FC.colorOf(pal, clamp(v - T0, 0, SPAN));
        ctx.fillRect(x, y, PX, PX);
        if (fronts) {
          var a = sst(ll.lat + dl, ll.lng), b = sst(ll.lat - dl, ll.lng);
          var c = sst(ll.lat, ll.lng + dl), d = sst(ll.lat, ll.lng - dl);
          if (a === a && b === b && c === c && d === d) {
            var k = Math.cos(ll.lat * Math.PI / 180);
            var gx = (c - d) / (2 * dl * k * 111), gy = (a - b) / (2 * dl * 111);
            var gm = Math.sqrt(gx * gx + gy * gy);
            var s = (gm - 0.03) / 0.07;
            if (s > 0) {
              ctx.globalAlpha = Math.min(s, 1) * 0.9;
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(x, y, PX, PX);
            }
          }
        }
      }
    }
    ctx.globalAlpha = 1;
  }
  function sched() {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = 0; draw(); });
  }
  function updateTime() {
    var h = Math.round((base + st.f * step) / 3600000) * 3600000;
    ui.time.textContent = fmtTime(h);
  }
  function load() {
    if (loading) return;
    loading = true;
    ui.read.textContent = 'جاري تحميل بيانات الحرارة...';
    fetch(DATA_URL)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (d) {
        var layer = d.layers && d.layers.tem;
        if (!layer || !layer.sst) {
          ui.read.textContent = 'لا توجد بيانات حرارة في آخر تحديث.';
          loading = false;
          return;
        }
        g = FC.makeGrid(layer);
        g.sst = FC.flat(layer.sst, g);
        pal = FC.makePal(STOPS);
        base = Date.parse(layer.times[0]);
        step = layer.times.length > 1 ? (Date.parse(layer.times[1]) - base) : 10800000;
        var f = (Date.now() - base) / step;
        st.f = clamp(isNaN(f) ? 0 : f, 0, g.T - 1);
        ui.slider.max = g.T - 1;
        ui.slider.value = st.f;
        updateTime();
        ui.read.textContent = 'اضغط على الخريطة لقراءة الحرارة.';
        loading = false;
        sched();
      })
      .catch(function () {
        ui.read.textContent = 'تعذّر تحميل بيانات الحرارة.';
        loading = false;
      });
  }
  function turnOn() {
    on = true;
    ui.panel.style.display = 'block';
    if (g) { sched(); } else { load(); }
  }
  function turnOff() {
    on = false;
    ui.panel.style.display = 'none';
    ctx.clearRect(0, 0, cv.width, cv.height);
  }

  function init(m) {
    map = m;
    cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:450';
    map.getContainer().appendChild(cv);
    ctx = cv.getContext('2d');
    resize();
    ui = buildUI();
    if (L.DomEvent) {
      L.DomEvent.disableClickPropagation(ui.panel);
      L.DomEvent.disableScrollPropagation(ui.panel);
    }
    ui.slider.oninput = function () {
      st.f = parseFloat(ui.slider.value);
      updateTime();
      sched();
    };
    ui.front.onclick = function () {
      fronts = !fronts;
      ui.front.className = fronts ? 'on' : '';
      sched();
    };
    map.on('movestart zoomstart', function () { if (on) ctx.clearRect(0, 0, cv.width, cv.height); });
    map.on('moveend zoomend', function () { if (on) sched(); });
    map.on('resize', function () { resize(); if (on) sched(); });
    map.on('click', function (e) {
      if (!on || !g) return;
      var v = sst(e.latlng.lat, e.latlng.lng);
      ui.read.innerHTML = (v !== v) ? 'لا توجد بيانات هنا (يابسة)' :
        '🌡️ حرارة سطح البحر: <b>' + v.toFixed(1) + ' °م</b>';
    });
  }

  window.TEMP = {
    toggle: function () { if (on) { turnOff(); } else { turnOn(); } },
    off: function () { if (on) turnOff(); },
    isOn: function () { return on; }
  };

  var started = false;
  L.Map.addInitHook(function () {
    if (started) return;
    started = true;
    var m = this;
    m.whenReady(function () { init(m); });
  });
})();
