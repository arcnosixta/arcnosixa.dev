/* One diagonal thread connects the cover, project scenes and final spread. */
(() => {
  "use strict";
  const root = document.documentElement;
  if (root.dataset.design !== "cinematic") return;
  let media, refreshTimer;
  const featured = ["ciel", "rigforge", "osint-portal"];
  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    el.className = cls;
    if (text) el.textContent = text;
    return el;
  };
  const illustrations = {
    ciel: `<div class="agent-window"><div class="agent-bar"><i></i><i></i><i></i><span>CIEL / LOCAL WORKSPACE</span></div><div class="agent-request scene-piece"><span>01 / INPUT</span><b>workspace → agent</b><code>POST /session</code></div><div class="agent-stream"><span class="agent-packet"></span><i class="scene-piece"></i><i class="scene-piece"></i><i class="scene-piece"></i><i class="scene-piece"></i><i class="scene-piece"></i></div><div class="agent-response scene-piece"><span>02 / STREAM</span><b>JSON + SSE</b><code>session → event → interface</code></div><div class="agent-status scene-piece">● LOOPBACK ONLY <span>~40 EVENTS</span></div></div><span class="scene-notation">REQUEST / BRIDGE / RESPONSE</span>`,
    rigforge: `<svg class="rig-drawing" viewBox="0 0 600 540" fill="none"><g class="rig-wires" stroke="currentColor"><path d="M100 275H240V170H340M300 330V460H440V350M130 390H210V300M340 240H470V170"/></g><g class="scene-piece rig-board"><rect x="140" y="95" width="330" height="350" rx="8"/><path d="M155 105H455V435H155Z" stroke-dasharray="3 7"/></g><g class="scene-piece rig-cpu"><rect x="235" y="180" width="120" height="120" rx="4"/><rect x="255" y="200" width="80" height="80"/><text x="295" y="246">CPU</text></g><g class="scene-piece rig-ram"><rect x="390" y="140" width="22" height="190"/><rect x="425" y="140" width="22" height="190"/><text x="420" y="365">RAM</text></g><g class="scene-piece rig-gpu"><rect x="180" y="340" width="180" height="52"/><path d="M200 355H340M200 365H340M200 375H340"/><text x="270" y="425">GPU</text></g><g class="rig-callouts"><path d="M235 180L130 55H40M355 240H535M180 365H40"/><text x="40" y="40">SOCKET / CHECK</text><text x="450" y="225">POWER</text><text x="40" y="350">FORM FACTOR</text></g></svg><span class="scene-notation">CATALOG / COMPATIBILITY / BUILD</span>`,
    "osint-portal": `<svg class="graph-drawing" viewBox="0 0 600 540" fill="none"><g class="graph-lines" stroke="currentColor"><path d="M300 270L120 130"/><path d="M300 270L480 100"/><path d="M300 270L500 350"/><path d="M300 270L190 450"/><path d="M300 270L70 310"/><path d="M120 130L480 100"/><path d="M190 450L500 350"/></g><circle class="graph-scan" cx="300" cy="270" r="45" stroke="currentColor"/><g class="scene-piece graph-node"><circle cx="300" cy="270" r="58"/><text x="300" y="275">TARGET</text></g><g class="scene-piece graph-node"><circle cx="120" cy="130" r="36"/><text x="120" y="135">DNS</text></g><g class="scene-piece graph-node"><circle cx="480" cy="100" r="40"/><text x="480" y="105">WHOIS</text></g><g class="scene-piece graph-node"><circle cx="500" cy="350" r="36"/><text x="500" y="355">TLS</text></g><g class="scene-piece graph-node"><circle cx="190" cy="450" r="42"/><text x="190" y="455">EVIDENCE</text></g><g class="scene-piece graph-node"><circle cx="70" cy="310" r="28"/><text x="70" y="315">IP</text></g></svg><span class="scene-notation">RUN / EVIDENCE / GRAPH</span>`,
  };

  function prepare() {
    const en = root.lang === "en";
    const hero = document.querySelector("#home");
    if (!hero.querySelector(".cover-name")) {
      const word = node("p", "cover-name", "ARCNOSIXTA");
      word.setAttribute("aria-hidden", "true");
      hero.prepend(word);
      const issue = node("span", "cover-issue mono", "VOL. 01 / 2026");
      issue.setAttribute("aria-hidden", "true");
      hero.append(issue);
    }
    let subtitle = hero.querySelector(".cover-subtitle");
    if (!subtitle) { subtitle = node("p", "cover-subtitle"); hero.append(subtitle); }
    subtitle.textContent = en ? "IDEAS BECOME SYSTEMS." : "ИДЕИ СТАНОВЯТСЯ СИСТЕМАМИ.";
    const track = document.querySelector(".work-grid");
    if (!track) return;
    track.classList.add("manga-scenes");
    let index = document.querySelector(".project-index");
    if (!index) {
      index = node("nav", "project-index");
      document.querySelector(".work-bar").before(index);
    }
    index.setAttribute("aria-label", en ? "Project index" : "Индекс проектов");
    index.replaceChildren();
    const cards = [...track.querySelectorAll(".project")];
    const ordered = [...featured.map((key) => cards.find((card) => card.dataset.key === key)), ...cards.filter((card) => !featured.includes(card.dataset.key))].filter(Boolean);
    ordered.forEach((card, position) => {
      track.append(card);
      const key = card.dataset.key;
      card.id = `project-${key}`;
      card.classList.add("is-in");
      card.classList.remove("reveal");
      card.querySelector(".project-num").textContent = String(position + 1).padStart(2, "0");
      const title = card.querySelector(".project-title").textContent;
      const link = node("a", "index-entry");
      link.href = `#${card.id}`;
      link.innerHTML = `<span class="mono">${String(position + 1).padStart(2, "0")}</span><b></b><span aria-hidden="true">↗</span>`;
      link.querySelector("b").textContent = title;
      link.hidden = card.classList.contains("is-filtered");
      index.append(link);
      if (!featured.includes(key)) { card.classList.add("archive-project"); return; }
      card.classList.add("story-project");
      if (card.querySelector(".scene-stage")) return;
      const stage = node("div", "scene-stage");
      const body = node("div", "scene-body");
      const art = card.querySelector(".project-cover");
      art.classList.add("scene-art");
      const number = node("span", "scene-number", String(position + 1).padStart(2, "0"));
      number.setAttribute("aria-hidden", "true");
      const illustration = node("div", "scene-illustration");
      illustration.setAttribute("aria-hidden", "true");
      illustration.innerHTML = illustrations[key];
      art.append(number, illustration);
      const caption = node("p", "scene-label mono", ["01 / AGENT SYSTEMS", "02 / HARDWARE LOGIC", "03 / CONNECTED EVIDENCE"][position]);
      body.append(caption);
      const children = [...card.children].filter((child) => child !== art && !child.matches(".project-rail, .card-cursor-light"));
      children.forEach((child) => body.append(child));
      const point = body.querySelectorAll(".project-list li")[key === "ciel" ? 1 : key === "osint-portal" ? 3 : 0];
      const contribution = node("div", "scene-contribution");
      contribution.append(node("span", "mono", en ? "MY CONTRIBUTION" : "МОЙ ВКЛАД"), node("p", "", point?.textContent || ""));
      body.querySelector(".project-stack").after(contribution);
      const seam = node("span", "scene-seam");
      seam.setAttribute("aria-hidden", "true");
      stage.append(art, body, seam);
      card.append(stage);
    });
    let archiveTitle = track.querySelector(".archive-heading");
    if (!archiveTitle) archiveTitle = node("h3", "archive-heading");
    archiveTitle.textContent = en ? "MORE FROM THE ARCHIVE ↘" : "ЕЩЁ ИЗ АРХИВА ↘";
    archiveTitle.hidden = !track.querySelector(".archive-project:not(.is-filtered)");
    track.querySelector(".archive-project")?.before(archiveTitle);
    const about = document.querySelector("#about");
    if (!about.querySelector(".author-portrait")) {
      const portrait = node("div", "author-portrait");
      portrait.setAttribute("aria-hidden", "true");
      portrait.innerHTML = '<span class="mono">THE AUTHOR / ARC</span>';
      about.querySelector(".about").prepend(portrait);
    }
    for (const [id, ru, english] of [["about", "МЫШЛЮ\nСИСТЕМАМИ.", "THINK IN\nSYSTEMS."], ["skills", "ВНУТРИ\nПРОЦЕССА.", "BEHIND\nTHE PROCESS."], ["path", "ИСТОРИЯ\nВ СБОРКЕ.", "A STORY\nIN PROGRESS."]]) {
      const section = document.getElementById(id);
      let word = section.querySelector(".spread-word");
      if (!word) { word = node("p", "spread-word"); word.setAttribute("aria-hidden", "true"); section.querySelector(".section-head").after(word); }
      word.textContent = en ? english : ru;
    }
    document.querySelectorAll("#about, #skills, #path, #contact").forEach((section) => {
      if (section.querySelector(".spread-seam")) return;
      const seam = node("span", "spread-seam");
      seam.setAttribute("aria-hidden", "true");
      section.prepend(seam);
    });
    document.querySelectorAll(".skill-card, .tl-item").forEach(card => { card.classList.remove("reveal"); card.classList.add("is-in"); });
    document.querySelectorAll(".skill-card").forEach((card, i) => card.style.setProperty("--skill-index", i));
    prepareSpreads();
  }

  function prepareSpreads() {
    document.querySelectorAll("#about .reveal, #skills .reveal, #path .reveal, #contact .reveal").forEach(el => {
      el.classList.remove("reveal");
      el.classList.add("is-in");
    });
    // Preserve real text and DOM reading order; only decorative accents are hidden.
    const lead = document.querySelector(".about-text p:first-child");
    if (!lead.querySelector(".author-line")) {
      const sentences = lead.textContent.trim().match(/[^.!?]+[.!?]*/g) || [lead.textContent];
      lead.replaceChildren(...sentences.map(text => node("span", "author-line", text.trim() + " ")));
    }
    document.querySelectorAll(".skill-card").forEach(row => {
      if (row.querySelector(".skill-wire")) return;
      const wire = node("span", "skill-wire");
      wire.setAttribute("aria-hidden", "true");
      wire.append(node("i", "skill-port"));
      row.prepend(wire);
    });
    const journey = document.querySelector("#timeline");
    if (!journey.parentElement.classList.contains("journey-frame")) {
      const frame = node("div", "journey-frame");
      journey.before(frame);
      frame.append(journey);
    }
    if (!journey.parentElement.querySelector(".journey-route")) {
      const route = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      route.classList.add("journey-route");
      route.setAttribute("aria-hidden", "true");
      route.setAttribute("preserveAspectRatio", "none");
      route.innerHTML = '<path class="journey-track"/><path class="journey-progress"/>';
      journey.parentElement.prepend(route);
    }
    journey.querySelectorAll(".tl-item").forEach(row => {
      if (row.querySelector(".journey-stop")) return;
      const stop = node("span", "journey-stop");
      stop.setAttribute("aria-hidden", "true");
      row.prepend(stop);
    });
    const finale = document.querySelector("#contact");
    if (!finale.querySelector(".final-rule")) {
      const rule = node("div", "final-rule");
      rule.setAttribute("aria-hidden", "true");
      rule.append(node("i", "final-left"), node("i", "final-right"));
      finale.querySelector(".cinema-contact-word").after(rule);
    }
    measureJourney();
  }

  function measureJourney() {
    const host = document.querySelector("#timeline");
    const route = host?.parentElement.querySelector(".journey-route");
    if (!route) return;
    const rows = [...host.querySelectorAll(".tl-item")];
    const points = rows.map(row => row.offsetTop + 45);
    const height = Math.max(host.offsetHeight, 1);
    route.setAttribute("viewBox", `0 0 32 ${height}`);
    let d = `M16 0`;
    points.forEach(y => { d += `V${Math.max(0, y - 18)}L25 ${y}L16 ${y + 18}`; });
    d += `V${height}`;
    route.querySelectorAll("path").forEach(path => path.setAttribute("d", d));
  }

  function directSpreads() {
    // About: ink passes through sentences, then marks the factual statistics.
    gsap.fromTo(".author-line", { color: "#6b6257", "--author-ink": 0 }, {
      color: "#171511", "--author-ink": 1, duration: 1, stagger: .35, ease: "none",
      scrollTrigger: { id: "spread-author", trigger: ".about-text", start: "top 90%", end: "top 48%", scrub: true },
    });
    document.querySelectorAll("#stats .stat").forEach(stat => gsap.fromTo(stat, { "--stat-mark": 0 }, {
      "--stat-mark": 1, ease: "none", scrollTrigger: { trigger: stat, start: "top 92%", end: "top 70%", scrub: true },
    }));
    // Skills: a bus connects each heading to its technology tokens.
    document.querySelectorAll(".skill-card").forEach((row, index) => {
      const tl = gsap.timeline({ scrollTrigger: { id: `spread-skill-${index}`, trigger: row, start: "top 92%", end: "top 58%", scrub: true } });
      tl.fromTo(row.querySelector(".skill-wire"), { scaleX: 0, transformOrigin: "left" }, { scaleX: 1, duration: .5, ease: "none" }, 0)
        .fromTo(row.querySelector(".skill-port"), { rotation: 0 }, { rotation: 90, duration: .3 }, .35)
        .fromTo(row.querySelectorAll(".tag"), { x: i => i % 2 ? 14 : -14, y: 8 }, { x: 0, y: 0, duration: .3, stagger: .055, ease: "power2.out" }, .3);
    });
    // Path: one continuous route with milestones; years remain in place.
    const route = document.querySelector(".journey-progress");
    const routeState = { progress: 0 };
    const paintRoute = () => {
      const length = route.getTotalLength();
      route.style.strokeDasharray = String(length);
      route.style.strokeDashoffset = String(length * (1 - routeState.progress));
    };
    gsap.fromTo(routeState, { progress: 0 }, { progress: 1, ease: "none", onUpdate: paintRoute,
      scrollTrigger: { id: "spread-journey", trigger: "#timeline", start: "top 85%", end: "bottom 65%", scrub: true, onRefresh: paintRoute },
    });
    document.querySelectorAll(".journey-stop").forEach(stop => gsap.fromTo(stop, { scale: .5, backgroundColor: "#080808" }, {
      scale: 1, backgroundColor: "#fa8b34", ease: "none",
      scrollTrigger: { trigger: stop.parentElement, start: "top 88%", end: "top 65%", scrub: true },
    }));
    // Contact: a typographic stamp opens from its baseline; rules split outwards.
    const finale = gsap.timeline({ scrollTrigger: { id: "spread-finale", trigger: ".cinema-contact-word", start: "top 92%", end: "top 55%", scrub: true } });
    finale.fromTo(".cinema-contact-word span", { scaleY: .25, transformOrigin: "center bottom" }, { scaleY: 1, duration: .5, stagger: .035, ease: "back.out(1.15)" }, 0)
      .fromTo(".final-left", { scaleX: 0, transformOrigin: "right" }, { scaleX: 1, duration: .5, ease: "none" }, .2)
      .fromTo(".final-right", { scaleX: 0, transformOrigin: "left" }, { scaleX: 1, duration: .5, ease: "none" }, .2);
    document.querySelectorAll("#contact .contact-link").forEach((link, index) => gsap.fromTo(link, { "--contact-line": 0 }, {
      "--contact-line": 1, duration: .6, delay: index * .08, ease: "power2.out",
      scrollTrigger: { trigger: link, start: "top 90%", once: true },
    }));
  }

  function draw(timeline, paths, at, duration, stagger = 0) {
    const targets = [...paths];
    targets.forEach((path, i) => {
      const length = path.getTotalLength();
      timeline.fromTo(path, { strokeDasharray: length, strokeDashoffset: length },
        { strokeDashoffset: 0, duration, ease: "none" }, at + i * stagger);
    });
  }

  function direct() {
    media?.revert();
    if (!window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);
    media = gsap.matchMedia();
    media.add({ desktop: "(min-width: 1000px)", mobile: "(max-width: 999px)", reduce: "(prefers-reduced-motion: reduce)" }, (scope) => {
      if (scope.conditions.reduce) return;
      const desktop = scope.conditions.desktop;
      gsap.to(".cover-name", { xPercent: -10, ease: "none", scrollTrigger: { trigger: "#home", start: "top top", end: "bottom top", scrub: true } });
      gsap.fromTo(".cinematic-slash", { scaleY: .15 }, { scaleY: 1, ease: "none", scrollTrigger: { trigger: "#home", start: "top top", end: "bottom 35%", scrub: true } });
      document.querySelectorAll(".story-project:not(.is-filtered)").forEach((card) => {
        const key = card.dataset.key;
        const art = card.querySelector(".scene-art");
        // The artwork completes while it is still visible, regardless of text height.
        const tl = gsap.timeline({ defaults: { ease: "power2.out" }, scrollTrigger: {
          id: `scene-${key}`, trigger: art, start: "top 92%", end: "center 60%", scrub: true,
          invalidateOnRefresh: true,
        } });
        if (key === "ciel") {
          tl.fromTo(card.querySelector(".agent-request"), { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: .25, ease: "none" }, 0)
            .fromTo(card.querySelectorAll(".agent-stream i"), { scaleX: 0, transformOrigin: "left" }, { scaleX: 1, duration: .18, stagger: .055, ease: "none" }, .18)
            .fromTo(card.querySelector(".agent-response"), { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: .25, ease: "none" }, .5)
            .fromTo(card.querySelector(".agent-status"), { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: .15 }, .75)
            .fromTo(card.querySelector(".agent-packet"), { xPercent: 0 }, { xPercent: 400, duration: .55, ease: "none" }, .18);
        } else if (key === "rigforge") {
          draw(tl, card.querySelectorAll(".rig-board > rect, .rig-board > path"), 0, .3);
          tl.fromTo(card.querySelector(".rig-cpu"), { y: -110 }, { y: 0, duration: .35, ease: "back.out(1.3)" }, .18)
            .fromTo(card.querySelector(".rig-ram"), { x: 110 }, { x: 0, duration: .3, ease: "power3.out" }, .4)
            .fromTo(card.querySelector(".rig-gpu"), { y: 95 }, { y: 0, duration: .3, ease: "power3.out" }, .58);
          draw(tl, card.querySelectorAll(".rig-wires path, .rig-callouts path"), .72, .28);
          tl.fromTo(card.querySelector(".rig-callouts"), { opacity: 0 }, { opacity: 1, duration: .18 }, .82);
        } else {
          const nodes = [...card.querySelectorAll(".graph-node")];
          tl.fromTo(card.querySelector(".graph-scan"), { scale: .25, opacity: 1, transformOrigin: "50% 50%" }, { scale: 3.8, opacity: 0, duration: .65, ease: "none" }, 0);
          draw(tl, card.querySelectorAll(".graph-lines path"), .12, .25, .08);
          nodes.slice(1).forEach((target, i) => {
            tl.fromTo(target, { opacity: 0 }, { opacity: 1, duration: .08, ease: "none" }, .28 + i * .08);
            tl.fromTo(target.querySelector("circle"), { fill: "#fa8b34" }, { fill: "#141210", duration: .22 }, .36 + i * .08);
          });
        }
      });
      directSpreads();
      if (desktop) document.querySelectorAll(".archive-project:not(.is-filtered)").forEach((card, i) => gsap.fromTo(card.querySelector(".project-title"), {
        clipPath: i % 2 ? "inset(0 100% 0 0)" : "inset(100% 0 0 0)",
      }, { clipPath: "inset(0% 0% 0% 0%)", duration: .45, scrollTrigger: { trigger: card, start: "top 90%", once: true } }));
      return () => {
        const route = document.querySelector(".journey-progress");
        route?.style.removeProperty("stroke-dasharray");
        route?.style.removeProperty("stroke-dashoffset");
      };
    });
    ScrollTrigger.refresh();
  }
  function mount() { media?.revert(); prepare(); direct(); }
  function refresh() {
    clearTimeout(refreshTimer);
    // Refresh measurements, never reset or replay the reader's current scene.
    refreshTimer = setTimeout(() => { measureJourney(); window.ScrollTrigger?.refresh(); }, 80);
  }
  function filter() {
    document.querySelectorAll(".project-index a").forEach((link) => {
      link.hidden = document.getElementById(link.hash.slice(1))?.classList.contains("is-filtered") ?? true;
    });
    const archive = document.querySelector(".archive-heading");
    if (archive) archive.hidden = !document.querySelector(".archive-project:not(.is-filtered)");
    direct();
  }
  document.addEventListener("portfolio:render", mount);
  document.addEventListener("portfolio:filter", filter);
  document.addEventListener("portfolio:project", refresh);
  // The accordion changes layout for .95s; measure its final height without a rebuild.
  document.querySelector("#projects").addEventListener("transitionend", event => {
    if (event.target.matches(".project-detail")) refresh();
  });
  window.addEventListener("load", refresh, { once: true });
  document.fonts?.ready.then(refresh);
  window.addEventListener("resize", refresh, { passive: true });
  mount();
})();
