/* One diagonal thread connects the cover, project scenes and final spread. */
(() => {
  "use strict";
  const root = document.documentElement;
  if (root.dataset.design !== "cinematic") return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  let media, refreshTimer;
  const featured = ["ciel", "rigforge", "osint-portal"];
  const node = (tag, cls, text) => {
    const el = document.createElement(tag);
    el.className = cls;
    if (text) el.textContent = text;
    return el;
  };
  const illustrations = {
    ciel: `<div class="agent-window"><div class="agent-bar"><i></i><i></i><i></i><span>CIEL / LOCAL WORKSPACE</span></div><div class="agent-request scene-piece"><span>01 / INPUT</span><b>workspace → agent</b><code>POST /session</code></div><div class="agent-stream"><i class="scene-piece"></i><i class="scene-piece"></i><i class="scene-piece"></i><i class="scene-piece"></i><i class="scene-piece"></i></div><div class="agent-response scene-piece"><span>02 / STREAM</span><b>JSON + SSE</b><code>session → event → interface</code></div><div class="agent-status scene-piece">● LOOPBACK ONLY <span>~40 EVENTS</span></div></div><span class="scene-notation">REQUEST / BRIDGE / RESPONSE</span>`,
    rigforge: `<svg class="rig-drawing" viewBox="0 0 600 540" fill="none"><g class="rig-wires" stroke="currentColor"><path d="M100 275H240V170H340M300 330V460H440V350M130 390H210V300M340 240H470V170"/></g><g class="scene-piece rig-board"><rect x="140" y="95" width="330" height="350" rx="8"/><path d="M155 105H455V435H155Z" stroke-dasharray="3 7"/></g><g class="scene-piece rig-cpu"><rect x="235" y="180" width="120" height="120" rx="4"/><rect x="255" y="200" width="80" height="80"/><text x="295" y="246">CPU</text></g><g class="scene-piece rig-ram"><rect x="390" y="140" width="22" height="190"/><rect x="425" y="140" width="22" height="190"/><text x="420" y="365">RAM</text></g><g class="scene-piece rig-gpu"><rect x="180" y="340" width="180" height="52"/><path d="M200 355H340M200 365H340M200 375H340"/><text x="270" y="425">GPU</text></g><g class="rig-callouts"><path d="M235 180L130 55H40M355 240H535M180 365H40"/><text x="40" y="40">SOCKET / CHECK</text><text x="450" y="225">POWER</text><text x="40" y="350">FORM FACTOR</text></g></svg><span class="scene-notation">CATALOG / COMPATIBILITY / BUILD</span>`,
    "osint-portal": `<svg class="graph-drawing" viewBox="0 0 600 540" fill="none"><g class="graph-lines" stroke="currentColor"><path d="M300 270L120 130M300 270L480 100M300 270L500 350M300 270L190 450M300 270L70 310M120 130L480 100M190 450L500 350"/></g><g class="scene-piece graph-node"><circle cx="300" cy="270" r="58"/><text x="300" y="275">TARGET</text></g><g class="scene-piece graph-node"><circle cx="120" cy="130" r="36"/><text x="120" y="135">DNS</text></g><g class="scene-piece graph-node"><circle cx="480" cy="100" r="40"/><text x="480" y="105">WHOIS</text></g><g class="scene-piece graph-node"><circle cx="500" cy="350" r="36"/><text x="500" y="355">TLS</text></g><g class="scene-piece graph-node"><circle cx="190" cy="450" r="42"/><text x="190" y="455">EVIDENCE</text></g><g class="scene-piece graph-node"><circle cx="70" cy="310" r="28"/><text x="70" y="315">IP</text></g></svg><span class="scene-notation">RUN / EVIDENCE / GRAPH</span>`,
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
    document.querySelectorAll(".skill-card").forEach((card, i) => card.style.setProperty("--skill-index", i));
  }

  function direct() {
    media?.revert();
    if (!window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);
    media = gsap.matchMedia();
    media.add({ desktop: "(min-width: 1000px) and (min-height: 700px)", mobile: "(max-width: 999px), (max-height: 699px)", reduce: "(prefers-reduced-motion: reduce)" }, (scope) => {
      if (scope.conditions.reduce) return;
      const desktop = scope.conditions.desktop;
      gsap.to(".cover-name", { xPercent: -10, ease: "none", scrollTrigger: { trigger: "#home", start: "top top", end: "bottom top", scrub: true } });
      gsap.fromTo(".cinematic-slash", { scaleY: .15 }, { scaleY: 1, ease: "none", scrollTrigger: { trigger: "#home", start: "top top", end: "bottom 35%", scrub: true } });
      document.querySelectorAll(".story-project:not(.is-filtered)").forEach((card) => {
        const stage = card.querySelector(".scene-stage");
        const pieces = card.querySelectorAll(".scene-piece");
        const key = card.dataset.key;
        const tl = gsap.timeline({ scrollTrigger: {
          id: `scene-${key}`, trigger: card, start: desktop ? "top 6%" : "top 75%",
          end: desktop ? () => `+=${innerHeight * .8}` : "center 40%", scrub: true,
          pin: desktop && !card.classList.contains("is-open") && stage.offsetHeight < innerHeight * .94 ? stage : false, invalidateOnRefresh: true,
        } });
        tl.fromTo(pieces, {
          x: (i) => key === "rigforge" ? (i % 2 ? 75 : -75) : 0,
          y: (i) => key === "rigforge" ? -45 - i * 10 : key === "ciel" ? 18 : 0,
          scale: key === "osint-portal" ? .5 : 1, opacity: .12, transformOrigin: "50% 50%",
        }, { x: 0, y: 0, scale: 1, opacity: 1, duration: .7, stagger: .08, ease: "power2.out" }, 0)
          .fromTo(card.querySelector(".scene-seam"), { scaleX: .05 }, { scaleX: 1, duration: 1, ease: "none" }, 0)
          .fromTo(card.querySelector(".scene-contribution"), { x: 14, opacity: .65 }, { x: 0, opacity: 1, duration: .4 }, .3);
        const lines = card.querySelector(".graph-lines path");
        if (lines) {
          const length = lines.getTotalLength();
          tl.fromTo(lines, { strokeDasharray: length, strokeDashoffset: length }, { strokeDashoffset: 0, duration: .8, ease: "none" }, 0);
        }
      });
      document.querySelectorAll(".spread-seam").forEach((line) => gsap.fromTo(line, { scaleX: .05 }, { scaleX: 1, ease: "none", scrollTrigger: { trigger: line.parentElement, start: "top 85%", end: "top 25%", scrub: true } }));
      document.querySelectorAll(".skill-card, .tl-item").forEach((row) => gsap.from(row, { x: desktop ? 45 : 15, duration: .6, ease: "power2.out", scrollTrigger: { trigger: row, start: "top 88%", once: true } }));
      gsap.fromTo(".cinema-contact-word", { yPercent: 20, opacity: .3 }, { yPercent: 0, opacity: 1, ease: "none", scrollTrigger: { trigger: "#contact", start: "top 85%", end: "top 20%", scrub: true } });
    });
    ScrollTrigger.refresh();
  }
  function mount() { media?.revert(); prepare(); direct(); }
  function schedule() { clearTimeout(refreshTimer); refreshTimer = setTimeout(direct, 1000); }
  document.addEventListener("portfolio:render", mount);
  document.addEventListener("portfolio:filter", mount);
  document.addEventListener("portfolio:project", schedule);
  window.addEventListener("load", schedule, { once: true });
  document.fonts?.ready.then(schedule);
  mount();
})();
