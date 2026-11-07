/* forecast.js
   طبقتان متحركتان فوق الخريطة: التيارات والأمواج (توقعات 72 ساعة).
   يقرأ forecast_latest.json ولا يعدّل أي ملف آخر في الموقع. */
(function () {
  'use strict';

  var DATA_URL = 'forecast_latest.json';
  var KN = 1.943844;          // م/ث -> عقدة
  var LIFE = 80;              // عمر الجسيم بالإطارات
  var CUR_PX = 3;             // بكسل لكل (م/ث) في الإطار الواحد
  var COMPASS = ['شمال', 'شمال شرق', 'شرق', 'جنوب شرق', 'جنوب', 'جنوب غرب', 'غرب', 'شمال غرب'];

  // ألوان التيارات بالعقدة، وألوان الأمواج بالمتر
  var CUR_STOPS = [[0, '#3b82f6'], [0.3, '#22d3ee'], [0.6, '#4ade80'], [1, '#facc15'], [1.5, '#fb923c'], [2, '#ef4444']];
  var WAV_STOPS = [[0, '#f8fafc'], [1, '#fbcfe8'], [2, '#f472b6'], [3, '#d946ef'], [4, '#a855f7']];

  /* ---------- الألوان ---------- */
  function hex2rgb(h) {
    return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)];
  }
  function makePal(stops) {
    var max = stops[stops.length - 1][0], lut = [];
    for (var i = 0; i < 256; i++) {
      var v = i / 255 * max, k = 1;
      while (k < stops.length - 1 && v > stops[k][0]) k++;
      var a = stops[k - 1], b = stops[k];
      var t = (v - a[0]) / (b[0] - a[0]);
      if (t < 0) t = 0;
      if (t > 1) t = 1;
      var ca = hex2rgb(a[1]), cb = hex2rgb(b[1]);
      lut.push('rgb(' + Math.round(ca[0] + (cb[0] - ca[0]) * t) + ',' +
        Math.round(ca[1] + (cb[1] - ca[1]) * t) + ',' +
        Math.round(ca[2] + (cb[2] - ca[2]) * t) + ')');
    }
    return { lut: lut, max: max, stops: stops };
  }
  function colorOf(pal, v) {
    var i = Math.round(v / pal.max * 255);
    if (i < 0) i = 0;
    if (i > 255) i = 255;
    return pal.lut[i];
  }
  var CUR_PAL = makePal(CUR_STOPS);
  var WAV_PAL = makePal(WAV_STOPS);

  /* ---------- الشبكات والاستيفاء ---------- */
  function makeGrid(layer) {
    var lats = layer.lats, lons = layer.lons;
    var H = lats.length, W = lons.length;
    return {
      H: H, W: W, T: layer.times.length, times: layer.times,
      lat0: lats[0], lon0: lons[0],
      dlat: (lats[H - 1] - lats[0]) / (H - 1),
      dlon: (lons[W - 1] - lons[0]) / (W - 1)
    };
  }
  function flat(arr, g) {
    var out = new Float32Array(g.T * g.H * g.W), n = 0;
    for (var t = 0; t < g.T; t++) {
      for (var y = 0; y < g.H; y++) {
        var row = arr[t][y];
        for (var x = 0; x < g.W; x++) {
          var v = row[x];
          out[n++] = (v === null || v === undefined) ? NaN : v;
        }
      }
    }
    return out;
  }
  function buildCur(layer) {
    var g = makeGrid(layer);
    g.u = flat(layer.u, g);
    g.v = flat(layer.v, g);
    return g;
  }
  function buildWav(layer) {
    var g = makeGrid(layer);
    g.hs = flat(layer.hs, g);
    var dr = flat(layer.dir, g);
    g.wu = new Float32Array(dr.length);
    g.wv = new Float32Array(dr.length);
    for (var i = 0; i < dr.length; i++) {
      // dir = الاتجاه الذي تأتي منه الموجة، فنقلبه إلى اتجاه حركتها
      var d = dr[i] * Math.PI / 180;
      g.wu[i] = -Math.sin(d);
      g.wv[i] = -Math.cos(d);
    }
    return g;
  }
  function bl(g, arr, t, y0, x0, fx, fy) {
    var base = (t * g.H + y0) * g.W + x0;
    var a = arr[base], b = arr[base + 1], c = arr[base + g.W], d = arr[base + g.W + 1];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }
  // استيفاء في المكان والزمن. f = رقم الخطوة الزمنية (عشري). يرجع NaN على اليابسة.
  function sample(g, arr, f, lat, lon) {
    var y = (lat - g.lat0) / g.dlat, x = (lon - g.lon0) / g.dlon;
    if (!(y >= 0 && x >= 0 && y <= g.H - 1 && x <= g.W - 1)) return NaN;
    var y0 = Math.min(Math.floor(y), g.H - 2), x0 = Math.min(Math.floor(x), g.W - 2);
    var fy = y - y0, fx = x - x0;
    if (f < 0) f = 0;
    if (f > g.T - 1) f = g.T - 1;
    var t0 = Math.min(Math.floor(f), g.T - 2);
    if (t0 < 0) t0 = 0;
    var t1 = Math.min(t0 + 1, g.T - 1), w = f - t0;
    var v0 = bl(g, arr, t0, y0, x0, fx, fy);
    if (w <= 0 || t1 === t0) return v0;
    return v0 * (1 - w) + bl(g, arr, t1, y0, x0, fx, fy) * w;
  }

  /* ---------- الحقول (سرعة الحركة على الشاشة واللون) ---------- */
  function curField(g, off) {
    return function (f, lat, lon, o) {
      var ff = f - off;
      var u = sample(g, g.u, ff, lat, lon), v = sample(g, g.v, ff, lat, lon);
      if (u !== u || v !== v) return false;
      o.dx = u * CUR_PX;
      o.dy = v * CUR_PX;
      o.val = Math.sqrt(u * u + v * v) * KN;
      return true;
    };
  }
  function wavField(g, off) {
    return function (f, lat, lon, o) {
      var ff = f - off;
      var u = sample(g, g.wu, ff, lat, lon), v = sample(g, g.wv, ff, lat, lon);
      var h = sample(g, g.hs, ff, lat, lon);
      if (u !== u || v !== v || h !== h) return false;
      var m = Math.sqrt(u * u + v * v);
      if (m < 1e-6) return false;
      var px = 0.7 + 0.55 * h; // سرعة العرض فقط، واللون والاتجاه حقيقيان
      o.dx = u / m * px;
      o.dy = v / m * px;
      o.val = h;
      return true;
    };
  }

  /* ---------- الجسيمات المتحركة ---------- */
  function Flow(map, field, pal, count, lineW, fade, z) {
    this.map = map;
    this.field = field;
    this.pal = pal;
    this.n = count;
    this.lw = lineW;
    this.fade = fade;
    this.on = false;
    this.o = { dx: 0, dy: 0, val: 0 };
    this.lat = new Float32Array(count);
    this.lon = new Float32Array(count);
    this.age = new Float32Array(count);
    this.bounds = null;
    var cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:' + z;
    map.getContainer().appendChild(cv);
    this.cv = cv;
    this.ctx = cv.getContext('2d');
    this.resize();
  }
  Flow.prototype.resize = function () {
    var c = this.map.getContainer();
    this.cv.width = c.clientWidth;
    this.cv.height = c.clientHeight;
  };
  Flow.prototype.clear = function () {
    this.ctx.clearRect(0, 0, this.cv.width, this.cv.height);
  };
  Flow.prototype.reset = function () {
    this.clear();
    for (var i = 0; i < this.n; i++) this.age[i] = LIFE; // تُولَّد في الإطار التالي
  };
  Flow.prototype.spawn = function (i, f) {
    var b = this.bounds, s = b.getSouth(), w = b.getWest();
    var dh = b.getNorth() - s, dw = b.getEast() - w;
    for (var tries = 0; tries < 8; tries++) {
      var lat = s + Math.random() * dh, lon = w + Math.random() * dw;
      if (this.field(f, lat, lon, this.o)) {
        this.lat[i] = lat;
        this.lon[i] = lon;
        this.age[i] = Math.random() * LIFE * 0.6;
        return;
      }
    }
    this.lat[i] = lat;
    this.lon[i] = lon;
    this.age[i] = LIFE - 1; // نعيد المحاولة بعد إطار
  };
  Flow.prototype.frame = function (f, k) {
    var ctx = this.ctx, map = this.map, o = this.o;
    var W = this.cv.width, H = this.cv.height;
    this.bounds = map.getBounds();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,' + this.fade + ')';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = this.lw;
    ctx.lineCap = 'round';
    for (var i = 0; i < this.n; i++) {
      if (this.age[i] >= LIFE) this.spawn(i, f);
      var lat = this.lat[i], lon = this.lon[i];
      if (!this.field(f, lat, lon, o)) { this.age[i] = LIFE; continue; }
      var p = map.latLngToContainerPoint([lat, lon]);
      var nx = p.x + o.dx * k, ny = p.y - o.dy * k;
      if (nx < 0 || ny < 0 || nx > W || ny > H) { this.age[i] = LIFE; continue; }
      ctx.strokeStyle = colorOf(this.pal, o.val);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      var ll = map.containerPointToLatLng([nx, ny]);
      this.lat[i] = ll.lat;
      this.lon[i] = ll.lng;
      this.age[i] += k;
    }
  };

  /* ---------- واجهة التحكم ---------- */
  function compass(deg) {
    return COMPASS[Math.round(deg / 45) % 8];
  }
  function fmtTime(ms) {
    try {
      return new Date(ms).toLocaleString('ar-DZ-u-nu-latn', {
        timeZone: 'Africa/Algiers', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
      });
    } catch (e) {
      return new Date(ms).toISOString().substr(0, 16).replace('T', ' ');
    }
  }
  function gradient(stops) {
    var max = stops[stops.length - 1][0];
    var parts = [];
    for (var i = 0; i < stops.length; i++) parts.push(stops[i][1] + ' ' + (stops[i][0] / max * 100) + '%');
    return 'linear-gradient(to right,' + parts.join(',') + ')';
  }
  function legendHTML(title, stops, labels) {
    var nums = '';
    for (var i = 0; i < labels.length; i++) nums += '<span>' + labels[i] + '</span>';
    return '<div class="ft">' + title + '</div>' +
      '<div class="fbar" style="background:' + gradient(stops) + '"></div>' +
      '<div class="fnums">' + nums + '</div>';
  }
  function buildUI() {
    var st = document.createElement('style');
    st.textContent =
      '#fpanel{left:50%;transform:translateX(-50%);bottom:105px;width:min(92vw,380px);box-sizing:border-box;z-index:1001;font-size:12px;padding:6px 8px}' +
      '#fpanel .frow{display:flex;gap:6px;align-items:center;margin:2px 0}' +
      '#fpanel .frow button{flex:1;padding:6px 4px;font-size:13px}' +
      '#fpanel .ft{text-align:center;font-size:11px;margin-top:3px}' +
      '#fpanel .fbar{height:8px;border-radius:4px;margin:2px 0 1px}' +
      '#fpanel .fnums{display:flex;justify-content:space-between;direction:ltr;font-size:10px}' +
      '#fSlider{flex:1;min-width:0}' +
      '#fTime{min-width:74px;text-align:center;font-size:11px}' +
      '#fread{font-size:12px;line-height:1.5;margin-top:2px}';
    document.head.appendChild(st);
    var p = document.createElement('div');
    p.id = 'fpanel';
    p.className = 'box';
    p.innerHTML =
      '<div class="frow"><button id="fbCur" disabled>🌀 التيارات</button><button id="fbWav" disabled>🌊 الأمواج</button>' +
      '<button id="fbHide" style="flex:0 0 36px;display:none">▾</button></div>' +
      '<div id="fbody" style="display:none">' +
      '<div id="fleg"></div>' +
      '<div class="frow"><button id="fPlay" style="flex:0 0 38px">⏸</button>' +
      '<input id="fSlider" type="range" min="0" max="1" step="0.01" value="0"><span id="fTime">جاري تحميل التوقعات...</span></div>' +
      '<div id="fread"></div></div>';
    document.body.appendChild(p);
    return {
      panel: p,
      bCur: document.getElementById('fbCur'),
      bWav: document.getElementById('fbWav'),
      bHide: document.getElementById('fbHide'),
      body: document.getElementById('fbody'),
      leg: document.getElementById('fleg'),
      play: document.getElementById('fPlay'),
      slider: document.getElementById('fSlider'),
      time: document.getElementById('fTime'),
      read: document.getElementById('fread')
    };
  }

  function start(map, ui, d) {
    var layers = d.layers || {};
    var cur = layers.cur ? buildCur(layers.cur) : null;
    var wav = layers.wav ? buildWav(layers.wav) : null;
    var ref = cur || wav;
    if (!ref) { ui.time.textContent = 'لا توجد بيانات'; return; }

    var base = Date.parse(ref.times[0]);
    var step = ref.T > 1 ? (Date.parse(ref.times[1]) - base) : 10800000;
    function off(g) { return (Date.parse(g.times[0]) - base) / step; }
    var curOff = cur ? off(cur) : 0, wavOff = wav ? off(wav) : 0;
    var nF = ref.T - 1;

    var st = { f: (Date.now() - base) / step, playing: true };
    if (!(st.f >= 0)) st.f = 0;
    if (st.f > nF) st.f = 0;

    var curFlow = cur ? new Flow(map, curField(cur, curOff), CUR_PAL, 2200, 1.6, 0.06, 452) : null;
    var wavFlow = wav ? new Flow(map, wavField(wav, wavOff), WAV_PAL, 1600, 2.4, 0.10, 451) : null;

    ui.slider.max = nF;
    ui.slider.value = st.f;
    var LEG = {
      cur: legendHTML('سرعة التيار (عقدة)', CUR_STOPS, ['0', '0.5', '1', '1.5', '2+']),
      wav: legendHTML('ارتفاع الموج (متر)', WAV_STOPS, ['0', '1', '2', '3', '4+'])
    };
    var HINT = 'اضغط على الخريطة لقراءة القيمة.';
    if (cur) ui.bCur.disabled = false;
    if (wav) ui.bWav.disabled = false;
    st.layer = null;
    st.min = false;

    var lastLabel = '';
    function updateTime() {
      var h = Math.round((base + st.f * step) / 3600000) * 3600000;
      var s = fmtTime(h);
      if (s !== lastLabel) { ui.time.textContent = s; lastLabel = s; }
    }
    updateTime();

    function refresh() {
      ui.body.style.display = (st.layer && !st.min) ? 'block' : 'none';
      ui.bHide.style.display = st.layer ? '' : 'none';
      ui.bHide.textContent = st.min ? '▴' : '▾';
    }
    // طبقة واحدة فقط في كل مرة
    function setLayer(w) {
      var items = [['cur', curFlow, ui.bCur], ['wav', wavFlow, ui.bWav]];
      for (var i = 0; i < items.length; i++) {
        var flow = items[i][1], on = (items[i][0] === w);
        if (!flow) continue;
        if (on && !flow.on) { flow.on = true; flow.reset(); }
        if (!on && flow.on) { flow.on = false; flow.clear(); }
        items[i][2].className = on ? 'on' : '';
      }
      st.layer = w;
      ui.leg.innerHTML = w ? LEG[w] : '';
      ui.read.innerHTML = w ? HINT : '';
      if (w) st.min = false;
      refresh();
    }
    ui.bCur.onclick = function () { setLayer(st.layer === 'cur' ? null : 'cur'); };
    ui.bWav.onclick = function () { setLayer(st.layer === 'wav' ? null : 'wav'); };
    ui.bHide.onclick = function () { st.min = !st.min; refresh(); };
    ui.play.onclick = function () {
      st.playing = !st.playing;
      ui.play.textContent = st.playing ? '⏸' : '▶';
    };
    ui.slider.oninput = function () {
      st.f = parseFloat(ui.slider.value);
      updateTime();
    };
    refresh();

    // اللوحة فوق الخريطة، فنمنع انتقال اللمس إلى الخريطة
    if (window.L && L.DomEvent) {
      L.DomEvent.disableClickPropagation(ui.panel);
      L.DomEvent.disableScrollPropagation(ui.panel);
    }

    function clearAll() {
      if (curFlow) curFlow.clear();
      if (wavFlow) wavFlow.clear();
    }
    map.on('movestart zoomstart move zoom', clearAll);
    map.on('resize', function () {
      if (curFlow) curFlow.resize();
      if (wavFlow) wavFlow.resize();
    });

    // قراءة القيم عند الضغط على الخريطة
    map.on('click', function (e) {
      var parts = [];
      if (cur && curFlow.on) {
        var ff = st.f - curOff;
        var u = sample(cur, cur.u, ff, e.latlng.lat, e.latlng.lng);
        var v = sample(cur, cur.v, ff, e.latlng.lat, e.latlng.lng);
        if (u !== u || v !== v) {
          parts.push('التيار: لا توجد بيانات هنا');
        } else {
          var sp = Math.sqrt(u * u + v * v);
          var to = (Math.atan2(u, v) * 180 / Math.PI + 360) % 360;
          parts.push('🌀 التيار: <b>' + (sp * KN).toFixed(2) + ' عقدة</b> (' + sp.toFixed(2) +
            ' م/ث) نحو ' + compass(to) + ' ' + Math.round(to) + '°');
        }
      }
      if (wav && wavFlow.on) {
        var fw = st.f - wavOff;
        var h = sample(wav, wav.hs, fw, e.latlng.lat, e.latlng.lng);
        var wu = sample(wav, wav.wu, fw, e.latlng.lat, e.latlng.lng);
        var wv = sample(wav, wav.wv, fw, e.latlng.lat, e.latlng.lng);
        if (h !== h || wu !== wu || wv !== wv) {
          parts.push('الموج: لا توجد بيانات هنا');
        } else {
          var from = (Math.atan2(wu, wv) * 180 / Math.PI + 180 + 360) % 360;
          parts.push('🌊 الموج: <b>' + h.toFixed(1) + ' م</b> قادم من ' + compass(from) + ' ' + Math.round(from) + '°');
        }
      }
      ui.read.innerHTML = parts.length ? parts.join('<br>') : 'فعّل التيارات أو الأمواج ثم اضغط على الخريطة.';
    });

    var last = performance.now();
    function loop(now) {
      var k = Math.min((now - last) / 16.667, 3);
      last = now;
      if (st.playing) {
        st.f += 0.012 * k;
        if (st.f > nF) st.f = 0;
        ui.slider.value = st.f;
        updateTime();
      }
      if (curFlow && curFlow.on) curFlow.frame(st.f, k);
      if (wavFlow && wavFlow.on) wavFlow.frame(st.f, k);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  function init(map) {
    var ui = buildUI();
    fetch(DATA_URL + '?v=' + Date.now())
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (d) { start(map, ui, d); })
      .catch(function () { ui.time.textContent = 'تعذّر تحميل التوقعات'; });
  }

  // نلتقط كائن الخريطة عند إنشائه (دون لمس app.js)
  var started = false;
  if (window.L && L.Map && L.Map.addInitHook) {
    L.Map.addInitHook(function () {
      if (started) return;
      started = true;
      var map = this;
      map.whenReady(function () { init(map); });
    });
  }

  window.FC = { makeGrid: makeGrid, flat: flat, sample: sample, buildWav: buildWav, makePal: makePal, colorOf: colorOf };
})();
