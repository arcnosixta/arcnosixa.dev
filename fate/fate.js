(() => {
  "use strict";
  const root = document.documentElement;
  const stage = document.getElementById("stage");
  const canvas = document.getElementById("fate-canvas");
  const stillToggle = document.querySelector(".still-toggle");
  const story = document.getElementById("written-story");
  const revelation = document.querySelector(".revelation");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const { length: scoreLength, at, cue, phase, ending } = window.FateScore;
  const chapters = [
    { at: 0, name: "Silence" }, { at: 10.5, name: "The cut" },
    { at: 30, name: "The child" }, { at: 42.5, name: "The thousand hands" },
    { at: 71.5, name: "Ascension" }, { at: 96, name: "Ashes" },
    { at: 116, name: "" }, { at: 128, name: "The descent" },
    { at: 146, name: "Along the blade" }, { at: 194, name: "The ground" },
    { at: ending.rain, name: "The falling blades" },
    { at: ending.settled, name: "The field of swords" },
    { at: ending.flat, name: "A thousand swords" }
  ];
  let manualStill = false;
  try { manualStill = localStorage.getItem("fate-still") === "1"; } catch { /* optional */ }
  let scene, timeline, intro, raf = 0, lastFrame = 0, version = 0, unavailable = false;
  let activeChapter = -1, pageVisible = !document.hidden, stageVisible = true, starting = false;
  let state = { progress: 0 };
  let resizeProgress = null;
  const scripts = new Map();
  const assetVersion = new URL(document.currentScript.src).search;
  const sizeObserver = new ResizeObserver(() => scene?.resize());
  sizeObserver.observe(stage);
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    stageVisible = entry.isIntersecting;
    if (stageVisible) wake(); else stopFrames();
  });
  visibilityObserver.observe(stage);
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
  function canRender() { return scene && pageVisible && stageVisible && !root.classList.contains("is-sword-horizon"); }
  function frame(now) {
    raf = 0;
    if (!canRender()) return;
    const delta = lastFrame ? (now - lastFrame) / 1000 : 1 / 60;
    lastFrame = now;
    try { scene.render(state.progress, delta); }
    catch { fallback(true); return; }
    // Only the dark opening animates between scroll updates.
    if (state.progress * scoreLength < at(116)) raf = requestAnimationFrame(frame);
  }
  function wake() { if (canRender() && !raf) raf = requestAnimationFrame(frame); }
  function updateUI() {
    const p = state.progress, score = Math.round(cue(p * scoreLength) * 1000) / 1000;
    const white = Math.max(0, Math.min(1, (score - 104) / 12));
    const paper = white * white * (3 - 2 * white);
    root.style.setProperty("--fate-paper", paper.toFixed(4));
    const blank = score >= 116 && score < 128;
    if (root.classList.contains("is-void") !== blank) {
      root.classList.toggle("is-void", blank);
      document.querySelectorAll(".fate-hud, .sound-control").forEach(control => {
        control.inert = blank;
        if (blank) control.setAttribute("aria-hidden", "true"); else control.removeAttribute("aria-hidden");
      });
    }
    root.classList.toggle("is-journey", score >= 128);
    root.classList.toggle("is-sword-horizon", score >= ending.flat);
    stage.dataset.journeyPhase = phase(score);
    if (root.classList.contains("is-paper") !== (score >= 110)) {
      root.classList.toggle("is-paper", score >= 110);
      document.querySelector('meta[name="theme-color"]').content = score >= 110 ? "#ffffff" : "#000000";
    }
    document.querySelector(".story-progress span").style.transform = `scaleX(${p})`;
    let chapter = 0;
    chapters.forEach((item, i) => { if (score >= item.at) chapter = i; });
    if (activeChapter !== chapter) {
      activeChapter = chapter;
      document.querySelector(".chapter-name").textContent = chapters[chapter].name;
    }
    const revealed = score >= ending.return;
    revelation.inert = !revealed;
    revelation.setAttribute("aria-hidden", String(!revealed));
    wake();
  }
  function makeTimeline() {
    const gsap = window.gsap;
    gsap.registerPlugin(window.ScrollTrigger);
    // Artwork loading never changes this pinned viewport's dimensions.
    // Explicit refresh and resize handling preserve the current scroll position.
    window.ScrollTrigger.config({ autoRefreshEvents: "visibilitychange,DOMContentLoaded,resize" });
    gsap.set(".caption, .blade-note", { autoAlpha: 0, y: 0 });
    gsap.set(".silence", { autoAlpha: .7 });
    gsap.set(".revelation, .scroll-invitation, .chapter-marker", { autoAlpha: 0 });
    gsap.set(".journey-notes", { autoAlpha: 0 });
    gsap.set(".whiteout, #sword-horizon", { opacity: 0 });
    timeline = gsap.timeline({
      defaults: { ease: "none" }, onUpdate: updateUI,
      scrollTrigger: {
        id: "fate-story", trigger: "#experience", pin: stage,
        start: "top top", end: () => `+=${Math.round(stage.clientHeight * scoreLength * .095)}`,
        scrub: .85, anticipatePin: 1, invalidateOnRefresh: true,
        onRefresh(self) {
          if (resizeProgress === null) return;
          const progress = resizeProgress;
          resizeProgress = null;
          window.scrollTo(0, self.start + (self.end - self.start) * progress);
          self.animation.progress(progress);
        }
      }
    });
    chapters.forEach((c) => timeline.addLabel(c.name, at(c.at)));
    timeline.to(state, { progress: 1, duration: scoreLength }, 0);
    timeline.to(".silence", { autoAlpha: 0, duration: 3.5 }, 6);
    timeline.to(".scroll-invitation", { autoAlpha: 0, duration: 3 }, 3.5);
    timeline.to(".chapter-marker", { autoAlpha: 1, duration: 4 }, 7);
    function line(selector, enter, leave, duration = 2.3) {
      timeline.fromTo(selector, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: at(enter + duration) - at(enter), immediateRender: false }, at(enter));
      timeline.to(selector, { autoAlpha: 0, y: -10, duration: at(leave + 1.8) - at(leave) }, at(leave));
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
    timeline.set(".journey-notes", { autoAlpha: 1 }, at(154));
    line(".note-architecture", 156, 166, 2);
    line(".note-services", 169, 179, 2);
    line(".note-craft", 182, 192, 2);
    timeline.set(".journey-notes", { autoAlpha: 0 }, at(194));
    timeline.to("#sword-horizon", { opacity: 1, duration: at(ending.flat) - at(ending.flatten) }, at(ending.flatten));
    timeline.to(".revelation", { autoAlpha: 1, duration: 2 }, at(ending.return));
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
    resizeProgress = null;
    delete stage.dataset.journeyPhase;
    stopFrames();
    intro?.kill(); intro = null;
    timeline?.scrollTrigger?.kill();
    timeline?.kill(); timeline = null;
    scene?.dispose(); scene = null;
    root.classList.remove("enhanced");
    root.classList.remove("is-paper");
    root.classList.remove("is-void", "is-journey", "is-sword-horizon");
    root.style.removeProperty("--fate-paper");
    document.querySelectorAll(".fate-hud, .sound-control").forEach(control => {
      control.inert = false;
      control.removeAttribute("aria-hidden");
    });
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
    const score = state.progress * scoreLength;
    const wasEnhanced = root.classList.contains("enhanced");
    unavailable = failed;
    teardown();
    syncToggle();
    if (wasEnhanced) {
      const scenes = [...story.querySelectorAll("[data-story-at]")];
      const current = scenes.filter(el => Number(el.dataset.storyStart || el.dataset.storyAt) <= score).at(-1) || scenes[0];
      current?.scrollIntoView({ behavior: "instant" });
    }
  }
  async function start(progress = 0) {
    syncToggle();
    if (reduced.matches || manualStill || unavailable || scene || starting) return;
    if (!window.gsap || !window.ScrollTrigger) { fallback(true); return; }
    starting = true;
    const request = ++version;
    try {
      await script("../vendor/three.min.js");
      await script(`grove.js${assetVersion}`);
      await script(`sword-profiles.js${assetVersion}`);
      await script(`sword-field.js${assetVersion}`);
      await script(`katana.js${assetVersion}`);
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
        window.scrollTo(0, timeline.scrollTrigger.start + (timeline.scrollTrigger.end - timeline.scrollTrigger.start) * progress);
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
  function visibleStoryProgress() {
    const current = [...story.querySelectorAll("[data-story-at]")].find(el => el.getBoundingClientRect().bottom > innerHeight * .5);
    return Number(current?.dataset.storyAt || 0) / scoreLength;
  }
  stillToggle.addEventListener("click", () => {
    if (reduced.matches || unavailable) return;
    manualStill = !manualStill;
    try { localStorage.setItem("fate-still", manualStill ? "1" : "0"); } catch { /* optional */ }
    if (manualStill) fallback();
    else void start(visibleStoryProgress());
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
    else void start(visibleStoryProgress());
  });
  window.addEventListener("resize", () => {
    if (scene && timeline) resizeProgress ??= state.progress;
    scene?.resize();
  }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    pageVisible = !document.hidden;
    if (pageVisible) wake(); else stopFrames();
  });
  window.addEventListener("pagehide", (event) => {
    pageVisible = false;
    if (event.persisted) stopFrames(); else { teardown(); sizeObserver.disconnect(); visibilityObserver.disconnect(); }
  });
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    pageVisible = !document.hidden;
    window.ScrollTrigger?.refresh();
    wake();
  });
  void start();
})();
