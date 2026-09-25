/**
 * Motion: reveal-анимации, разбивка текста, магнитные кнопки, 3D-наклон карточек,
 * курсорное свечение, скролл-связанные эффекты.
 *
 * Всё необязательное: без JS и без WebGL страница остаётся читаемой, а при
 * prefers-reduced-motion остаются только статичные состояния.
 */
(function () {
  "use strict";

  const root = document.documentElement;
  const topbar = document.getElementById("topbar");
  const hero = document.getElementById("home");
  const glowNode = document.getElementById("cursorGlow");
  const timeline = document.getElementById("timeline");

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(pointer: fine)");

  const MAGNET = ".btn, .link:not(.link-ghost), .lang, .burger";
  const TILT = ".project, .skill-card, .stat, .mini-card, .small-card, .contact-link";
  const MAGNET_LIMIT = 9;
  const TILT_LIMIT = 7;

  let reduced = motionQuery.matches;
  let fine = finePointer.matches;
  let loopId = 0;
  let lastY = window.scrollY;
  let pointer = { x: 0, y: 0, tx: 0, ty: 0, seen: false, queued: false };
  let magnetNode = null;
  let tiltNode = null;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function splitChars(node) {
    const text = node.textContent.trim();
    if (!text || node.dataset.splitText === text) return;

    const frag = document.createDocumentFragment();
    const words = text.split(" ");
    let index = 0;
    words.forEach((wordText, wordIndex) => {
      const word = document.createElement("span");
      word.className = "word";
      Array.from(wordText).forEach((letter) => {
        const char = document.createElement("span");
        char.className = "char";
        char.textContent = letter;
        char.style.setProperty("--i", String(index));
        index += 1;
        word.appendChild(char);
      });
      frag.appendChild(word);
      if (wordIndex < words.length - 1) frag.appendChild(document.createTextNode(" "));
    });

    node.textContent = "";
    node.appendChild(frag);
    node.dataset.splitText = text;
  }

  function playHeroTitle() {
    const title = document.querySelector(".hero-title");
    if (!title) return;
    title.classList.remove("chars-in");
    if (!reduced) {
      title.querySelectorAll("[data-i18n]").forEach(splitChars);
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => title.classList.add("chars-in"));
    });
  }

  function markTiltable() {
    document.querySelectorAll(TILT).forEach((node) => node.classList.add("tiltable"));
  }

  function resetTilt(node) {
    node.style.setProperty("--rx", "0deg");
    node.style.setProperty("--ry", "0deg");
    node.style.setProperty("--px", "50%");
    node.style.setProperty("--py", "50%");
  }

  function applyMagnet(node, x, y) {
    const rect = node.getBoundingClientRect();
    const dx = (x - (rect.left + rect.width / 2)) / (rect.width / 2);
    const dy = (y - (rect.top + rect.height / 2)) / (rect.height / 2);
    node.style.setProperty("--mx", `${(clamp(dx, -1, 1) * MAGNET_LIMIT).toFixed(2)}px`);
    node.style.setProperty("--my", `${(clamp(dy, -1, 1) * MAGNET_LIMIT * 0.6).toFixed(2)}px`);
  }

  function resetMagnet(node) {
    node.style.setProperty("--mx", "0px");
    node.style.setProperty("--my", "0px");
  }

  function onPointerMove(event) {
    const x = event.clientX;
    const y = event.clientY;

    if (glowNode) {
      pointer.tx = x;
      pointer.ty = y;
      pointer.seen = true;
    }

    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    if (fine && !reduced) {
      const node = target.closest(MAGNET);
      if (node !== magnetNode) {
        if (magnetNode) resetMagnet(magnetNode);
        magnetNode = node;
      }
      if (node) applyMagnet(node, x, y);

      const card = target.closest(TILT);
      if (card !== tiltNode) {
        if (tiltNode) resetTilt(tiltNode);
        tiltNode = card;
      }
      if (card) {
        pointer.x = x;
        pointer.y = y;
        if (!pointer.queued) {
          pointer.queued = true;
          window.requestAnimationFrame(applyTilt);
        }
      }
    }
  }

  function applyTilt() {
    pointer.queued = false;
    if (!tiltNode) return;
    const rect = tiltNode.getBoundingClientRect();
    const nx = clamp((pointer.x - rect.left) / rect.width, 0, 1);
    const ny = clamp((pointer.y - rect.top) / rect.height, 0, 1);
    tiltNode.style.setProperty("--ry", `${((nx - 0.5) * TILT_LIMIT).toFixed(2)}deg`);
    tiltNode.style.setProperty("--rx", `${((0.5 - ny) * TILT_LIMIT).toFixed(2)}deg`);
    tiltNode.style.setProperty("--px", `${(nx * 100).toFixed(1)}%`);
    tiltNode.style.setProperty("--py", `${(ny * 100).toFixed(1)}%`);
  }

  function onPointerOut(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (event.relatedTarget instanceof Node) {
      const node = target.closest(TILT);
      if (node && node.contains(event.relatedTarget)) return;
    }
    if (tiltNode) {
      resetTilt(tiltNode);
      tiltNode = null;
    }
  }

  function updateGlow() {
    if (!glowNode) return;
    if (!fine || reduced || !pointer.seen) {
      glowNode.style.opacity = "0";
      return;
    }
    pointer.x += (pointer.tx - pointer.x) * 0.12;
    pointer.y += (pointer.ty - pointer.y) * 0.12;
    glowNode.style.opacity = "1";
    glowNode.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0) translate(-50%, -50%)`;
  }

  function updateTopbar() {
    if (!topbar) return;
    const y = window.scrollY;
    const delta = y - lastY;
    topbar.classList.toggle("is-stuck", y > 24);
    if (Math.abs(delta) > 3) {
      topbar.classList.toggle("is-hidden", y > 260 && delta > 0);
    }
    lastY = y;
  }

  function updateHero() {
    if (!hero) return;
    const inner = hero.querySelector(".hero-inner");
    if (!inner) return;
    if (reduced) {
      inner.style.removeProperty("--hero-shift");
      inner.style.removeProperty("--hero-fade");
      return;
    }
    const span = hero.offsetHeight || 1;
    const p = clamp(window.scrollY / span, 0, 1);
    inner.style.setProperty("--hero-shift", `${(p * 70).toFixed(1)}px`);
    inner.style.setProperty("--hero-fade", (1 - p * 0.85).toFixed(3));
  }

  function updateTimeline() {
    if (!timeline) return;
    if (reduced) {
      timeline.style.setProperty("--tl", "1");
      return;
    }
    const rect = timeline.getBoundingClientRect();
    const reach = window.innerHeight * 0.7;
    const p = clamp((reach - rect.top) / Math.max(rect.height, 1), 0, 1);
    timeline.style.setProperty("--tl", p.toFixed(3));
  }

  function loop() {
    loopId = window.requestAnimationFrame(loop);
    updateGlow();
    updateTopbar();
    updateHero();
    updateTimeline();
  }

  function start() {
    playHeroTitle();
    markTiltable();
    if (!reduced) loop();
    else updateTimeline();
  }

  document.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("pointerout", onPointerOut, { passive: true });
  document.addEventListener("portfolio:render", () => {
    markTiltable();
    playHeroTitle();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      window.cancelAnimationFrame(loopId);
      loopId = 0;
    } else if (!reduced && !loopId) {
      loop();
    }
  });

  motionQuery.addEventListener?.("change", (event) => {
    reduced = event.matches;
    if (reduced) {
      window.cancelAnimationFrame(loopId);
      loopId = 0;
      if (magnetNode) resetMagnet(magnetNode);
      if (tiltNode) resetTilt(tiltNode);
    } else if (!loopId) {
      loop();
    }
  });

  finePointer.addEventListener?.("change", (event) => {
    fine = event.matches;
    if (!fine && glowNode) glowNode.style.opacity = "0";
  });

  window.addEventListener("blur", () => {
    if (tiltNode) {
      resetTilt(tiltNode);
      tiltNode = null;
    }
    if (magnetNode) {
      resetMagnet(magnetNode);
      magnetNode = null;
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  void root;
})();
