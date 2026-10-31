/* Local integration fixture: operate the real page, report measured scroll geometry. */
(() => {
  const frame = document.getElementById("preview"), mode = document.getElementById("mode"), choice = document.getElementById("scene");
  const metrics = document.getElementById("metrics"), errors = document.getElementById("errors"), report = document.getElementById("report");
  let timer;
  window.mainQAError = text => { errors.textContent += `${text}\n`; };
  const aliases = { "creation-chapter": "#home", "scene-ciel": "#project-ciel", "scene-rigforge": "#project-rigforge", "scene-osint-portal": "#project-osint-portal", "motion-about": "#about", "spread-author": ".about-text", "motion-skills": "#skills", "motion-skill-0": ".skill-card", "motion-path": "#path", "motion-contact": "#contact", "spread-finale": ".cinema-contact-word" };
  function selected() {
    const st = frame.contentWindow.ScrollTrigger;
    return st?.getById(choice.value) || (choice.value === "motion-path" ? st?.getById("motion-path-0") : null);
  }
  function audit() {
    const w = frame.contentWindow, d = frame.contentDocument, triggers = w.ScrollTrigger?.getAll() || [];
    const checks = [];
    const add = (name, ok, detail) => checks.push(`${ok ? "PASS" : "FAIL"} ${name}: ${detail}`);
    for (const key of ["ciel", "rigforge", "osint-portal"]) {
      const t = w.ScrollTrigger?.getById(`scene-${key}`);
      if (!t) continue;
      const top = t.trigger.getBoundingClientRect().top + w.scrollY;
      const drift = Math.round(t.start - (top - w.innerHeight * .92));
      add(`${key} scroll alignment`, Math.abs(drift) <= 3, `${drift}px drift`);
    }
    const history = w.ScrollTrigger?.getById("motion-path");
    if (history) {
      const frame = d.querySelector(".journey-frame"), spacer = frame.parentElement;
      const top = spacer.getBoundingClientRect().top + w.scrollY;
      const drift = Math.round(history.start - (top - w.innerHeight * .15));
      add("history pin alignment", Math.abs(drift) <= 3, `${drift}px drift`);
      const heading = d.querySelector("#path .spread-word").getBoundingClientRect();
      const box = frame.getBoundingClientRect();
      add("history heading clear of cards", heading.bottom <= box.top + 2 || heading.top >= box.bottom, `${Math.round(heading.bottom)}px heading bottom / ${Math.round(box.top)}px cards top`);
      if (history.progress > .999) {
        const last = d.querySelector("#timeline .tl-item:last-child").getBoundingClientRect();
        add("last milestone reachable", last.right <= box.right + 3 && last.left >= box.left - 3, `${Math.round(last.right - box.right)}px right overflow`);
      }
    }
    const ids = triggers.map(t => t.vars.id).filter(Boolean);
    add("unique scene IDs", new Set(ids).size === ids.length, `${ids.length} IDs / ${triggers.length} triggers`);
    add("no horizontal page overflow", d.documentElement.scrollWidth <= w.innerWidth, `${d.documentElement.scrollWidth}/${w.innerWidth}`);
    if (mode.value === "reduced" || mode.value === "no-gsap") add("static history", !d.querySelector(".journey-camera"), "all milestones in document flow");
    report.textContent = checks.join("\n");
    return checks.filter(c => c.startsWith("FAIL")).length;
  }
  async function regression() {
    const button = document.getElementById("regression"), output = document.getElementById("checks");
    const w = frame.contentWindow, d = frame.contentDocument, st = w.ScrollTrigger;
    button.disabled = true; output.textContent = "Running…\n";
    const check = (name, ok) => { output.textContent += `${ok ? "PASS" : "FAIL"} ${name}\n`; };
    const settle = () => new Promise(resolve => {
      const until = performance.now() + 750;
      function tick(now) { if (now >= until) resolve(); else requestAnimationFrame(tick); }
      requestAnimationFrame(tick);
    });
    const seek = async (t, p) => { w.scrollTo({ top: Math.max(0, t.start + (t.end - t.start) * p), behavior: "instant" }); await settle(); };
    try {
      if (!st?.getById("motion-about")) {
        check("all four history milestones visible in static flow", [...d.querySelectorAll(".tl-item")].every(e => e.getBoundingClientRect().height > 0) && !d.querySelector(".journey-camera"));
        check("static content is readable", [...d.querySelectorAll(".about-text, .skill-card, .contact-card")].every(e => Number(w.getComputedStyle(e).opacity) === 1));
      } else {
        // Compare rendered states at entry, completion and reverse, not implementation strings.
        const probes = [
          ["scene-ciel", ".agent-request", e => w.getComputedStyle(e).clipPath, "Ciel request reveal"],
          ["scene-rigforge", ".rig-cpu", e => e.getAttribute("transform"), "RigForge component assembly"],
          ["scene-osint-portal", ".graph-node:nth-of-type(4)", e => w.getComputedStyle(e).opacity, "OSINT graph reveal"],
          ["spread-author", ".author-line", e => w.getComputedStyle(e).getPropertyValue("--author-ink"), "author ink"],
          ["motion-skill-0", ".skill-wire", e => w.getComputedStyle(e).transform, "skill bus drawing"],
          ["spread-finale", ".cinema-contact-word span", e => w.getComputedStyle(e).transform, "contact lettering"],
        ];
        for (const [id, selector, read, name] of probes) {
          const t = st.getById(id), e = d.querySelector(selector);
          if (!t || !e) { check(`${name} available`, false); continue; }
          await seek(t, 0); const before = read(e);
          await seek(t, 1); const after = read(e);
          check(`${name} animates while visible`, before !== after && e.getBoundingClientRect().bottom > 0 && e.getBoundingClientRect().top < w.innerHeight);
          await seek(t, 0); check(`${name} reverses`, read(e) === before);
        }
        const t = st.getById("motion-path") || st.getById("spread-journey");
        await seek(t, 0); const track = d.querySelector("#timeline"), start = track.getBoundingClientRect().left;
        const route = d.querySelector(".journey-progress"), ink = route.style.strokeDashoffset;
        await seek(t, 1);
        check("history traverses every milestone", st.getById("motion-path") ? track.getBoundingClientRect().left < start && audit() === 0 : route.style.strokeDashoffset !== ink);
        check("statistics reach their actual values", [...d.querySelectorAll(".stat-value[data-count]")].every(e => Number(e.textContent) === Number(e.dataset.count)));
        check("geometry survives complete forward and reverse traversal", audit() === 0);
      }
      output.textContent += "Complete.";
    } catch (error) { output.textContent += `FAIL ${error.message}`; }
    finally { button.disabled = false; }
  }
  async function load() {
    clearInterval(timer); errors.textContent = ""; report.textContent = ""; document.getElementById("checks").textContent = ""; metrics.textContent = "Loading…";
    let html = await (await fetch("../")).text();
    let setup = `<base href="${new URL("../", location.href).href}"><script>window.addEventListener('error',e=>parent.mainQAError(e.message));window.addEventListener('unhandledrejection',e=>parent.mainQAError(String(e.reason)));`;
    if (mode.value === "reduced") setup += "const mm=matchMedia;window.matchMedia=q=>q.includes('prefers-reduced-motion')?{matches:true,media:q,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}:mm(q);";
    setup += "<\/script>";
    html = html.replace("<head>", `<head>${setup}`).replace('window.arcReturnFromVoid = sessionStorage.getItem("arc-void-return") === "1";', 'window.arcReturnFromVoid = true;');
    if (["studio", "atelier"].includes(mode.value)) html = html.replace('var requestedDesign = new URLSearchParams(location.search).get("design");', `var requestedDesign = "${mode.value}";`);
    if (mode.value === "no-gsap") html = html.replace(/<script src="vendor\/(?:gsap|ScrollTrigger)\.min\.js"><\/script>/g, "");
    frame.onload = () => { timer = setInterval(() => {
      const w = frame.contentWindow, t = selected();
      metrics.textContent = `${w.innerWidth}×${w.innerHeight} | y${Math.round(w.scrollY)} | ${choice.value} ${t ? `${t.progress.toFixed(3)} (${Math.round(t.start)}–${Math.round(t.end)})` : "static"} | ${audit()} failures`;
    }, 300); };
    frame.srcdoc = html;
  }
  document.getElementById("load").addEventListener("click", load);
  document.getElementById("audit").addEventListener("click", audit);
  document.getElementById("regression").addEventListener("click", regression);
  document.querySelectorAll("[data-progress]").forEach(button => button.addEventListener("click", () => {
    const w = frame.contentWindow, t = selected(), p = Number(button.dataset.progress);
    const target = frame.contentDocument.querySelector(aliases[choice.value]);
    w.scrollTo({ top: t ? t.start + (t.end - t.start) * p : target.getBoundingClientRect().top + w.scrollY - w.innerHeight * .15, behavior: "instant" });
  }));
  document.getElementById("language").addEventListener("click", () => frame.contentDocument.getElementById("langToggle").click());
  document.getElementById("filter").addEventListener("click", () => {
    const filters = [...frame.contentDocument.querySelectorAll(".filter")];
    (filters[0].getAttribute("aria-pressed") === "true" ? filters[1] : filters[0]).click();
  });
  document.getElementById("accordion").addEventListener("click", () => frame.contentDocument.querySelector("#project-ciel .project-toggle").click());
  document.getElementById("replay").addEventListener("click", () => frame.contentDocument.getElementById("introReplay").click());
  load();
})();
