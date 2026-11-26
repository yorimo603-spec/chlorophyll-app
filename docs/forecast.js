/* forecast.js
   طبقتان متحركتان فوق الخريطة: التيارات والأمواج (توقعات 72 ساعة).
   يقرأ forecast_latest.json ولا يعدّل أي ملف آخر في الموقع. */
(function () {
  'use strict';

  var DATA_URL = 'forecast_latest.json';
  var KN = 1.943844;
  var LIFE = 80;
  var CUR_PX = 3;
  var COMPASS = ['شمال', 'شمال شرق', 'شرق', 'جنوب شرق', 'جنوب', 'جنوب غرب', 'غرب', 'شمال غرب'];

  var CUR_STOPS = [[0, '#3b82f6'], [0.3, '#22d3ee'], [0.6, '#4ade80'], [1, '#facc15'], [1.5, '#fb923c'], [2, '#ef4444']];
  var WAV_STOPS = [[0, '#f8fafc'], [1, '#fbcfe8'], [2, '#f472b6'], [3, '#d946ef'], [4, '#a855f7']];

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
      if (t
