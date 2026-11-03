var parts = ['p1.js', 'p2.js', 'p3.js', 'weather.js'];
(function load(i) {
  if (i >= parts.length) return;
  var s = document.createElement('script');
  s.src = parts[i] + '?t=' + Date.now();
  s.onload = function () { load(i + 1); };
  document.head.appendChild(s);
})(0);
