/* A short opening sequence; never blocks navigation or waits for external resources. */
(function () {
  const root = document.documentElement;
  if (root.dataset.design !== "cinematic") return;
  const intro = document.getElementById("cinematicIntro");
  const replay = document.getElementById("introReplay");
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let timer;

  function stop() {
    clearTimeout(timer);
    root.classList.remove("is-intro-playing");
  }

  function play() {
    stop();
    if (motion.matches || !intro) return;
    void intro.offsetWidth;
    root.classList.add("is-intro-playing");
    timer = setTimeout(stop, 1950);
    try { sessionStorage.setItem("arc-intro-seen", "1"); } catch (_) { /* Optional. */ }
  }

  let seen = false;
  try { seen = sessionStorage.getItem("arc-intro-seen") === "1"; } catch (_) { /* Optional. */ }
  if (!seen && !location.hash) play();
  replay?.addEventListener("click", play);
  motion.addEventListener("change", stop);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" || event.key === "Tab") stop();
  });
  window.addEventListener("pagehide", stop);
})();
