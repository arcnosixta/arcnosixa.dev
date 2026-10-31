/* Intro completion opens Chapter I; scroll gives its three drawings form. */
(() => {
  "use strict";
  const root = document.documentElement;
  const chapter = document.getElementById("creationChapter");
  if (root.dataset.design !== "cinematic" || !chapter) return;
  const projects = [...chapter.querySelectorAll("[data-creation-project]")];
  function linkProjects() {
    projects.forEach(link => {
      const id = `project-${link.dataset.creationProject}`;
      link.href = document.getElementById(id) ? `#${id}` : "#work";
    });
  }
  linkProjects();
  const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
  if (!gsap || !ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  const controller = new AbortController();
  const listen = (target, name, callback) => target.addEventListener(name, callback, { signal: controller.signal });
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const stage = chapter.querySelector(".creation-stage");
  const heading = [...chapter.querySelectorAll(".creation-kicker, .creation-title > *, .creation-note")];
  const media = gsap.matchMedia();
  const accentAt = gsap.utils.interpolate("#c8cbd1", "#fa8b34");
  let entrance, disposed = false;
  function introOpen() {
    return document.getElementById("cinematicIntro")?.getAttribute("aria-hidden") === "false";
  }
  function prepareEntrance() {
    entrance?.kill();
    if (reduced.matches) gsap.set(heading, { clearProps: "opacity,visibility,transform" });
    else gsap.set(heading, { autoAlpha: 0, y: 14 });
  }
  function enter() {
    entrance?.kill();
    if (disposed) return;
    if (reduced.matches) gsap.set(heading, { clearProps: "opacity,visibility,transform" });
    else entrance = gsap.to(heading, {
      autoAlpha: 1, y: 0, duration: .95, stagger: .13, ease: "power2.out",
      clearProps: "opacity,visibility,transform"
    });
  }
  function pathsIn(host) {
    return [...host.querySelectorAll(".creation-stroke")].flatMap(el =>
      typeof el.getTotalLength === "function" ? [el] : [...el.querySelectorAll("path, circle, rect, ellipse, line, polyline")]
    );
  }
  function draw(timeline, host, start, duration) {
    const paths = pathsIn(host);
    paths.forEach((path, index) => {
      const length = path.getTotalLength();
      timeline.fromTo(path, { strokeDasharray: length, strokeDashoffset: length },
        { strokeDashoffset: 0, duration, ease: "none" }, start + index * .012);
    });
  }
  media.add({ desktop: "(min-width: 1000px) and (min-height: 780px)", compact: "(max-width: 999px), (max-height: 779px)", reduce: "(prefers-reduced-motion: reduce)" }, context => {
    if (context.conditions.reduce) return;
    const color = { amount: 0 };
    const paintAccent = () => chapter.style.setProperty("--creation-accent", accentAt(color.amount));
    paintAccent();
    const desktop = context.conditions.desktop && stage.getBoundingClientRect().height <= innerHeight + 2;
    if (desktop) {
      const timeline = gsap.timeline({ onUpdate: paintAccent, scrollTrigger: {
        id: "creation-chapter", trigger: chapter, pin: stage, start: "top top",
        end: () => `+=${Math.round(innerHeight * 1.05)}`, scrub: .55,
        // Measure this upstream pin before every project and section below it.
        refreshPriority: 100, anticipatePin: 1, invalidateOnRefresh: true
      }});
      draw(timeline, chapter.querySelector(".creation-thread"), 0, .28);
      projects.forEach((project, index) => {
        draw(timeline, project.querySelector(".creation-drawing"), .04 + index * .16, .30);
        timeline.fromTo(project.querySelector(".creation-annotation"), { opacity: 0 }, { opacity: 1, duration: .14 }, .25 + index * .16);
        timeline.fromTo(project.querySelectorAll(".creation-point"), { opacity: 0 }, { opacity: 1, duration: .15 }, .34 + index * .16);
      });
      timeline.to(color, { amount: 1, duration: .60, ease: "none" }, .40);
    } else {
      projects.forEach((project, index) => {
        const drawing = project.querySelector(".creation-drawing");
        const timeline = gsap.timeline({ scrollTrigger: {
          id: `creation-drawing-${index}`, trigger: drawing, start: "top 65%", end: "bottom 35%",
          scrub: .4, invalidateOnRefresh: true
        }});
        draw(timeline, drawing, 0, .65);
        timeline.fromTo(project.querySelector(".creation-annotation"), { opacity: 0 }, { opacity: 1, duration: .2 }, .60);
        timeline.fromTo(project.querySelectorAll(".creation-point"), { opacity: 0 }, { opacity: 1, duration: .2 }, .70);
      });
      gsap.to(color, {
        amount: 1, ease: "none", onUpdate: paintAccent,
        scrollTrigger: { id: "creation-color", trigger: chapter, start: "top top", end: "bottom 85%", scrub: .5 }
      });
    }
    return () => chapter.style.removeProperty("--creation-accent");
  });
  listen(document, "portfolio:intro", prepareEntrance);
  listen(document, "portfolio:intro-end", enter);
  listen(document, "portfolio:render", () => { linkProjects(); ScrollTrigger.refresh(); });
  listen(reduced, "change", () => { if (!introOpen() || reduced.matches) enter(); });
  listen(window, "pageshow", event => { if (event.persisted) ScrollTrigger.refresh(); });
  listen(window, "pagehide", event => {
    if (event.persisted) { entrance?.progress(1); return; }
    disposed = true;
    entrance?.kill();
    media.revert();
    controller.abort();
  });
  document.fonts?.ready.then(() => { if (!disposed) ScrollTrigger.refresh(); });
  prepareEntrance();
  if (!introOpen()) enter();
})();
