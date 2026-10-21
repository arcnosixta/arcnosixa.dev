/* A single director coordinates the intro, scroll chapters, and project scenes. */
(() => {
  "use strict";
  const root = document.documentElement;
  if (root.dataset.design !== "cinematic") return;
  const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
  const intro = document.getElementById("cinematicIntro"), hero = document.getElementById("home");
  const replay = document.getElementById("introReplay");
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let introTimeline, introTimer, introCutTimer, scenes, refreshTimer;
  let introSplashTimers = [];
  let introActive = false;
  let introRunning = false, introVersion = 0;
  const detailTweens = new WeakMap();
  const signalObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => entry.target.classList.toggle("is-visible", entry.isIntersecting));
  }, { rootMargin: "100px" });
  const emit = (name, detail) => document.dispatchEvent(new CustomEvent(`portfolio:${name}`, { detail }));
  const caption = document.createElement("div");
  caption.className = "cinema-caption";
  caption.setAttribute("aria-hidden", "true");
  caption.innerHTML = "<b>01 / ARC</b><span>CODE IN MOTION. IDEAS IN FORM.</span>";
  hero.querySelector(".cinematic-visual").append(caption);

  function stopIntro() {
    const wasActive = introActive;
    const wasRunning = introRunning;
    introActive = introRunning = false;
    introVersion++;
    clearTimeout(introTimer);
    clearTimeout(introCutTimer);
    introSplashTimers.forEach(clearTimeout);
    introSplashTimers = [];
    clearTimeout(window.arcIntroFallback);
    introTimeline?.kill();
    introTimeline = null;
    root.classList.remove("is-intro-waiting", "is-intro-playing", "is-directed-intro", "is-awaiting-audio");
    if (intro) {
      intro.style.display = "none";
      intro.setAttribute("aria-hidden", "true");
      intro.dataset.stage = "closed";
      gsap?.set(intro.querySelectorAll(".intro-bed, .intro-slice, .intro-wordmark, .intro-cut, .intro-splashes, .blood-splash, .intro-controls"), { clearProps: "transform,opacity" });
    }
    if (wasActive && !wasRunning) window.PortfolioSound?.cancelIntroStart();
    if (wasActive) emit("intro-end");
  }
  function playIntro() {
    stopIntro();
    if (motion.matches || !intro) { emit("intro-end"); return; }
    introActive = true;
    const version = introVersion;
    const start = document.getElementById("introStart");
    const skip = document.getElementById("introSkip");
    const english = root.lang === "en";
    start.hidden = true;
    start.textContent = english ? "Start with sound" : "Начать со звуком";
    start.dataset.silent = "";
    skip.textContent = english ? "Skip intro" : "Пропустить";
    intro.style.display = "block";
    root.classList.add("is-directed-intro");
    intro.setAttribute("aria-hidden", "false");
    intro.setAttribute("role", "region");
    intro.setAttribute("aria-label", english ? "Introduction" : "Вступление");
    intro.dataset.stage = "waiting";
    emit("intro");
    const rise = Math.tan(9 * Math.PI / 180) * window.innerWidth / 2;
    intro.style.setProperty("--intro-rise", `${rise}px`);
    const heading = getComputedStyle(hero.querySelector(".hero-title"));
    intro.querySelectorAll(".intro-name").forEach((name) => {
      name.closest("svg").setAttribute("aria-hidden", "true");
      name.style.fontFamily = heading.fontFamily;
      name.style.fontWeight = heading.fontWeight;
      name.removeAttribute("dy");
      const bounds = name.getBBox();
      name.setAttribute("dy", String(450 - bounds.y - bounds.height / 2));
    });
    const bloodLayer = intro.querySelector(".intro-splashes");
    const bloodMarks = [...intro.querySelectorAll(".blood-splash")];
    const nameBounds = intro.querySelector(".intro-name").getBBox();
    const matrix = bloodLayer.getScreenCTM();
    if (matrix) intro.querySelectorAll(".blood-anchor").forEach((anchor) => {
      const x = nameBounds.x + nameBounds.width * Number(anchor.dataset.fraction);
      const screenX = x * matrix.a + matrix.e;
      const cutY = window.innerHeight / 2 - (screenX - window.innerWidth / 2) * Math.tan(9 * Math.PI / 180);
      const y = (cutY - matrix.f) / matrix.d + Number(anchor.dataset.offset);
      anchor.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
    });
    const impacts = [2.22, 2.42, 2.61, 2.8];
    const phase = (name) => { intro.dataset.stage = name; emit(name); };
    const splash = (index) => { if (index === 0) phase("stain"); emit("splash", { index }); };
    if (gsap) {
      root.classList.add("is-directed-intro");
      const top = intro.querySelector(".intro-slice-top"), bottom = intro.querySelector(".intro-slice-bottom");
      const titles = intro.querySelectorAll(".intro-wordmark"), cut = intro.querySelector(".intro-cut");
      const bed = intro.querySelector(".intro-bed");
      gsap.set([top, bottom], { xPercent: 0, yPercent: 0 });
      gsap.set([titles, bed, intro.querySelector(".intro-controls")], { opacity: 1 });
      gsap.set(cut, { scaleX: 0, rotation: -9, opacity: 1, transformOrigin: "center center" });
      gsap.set(bloodLayer, { opacity: 1 });
      bloodMarks.forEach((mark) => gsap.set(mark, { opacity: 0, scale: .04, rotation: Number(mark.dataset.rotation) - 8, transformOrigin: "50% 50%" }));
      introTimeline = gsap.timeline({ paused: true, defaults: { ease: "power3.inOut" }, onComplete: stopIntro });
      introTimeline.call(() => phase("blade"), null, 1.8)
        .to(cut, { scaleX: 1, duration: .22, ease: "power2.inOut" }, 1.8)
        .to(top, { xPercent: 1, yPercent: -1.3, duration: .22 }, 2.02)
        .to(bottom, { xPercent: -1, yPercent: 1.3, duration: .22 }, 2.02)
        .to(cut, { opacity: 0, duration: .15 }, 2.15);
      bloodMarks.forEach((mark, index) => {
        const size = Number(getComputedStyle(mark).getPropertyValue("--splash-scale")) || 1;
        introTimeline.call(() => splash(index), null, impacts[index])
          .to(mark, { opacity: 1, scale: size, rotation: Number(mark.dataset.rotation), duration: .24, ease: "expo.out" }, impacts[index])
          .to(mark, { scale: size * 1.06, duration: .65, ease: "power1.out" }, impacts[index] + .24);
      });
      introTimeline.to([titles, bloodLayer], { opacity: 0, duration: .35 }, 4.35)
        .to(bed, { opacity: 0, duration: .15 }, 4.6)
        .call(() => phase("reveal"), null, 4.7)
        .to(top, { xPercent: 8, yPercent: -100, duration: 1.3 }, 4.7)
        .to(bottom, { xPercent: -8, yPercent: 100, duration: 1.3 }, 4.7)
        .to(intro.querySelector(".intro-controls"), { opacity: 0, duration: .15 }, 5.65);
      // Music gets two additional seconds on the uncut title before the scene.
      introTimeline.shiftChildren(2, true, 0);
    } else {
      root.classList.add("is-directed-intro");
    }
    let beginning = false;
    async function begin(silent = false) {
      if (beginning || !introActive || introRunning) return;
      beginning = true;
      start.hidden = true;
      let result;
      try { result = await window.PortfolioSound?.startIntro(silent); }
      catch (_) { result = { failed: true }; }
      beginning = false;
      if (!introActive || version !== introVersion) return;
      if (result?.blocked || result?.failed) {
        root.classList.add("is-awaiting-audio");
        start.hidden = false;
        start.dataset.silent = result.failed ? "1" : "";
        start.textContent = result.failed ? (english ? "Continue without sound" : "Продолжить без звука") : (english ? "Start with sound" : "Начать со звуком");
        start.focus({ preventScroll: true });
        return;
      }
      root.classList.remove("is-awaiting-audio");
      introRunning = true;
      intro.dataset.stage = "playing";
      try { sessionStorage.setItem("arc-intro-seen", "1"); } catch (_) { /* Optional. */ }
      emit("intro-start", { duration: 8, musicStarted: Boolean(result?.started) });
      if (introTimeline) introTimeline.play(0);
      else {
        root.classList.remove("is-directed-intro");
        root.classList.add("is-intro-playing");
        introCutTimer = setTimeout(() => phase("blade"), 3800);
        introSplashTimers = impacts.map((time, index) => setTimeout(() => splash(index), (time + 2) * 1000));
      }
      introTimer = setTimeout(stopIntro, introTimeline ? 8800 : 8000);
    }
    start.onclick = () => { void begin(start.dataset.silent === "1"); };
    skip.onclick = stopIntro;
    void begin();
  }
  const motifs = {
    ciel: '<path class="signal-path" d="M60 210H230L320 120L410 210H580M230 210L320 300L410 210"/><path class="signal-pulse" d="M60 210H230L320 120L410 210H580"/><circle class="signal-node" cx="60" cy="210" r="9"/><circle class="signal-node" cx="580" cy="210" r="9"/>',
    rigforge: '<g class="signal-path"><path d="M150 100h340v220H150zM180 130h90v70h-90zM370 130h90v70h-90zM180 230h280v55H180zM270 165h100M225 200v30M415 200v30"/></g><path class="signal-pulse" d="M225 165H415V255H225Z"/>',
    "osint-portal": '<circle class="signal-path" cx="320" cy="210" r="150"/><circle class="signal-path" cx="320" cy="210" r="100"/><g class="signal-ring"><path d="M320 60V210H470"/><circle cx="320" cy="60" r="5" fill="#fa8b34"/></g><path class="signal-path" d="M120 210H520M320 30V390"/>',
  };
  function decorate() {
    signalObserver.disconnect();
    document.querySelectorAll(".project-cover").forEach((cover) => {
      const existing = cover.querySelector(".project-signal");
      if (existing) { signalObserver.observe(existing); return; }
      const key = cover.closest(".project").dataset.key;
      const signal = document.createElement("div");
      signal.className = "project-signal";
      signal.setAttribute("aria-hidden", "true");
      const fallback = '<ellipse class="signal-ring" cx="320" cy="210" rx="240" ry="100"/><path class="signal-path" d="M60 280L180 140L300 260L420 130L580 210"/><path class="signal-pulse" d="M60 280L180 140L300 260L420 130L580 210"/>';
      signal.innerHTML = `<svg viewBox="0 0 640 420" preserveAspectRatio="xMidYMid slice">${motifs[key] || fallback}</svg>`;
      cover.prepend(signal);
      signalObserver.observe(signal);
    });
    let word = document.querySelector(".cinema-contact-word");
    if (!word) {
      word = document.createElement("p");
      word.className = "cinema-contact-word";
      document.querySelector(".contact-card").prepend(word);
    }
    const text = root.lang === "en" ? "LET’S BUILD." : "СОЗДАДИМ?";
    word.setAttribute("aria-label", text);
    word.replaceChildren(...Array.from(text, (letter) => {
      const span = document.createElement("span");
      span.textContent = letter;
      span.setAttribute("aria-hidden", "true");
      return span;
    }));
  }
  function refresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => ScrollTrigger?.refresh(), 1100);
  }
  function buildScenes() {
    scenes?.revert();
    decorate();
    if (!gsap || !ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);
    scenes = gsap.matchMedia();
    scenes.add({ desktop: "(min-width: 681px)", mobile: "(max-width: 680px)", reduce: "(prefers-reduced-motion: reduce)" }, (scope) => {
      if (scope.conditions.reduce) return;
      const mobile = scope.conditions.mobile;
      gsap.fromTo(".chapter-word", { xPercent: 12 }, { xPercent: -8, ease: "none", scrollTrigger: { trigger: "#work", start: "top bottom", end: "top top", scrub: .8 } });
      document.querySelectorAll(".section").forEach((section) => {
        gsap.fromTo(section.querySelector(".section-head"), { "--chapter-line": 0 }, {
          "--chapter-line": 1, duration: 1.1, ease: "power3.out",
          scrollTrigger: { trigger: section, start: "top 78%", once: true },
        });
      });
      gsap.from(".cinema-contact-word span", {
        yPercent: 110, rotation: 6, opacity: 0, stagger: .035, duration: .75, ease: "power3.out",
        scrollTrigger: { trigger: "#contact", start: "top 80%", once: true },
      });
      const skillCards = document.querySelectorAll(".skill-card");
      if (skillCards.length) gsap.from(skillCards, {
        x: mobile ? 12 : 32, stagger: .07, duration: .7, ease: "power3.out",
        scrollTrigger: { trigger: "#skills", start: "top 75%", once: true },
      });
    });
    scenes.add("all", () => {
      document.querySelectorAll("main > section").forEach((section) => {
        ScrollTrigger.create({ trigger: section, start: "top 55%", end: "bottom 55%", onEnter: () => emit("chapter", { id: section.id }), onEnterBack: () => emit("chapter", { id: section.id }) });
      });
    });
    ScrollTrigger.refresh();
  }
  replay?.addEventListener("click", playIntro);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" || event.key === "Tab") stopIntro(); });
  document.addEventListener("portfolio:render", buildScenes);
  document.addEventListener("portfolio:project", (event) => {
    const { card, open } = event.detail;
    detailTweens.get(card)?.revert();
    if (open && gsap && !motion.matches) {
      detailTweens.set(card, gsap.from(card.querySelectorAll(".project-list li"), {
        x: 20, opacity: 0, duration: .55, stagger: .065, delay: .25, ease: "power3.out", clearProps: "transform,opacity",
      }));
    }
    refresh();
  });
  document.getElementById("projects").addEventListener("click", (event) => { if (event.target.closest(".filter")) refresh(); });
  motion.addEventListener("change", () => {
    stopIntro();
  });
  document.addEventListener("visibilitychange", () => {
    root.classList.toggle("is-page-hidden", document.hidden);
    if (!introRunning || !introTimeline) return;
    clearTimeout(introTimer);
    if (document.hidden) introTimeline.pause();
    else {
      introTimeline.resume();
      introTimer = setTimeout(stopIntro, (8 - introTimeline.time()) * 1000 + 800);
    }
  });
  window.addEventListener("pagehide", stopIntro);
  window.addEventListener("resize", () => { if (introTimeline) stopIntro(); });
  window.addEventListener("load", refresh, { once: true });
  document.fonts?.ready.then(refresh);
  buildScenes();
  let seen = false;
  try { seen = sessionStorage.getItem("arc-intro-seen") === "1"; } catch (_) { /* Optional. */ }
  if (!seen && !location.hash) playIntro();
  else { stopIntro(); emit("intro-end"); }
})();
