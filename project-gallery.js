/* Selected work as a horizontal film strip, with native touch/keyboard access. */
(() => {
  "use strict";
  const root = document.documentElement;
  if (root.dataset.design !== "cinematic") return;
  let cleanup = () => {};

  function mount() {
    cleanup();
    const track = document.querySelector(".work-grid");
    if (!track) return;
    const en = root.lang === "en";
    let gallery = track.closest(".work-gallery");
    if (!gallery) {
      gallery = document.createElement("div");
      gallery.className = "work-gallery";
      const viewport = document.createElement("div");
      viewport.className = "gallery-viewport";
      track.before(gallery);
      gallery.append(viewport);
      viewport.append(track);
      const controls = document.createElement("div");
      controls.className = "gallery-controls mono";
      controls.innerHTML = '<span class="gallery-direction"></span><span class="gallery-position"></span><div class="gallery-nav"><button type="button" data-step="-1">&#8592;</button><button type="button" data-step="1">&#8594;</button></div><div class="gallery-progress" aria-hidden="true"><i></i></div>';
      gallery.append(controls);
    }
    gallery.setAttribute("role", "region");
    gallery.setAttribute("aria-label", en ? "Project gallery" : "Галерея проектов");
    const viewport = gallery.querySelector(".gallery-viewport");
    const cards = [...track.querySelectorAll(".project:not(.is-filtered)")];
    const previous = gallery.querySelector('[data-step="-1"]');
    const next = gallery.querySelector('[data-step="1"]');
    previous.setAttribute("aria-label", en ? "Previous project" : "Предыдущий проект");
    next.setAttribute("aria-label", en ? "Next project" : "Следующий проект");
    gallery.querySelector(".gallery-direction").textContent = en ? "SCROLL / SWIPE TO EXPLORE" : "СКРОЛЛ / СВАЙП — ЛИСТАТЬ";
    const count = gallery.querySelector(".gallery-position");
    const progress = gallery.querySelector(".gallery-progress i");
    track.querySelectorAll(".project").forEach((card, index) => {
      card.classList.remove("is-current");
      card.classList.add("is-in");
      if (!card.querySelector(".gallery-frame")) {
        const frame = document.createElement("span");
        frame.className = "gallery-frame";
        frame.setAttribute("aria-hidden", "true");
        frame.textContent = String(index + 1).padStart(2, "0");
        card.querySelector(".project-cover").append(frame);
      }
    });
    let starts = [], current = 0, frame = 0, pin, media;
    function measure() {
      starts = cards.map((card) => card.offsetLeft - track.offsetLeft);
    }
    function paint() {
      frame = 0;
      const x = viewport.scrollLeft;
      current = starts.reduce((best, value, index) => Math.abs(value - x) < Math.abs(starts[best] - x) ? index : best, 0);
      cards.forEach((card, index) => card.classList.toggle("is-current", index === current));
      count.textContent = `${String(current + 1).padStart(2, "0")} / ${String(cards.length).padStart(2, "0")}`;
      previous.disabled = current === 0;
      next.disabled = current === cards.length - 1;
      progress.style.transform = `scaleX(${(current + 1) / cards.length})`;
    }
    function onScroll() { if (!frame) frame = requestAnimationFrame(paint); }
    function go(index, instant = false) {
      index = Math.max(0, Math.min(cards.length - 1, index));
      const target = Math.min(starts[index], viewport.scrollWidth - viewport.clientWidth);
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (pin) {
        const max = viewport.scrollWidth - viewport.clientWidth;
        // Jump the scroll director as well, so it cannot pull a focused card back.
        window.scrollTo({ top: pin.start + (max ? target / max : 0) * (pin.end - pin.start), behavior: "instant" });
        viewport.scrollLeft = target;
      } else viewport.scrollTo({ left: target, behavior: reduce || instant ? "instant" : "smooth" });
      paint();
    }
    function click(event) {
      const button = event.target.closest("[data-step]");
      if (button) go(current + Number(button.dataset.step));
    }
    function focus(event) {
      const card = event.target.closest(".project");
      const index = cards.indexOf(card);
      if (index !== -1 && index !== current) go(index, true);
    }
    measure();
    viewport.scrollLeft = 0;
    paint();
    viewport.addEventListener("scroll", onScroll, { passive: true });
    gallery.addEventListener("click", click);
    track.addEventListener("focusin", focus);
    if (window.gsap && window.ScrollTrigger && cards.length > 1) {
      media = gsap.matchMedia();
      media.add("(min-width: 1000px) and (min-height: 760px) and (prefers-reduced-motion: no-preference)", () => {
        gallery.classList.add("is-scroll-directed");
        viewport.scrollLeft = 0;
        const tween = gsap.fromTo(viewport, { scrollLeft: 0 }, {
          scrollLeft: () => viewport.scrollWidth - viewport.clientWidth,
          ease: "none",
          scrollTrigger: {
            id: "project-film-strip", trigger: gallery, start: "top 24px",
            end: () => `+=${Math.max(viewport.scrollWidth - viewport.clientWidth, 1)}`,
            pin: true, scrub: true, invalidateOnRefresh: true, anticipatePin: 1,
            onRefresh: () => { measure(); paint(); },
          },
        });
        pin = tween.scrollTrigger;
        return () => { pin = null; gallery.classList.remove("is-scroll-directed"); };
      });
    }
    const resize = new ResizeObserver(() => { measure(); paint(); });
    resize.observe(viewport);
    cleanup = () => {
      media?.revert();
      resize.disconnect();
      cancelAnimationFrame(frame);
      viewport.removeEventListener("scroll", onScroll);
      gallery.removeEventListener("click", click);
      track.removeEventListener("focusin", focus);
    };
  }
  document.addEventListener("portfolio:render", mount);
  document.addEventListener("portfolio:filter", mount);
  mount();
})();
