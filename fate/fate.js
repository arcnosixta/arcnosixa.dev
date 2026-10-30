(() => {
  "use strict";
  const root = document.documentElement;
  const stage = document.getElementById("stage");
  const canvas = document.getElementById("fate-canvas");
  const stillToggle = document.querySelector(".still-toggle");
  const story = document.getElementById("written-story");
  const revelation = document.querySelector(".revelation");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const chapters = [
    { at: 0, name: "Silence" }, { at: .105, name: "The cut" },
    { at: .30, name: "The child" }, { at: .425, name: "The thousand hands" },
    { at: .715, name: "Ascension" }, { at: .875, name: "The beginning" }
  ];
  let manualStill = false;
  try { manualStill = localStorage.getItem("fate-still") === "1"; } catch { /* optional */ }
  let scene, timeline, intro, raf = 0, lastFrame = 0, version = 0, unavailable = false;
  let activeChapter = -1, pageVisible = !document.hidden, starting = false;
  let state = { progress: 0 };
  const scripts = new Map();
  const assetVersion = new URL(document.currentScript.src).search;
  const sizeObserver = new ResizeObserver(() => scene?.resize());
  sizeObserver.observe(stage);
  function script(src) {
    if (!scripts.has(src)) scripts.set(src, new Promise((resolve, reject) => {
      const node = document.createElement("script");
      node.src = src;
      node.onload = resolve;
      node.onerror = () => { scripts.delete(src); node.remove(); reject(new Error("Scene module unavailable")); };
      document.head.append(node);
    }));
    return scripts.get(src);
  }
  function stopFrames() { cancelAnimationFrame(raf); raf = 0; lastFrame = 0; }
  function frame(now) {
    raf = 0;
    if (!pageVisible || !scene) return;
    const delta = lastFrame ? (now - lastFrame) / 1000 : 1 / 60;
    lastFrame = now;
    try { scene.render(state.progress, delta); }
    catch { fallback(true); return; }
    // The final black frame is static. Scrubbing backward wakes rendering again.
    if (state.progress < .88) raf = requestAnimationFrame(frame);
  }
  function wake() { if (scene && pageVisible && !raf) raf = requestAnimationFrame(frame); }
  function updateUI() {
    const p = state.progress;
    document.querySelector(".story-progress span").style.transform = `scaleX(${p})`;
    let chapter = 0;
    chapters.forEach((item, i) => { if (p >= item.at) chapter = i; });
    if (activeChapter !== chapter) {
      activeChapter = chapter;
      document.querySelector(".chapter-number").textContent = String(chapter + 1).padStart(2, "0");
      document.querySelector(".chapter-name").textContent = chapters[chapter].name;
      stage.dataset.chapter = String(chapter + 1);
    }
    const revealed = p > .925;
    revelation.inert = !revealed;
    revelation.setAttribute("aria-hidden", String(!revealed));
    wake();
  }
  function makeTimeline() {
    const gsap = window.gsap;
    gsap.registerPlugin(window.ScrollTrigger);
    gsap.set(".caption", { autoAlpha: 0, y: 0 });
    gsap.set(".silence", { autoAlpha: .7 });
    gsap.set(".revelation, .scroll-invitation, .chapter-marker", { autoAlpha: 0 });
    gsap.set(".whiteout", { opacity: 0 });
    timeline = gsap.timeline({
      defaults: { ease: "none" }, onUpdate: updateUI,
      scrollTrigger: {
        id: "fate-story", trigger: "#experience", pin: stage,
        start: "top top", end: () => `+=${Math.round(stage.clientHeight * 9.5)}`,
        scrub: .85, anticipatePin: 1, invalidateOnRefresh: true
      }
    });
    chapters.forEach((c) => timeline.addLabel(c.name, c.at * 100));
    timeline.to(state, { progress: 1, duration: 100 }, 0);
    timeline.to(".silence", { autoAlpha: 0, duration: 3.5 }, 6);
    timeline.to(".scroll-invitation", { autoAlpha: 0, duration: 3 }, 3.5);
    timeline.to(".chapter-marker", { autoAlpha: 1, duration: 4 }, 7);
    function line(selector, enter, leave, duration = 2.3) {
      timeline.fromTo(selector, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration, immediateRender: false }, enter);
      timeline.to(selector, { autoAlpha: 0, y: -10, duration: 1.8 }, leave);
    }
    line(".cut", 21.2, 24.2);
    line(".depths", 31.7, 35.3);
    line(".born", 37, 40.8);
    line(".first-hand", 44.2, 47.5);
    line(".another-hand", 49, 52.2);
    line(".thousand", 60.8, 65.4, 3);
    line(".divine", 73.2, 77.3);
    line(".written", 78.9, 81.6);
    timeline.to(".whiteout", { opacity: .3, duration: .7 }, 28);
    timeline.to(".whiteout", { opacity: 0, duration: 1.4 }, 28.7);
    timeline.to(".whiteout", { opacity: 1, duration: 1 }, 82.9);
    timeline.to(".whiteout", { opacity: 0, duration: 2.3 }, 84.1);
    timeline.to(".revelation", { autoAlpha: 1, duration: 4.5 }, 89);
    timeline.fromTo(".revelation .reveal-name, .revelation .reveal-will", { y: 12 }, { y: 0, duration: 5, immediateRender: false }, 89);
    intro = gsap.timeline();
    intro.fromTo(".captions", { opacity: 0 }, { opacity: 1, duration: 2.8 }, .4);
    // Only the invitation's entrance uses clock time. The story never autoplays.
    intro.to(".scroll-invitation", { autoAlpha: .8, duration: 1.8,
      onUpdate: () => { if (state.progress > .035) gsap.set(".scroll-invitation", { autoAlpha: 0 }); }
    }, 2.4);
  }
  function teardown() {
    version++;
    starting = false;
    stopFrames();
    intro?.kill(); intro = null;
    timeline?.scrollTrigger?.kill();
    timeline?.kill(); timeline = null;
    scene?.dispose(); scene = null;
    root.classList.remove("enhanced");
    story.querySelectorAll("a").forEach((link) => link.removeAttribute("tabindex"));
    revelation.inert = true;
    revelation.setAttribute("aria-hidden", "true");
    activeChapter = -1;
  }
  function syncToggle() {
    const still = reduced.matches || manualStill || unavailable;
    root.classList.toggle("is-still", still);
    stillToggle.setAttribute("aria-pressed", String(still));
    stillToggle.textContent = still ? "Motion version" : "Still version";
    stillToggle.disabled = reduced.matches || unavailable;
    if (stillToggle.disabled) stillToggle.textContent = "Still version";
  }
  function fallback(failed = false) {
    const chapter = Math.max(0, activeChapter);
    const wasEnhanced = root.classList.contains("enhanced");
    unavailable = failed;
    teardown();
    syncToggle();
    if (wasEnhanced) story.children[chapter]?.scrollIntoView({ behavior: "instant" });
  }
  async function start(progress = 0) {
    syncToggle();
    if (reduced.matches || manualStill || unavailable || scene || starting) return;
    if (!window.gsap || !window.ScrollTrigger) { fallback(true); return; }
    starting = true;
    const request = ++version;
    try {
      await script("../vendor/three.min.js");
      await script(`scene.js${assetVersion}`);
      if (request !== version || reduced.matches || manualStill) return;
      root.classList.add("enhanced");
      story.querySelectorAll("a").forEach((link) => { link.tabIndex = -1; });
      state = { progress: 0 };
      scene = new window.FateScene(canvas, () => fallback(true));
      const currentScene = scene;
      makeTimeline();
      scene.resize();
      window.ScrollTrigger.refresh();
      if (progress > 0) {
        window.scrollTo(0, timeline.scrollTrigger.start + timeline.scrollTrigger.end * progress);
        timeline.progress(progress);
      }
      wake();
      // Only /fate/ in motion mode loads the 3 art plates, never the portfolio.
      await currentScene.loadArt();
      if (request !== version) return;
      wake();
    } catch {
      if (request === version) fallback(true);
    } finally { if (request === version) starting = false; }
  }
  stillToggle.addEventListener("click", () => {
    if (reduced.matches || unavailable) return;
    manualStill = !manualStill;
    try { localStorage.setItem("fate-still", manualStill ? "1" : "0"); } catch { /* optional */ }
    if (manualStill) fallback();
    else {
      const index = [...story.children].findIndex((el) => el.getBoundingClientRect().bottom > innerHeight * .5);
      void start(chapters[Math.max(0, index)].at);
    }
  });
  document.querySelector(".skip-story").addEventListener("click", (event) => {
    event.preventDefault();
    manualStill = true;
    fallback();
    story.focus({ preventScroll: true });
    story.scrollIntoView({ behavior: "instant" });
  });
  reduced.addEventListener("change", () => {
    if (reduced.matches) fallback();
    else void start();
  });
  window.addEventListener("resize", () => scene?.resize(), { passive: true });
  document.addEventListener("visibilitychange", () => {
    pageVisible = !document.hidden;
    if (pageVisible) wake(); else stopFrames();
  });
  window.addEventListener("pagehide", (event) => {
    pageVisible = false;
    if (event.persisted) stopFrames(); else { teardown(); sizeObserver.disconnect(); }
  });
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    pageVisible = !document.hidden;
    window.ScrollTrigger?.refresh();
    wake();
  });
  void start();
})();
