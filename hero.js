// ===== Hero background disabled for performance testing =====
// Everything Three.js-related has been short-circuited. The hero canvas
// is left blank so we can verify whether the background animation was
// the source of the tab-wide performance issue. The DOM hyperspace text
// reveal in main.js is untouched.
(function () {
  console.log('[hero] disabled (perf test)');
  const canvas = document.getElementById('hero-canvas');
  if (canvas) canvas.style.display = 'none';
})();
