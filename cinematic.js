/* A single director coordinates the intro, scroll chapters, and project scenes. */
(() => {
  "use strict";
  const root = document.documentElement;
  if (root.dataset.design !== "cinematic") return;
  const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
  const intro = document.getElementById("cinematicIntro"), hero = document.getElementById("home");
  const portrait = hero.querySelector(".cinematic-visual"), replay = document.getElementById("introReplay");
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let introTimeline, introTimer, scenes, refreshTimer;
  let hoverCleanup = () => {};
  const detailTweens = new WeakMap();
  const signalObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => entry.target.classList.toggle("is-visible", entry.isIntersecting));
  }, { rootMargin: "100px" });
  const emit = (name, detail) => document.dispatchEvent(new CustomEvent(`portfolio:${name}`, { detail }));
  const orbit = document.createElement("div");
  orbit.className = "cinema-orbit";
  orbit.setAttribute("aria-hidden", "true");
  portrait.append(orbit);
  const caption = document.createElement("div");
  caption.className = "cinema-caption";
  caption.setAttribute("aria-hidden", "true");
  caption.innerHTML = "<b>01 / ARC</b><span>CODE IN MOTION. IDEAS IN FORM.</span>";
  portrait.append(caption);
  const scroll = document.createElement("span");
  scroll.className = "cinema-scroll";
  scroll.setAttribute("aria-hidden", "true");
  portrait.append(scroll);

  function stopIntro() {
    clearTimeout(introTimer);
    clearTimeout(window.arcIntroFallback);
    introTimeline?.kill();
    introTimeline = null;
    root.classList.remove("is-intro-waiting", "is-intro-playing", "is-directed-intro");
    if (intro) {
      intro.style.display = "none";
      gsap?.set(intro.querySelectorAll(".intro-slice, .intro-wordmark, .intro-cut"), { clearProps: "transform,opacity" });
    }
  }
  function playIntro() {
    stopIntro();
    if (motion.matches || !intro) return;
    try { sessionStorage.setItem("arc-intro-seen", "1"); } catch (_) { /* Optional. */ }
    emit("intro");
    if (!gsap) {
      intro.style.removeProperty("display");
      root.classList.add("is-intro-playing");
      introTimer = setTimeout(stopIntro, 2000);
      return;
    }
    root.classList.add("is-directed-intro");
    intro.style.display = "block";
    const top = intro.querySelector(".intro-slice-top"), bottom = intro.querySelector(".intro-slice-bottom");
    const title = intro.querySelector(".intro-wordmark"), cut = intro.querySelector(".intro-cut");
    // The two polygons meet at 63% on the left and 37% on the right.
    // Derive the slash from the same geometry on every screen aspect ratio.
    const angle = -Math.atan2(window.innerHeight * .26, window.innerWidth) * 180 / Math.PI;
    introTimeline = gsap.timeline({ defaults: { ease: "power3.inOut" }, onComplete: stopIntro });
    introTimeline.set([top, bottom], { yPercent: 0 })
      .set(title, { opacity: 0, scale: 1.06, y: 16 })
      .set(cut, { scaleX: 0, opacity: 0, rotation: angle, transformOrigin: "center center" })
      .to(title, { opacity: 1, scale: 1, y: 0, duration: .55, ease: "power3.out" }, .08)
      .to(title, { opacity: 0, y: -12, duration: .25 }, .85)
      .set(cut, { opacity: 1 }, 1)
      .to(cut, { scaleX: 1, duration: .35 }, 1)
      .to(top, { yPercent: -110, duration: .85 }, 1.3)
      .to(bottom, { yPercent: 110, duration: .85 }, 1.3)
      .to(cut, { opacity: 0, duration: .25 }, 1.4);
    introTimer = setTimeout(stopIntro, 2700);
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
    hoverCleanup();
    decorate();
    if (!gsap || !ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);
    scenes = gsap.matchMedia();
    scenes.add({ desktop: "(min-width: 681px)", mobile: "(max-width: 680px)", reduce: "(prefers-reduced-motion: reduce)" }, (scope) => {
      if (scope.conditions.reduce) return;
      const mobile = scope.conditions.mobile;
      gsap.fromTo(portrait, { y: 0, scale: 1 }, {
        y: mobile ? 28 : 90, scale: 1.04, ease: "none",
        scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 1 },
      });
      gsap.to(orbit, { rotation: 110, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 1.2 } });
      gsap.fromTo(".cinematic-slash", { x: 0 }, { x: -100, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 1.2 } });
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
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    function pointer(event) {
      if (motion.matches || !fine.matches) return;
      const rect = portrait.getBoundingClientRect();
      portrait.style.setProperty("--portrait-x", `${((event.clientX - rect.left) / rect.width - .5) * 16}px`);
      portrait.style.setProperty("--portrait-y", `${((event.clientY - rect.top) / rect.height - .5) * 12}px`);
    }
    function reset() { portrait.style.removeProperty("--portrait-x"); portrait.style.removeProperty("--portrait-y"); }
    portrait.addEventListener("pointermove", pointer, { passive: true });
    portrait.addEventListener("pointerleave", reset);
    hoverCleanup = () => { portrait.removeEventListener("pointermove", pointer); portrait.removeEventListener("pointerleave", reset); reset(); };
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
    portrait.style.removeProperty("--portrait-x");
    portrait.style.removeProperty("--portrait-y");
  });
  document.addEventListener("visibilitychange", () => root.classList.toggle("is-page-hidden", document.hidden));
  window.addEventListener("pagehide", stopIntro);
  window.addEventListener("resize", () => { if (introTimeline) stopIntro(); });
  window.addEventListener("load", refresh, { once: true });
  document.fonts?.ready.then(refresh);
  buildScenes();
  let seen = false;
  try { seen = sessionStorage.getItem("arc-intro-seen") === "1"; } catch (_) { /* Optional. */ }
  if (!seen && !location.hash) playIntro();
  else stopIntro();
})();
