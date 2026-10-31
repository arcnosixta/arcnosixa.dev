/* Browser-only QA controls, deliberately excluded from production. */
(() => {
  const frame = document.getElementById("preview"), choice = document.getElementById("case");
  const errors = document.getElementById("errors"), metrics = document.getElementById("metrics");
  let timer;
  window.reportCreationError = text => { errors.textContent += `${text}\n`; };
  async function load() {
    clearInterval(timer); errors.textContent = ""; metrics.textContent = "Loading…";
    let html = await (await fetch("../")).text();
    const mode = choice.value;
    let setup = `<base href="${new URL("../", location.href).href}">`;
    if (mode === "no-js") html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
    else {
      setup += `<script>window.addEventListener('error',e=>parent.reportCreationError(e.message));window.addEventListener('unhandledrejection',e=>parent.reportCreationError(String(e.reason)));
        ${mode === "reduced" ? "const mm=matchMedia;window.matchMedia=q=>q.includes('prefers-reduced-motion')?{matches:true,media:q,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}:mm(q);" : ""}<\/script>`;
      if (mode === "studio" || mode === "atelier") html = html.replace('var requestedDesign = new URLSearchParams(location.search).get("design");', `var requestedDesign = "${mode}";`);
      if (mode === "no-gsap") html = html.replace(/<script src="vendor\/(?:gsap|ScrollTrigger)\.min\.js"><\/script>/g, "");
    }
    html = html.replace("<head>", `<head>${setup}`);
    frame.srcdoc = html;
    frame.onload = () => { timer = setInterval(() => {
      const w = frame.contentWindow, d = frame.contentDocument, chapter = d.querySelector(".creation-chapter");
      const triggers = w.ScrollTrigger?.getAll().filter(t => String(t.vars.id).startsWith("creation-")) || [];
      metrics.textContent = `${d.documentElement.dataset.design} | ${w.innerWidth}×${w.innerHeight} | intro ${d.getElementById("cinematicIntro")?.dataset.stage || "none"} | triggers ${triggers.length} | ${chapter ? w.getComputedStyle(chapter).getPropertyValue("--creation-accent") : "none"} | y${Math.round(w.scrollY)}`;
    }, 250); };
  }
  document.getElementById("load").addEventListener("click", load);
  document.getElementById("skip").addEventListener("click", () => frame.contentDocument.getElementById("introSkip")?.click());
  document.getElementById("replay").addEventListener("click", () => frame.contentDocument.getElementById("introReplay")?.click());
  document.querySelectorAll("[data-position]").forEach(button => button.addEventListener("click", () => {
    const w = frame.contentWindow, trigger = w.ScrollTrigger?.getById("creation-chapter");
    const max = trigger ? trigger.end : frame.contentDocument.getElementById("home").offsetHeight - w.innerHeight * .85;
    w.scrollTo({ top: Math.max(0, max) * Number(button.dataset.position), behavior: "instant" });
  }));
  load();
})();
