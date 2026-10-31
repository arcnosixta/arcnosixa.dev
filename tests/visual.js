/* Local visual QA fixture, excluded from the build. It operates the same source
   document and exposes repeatable scroll positions through ordinary controls. */
(() => {
  const frame = document.getElementById("preview");
  const mode = document.getElementById("mode");
  const metrics = document.getElementById("metrics");
  const report = document.getElementById("report");
  const checks = document.getElementById("checks");
  let interval, revision = 0;
  window.qaError = (message) => { report.textContent += `${message}\n`; };
  function staticScene(score) {
    const scenes = [...frame.contentDocument.querySelectorAll("[data-story-at]")];
    return scenes.filter(scene => Number(scene.dataset.storyAt) <= score).at(-1) || scenes[0];
  }
  function renderedScore() {
    const transform = frame.contentDocument.querySelector(".story-progress span")?.style.transform || "";
    return Number(transform.match(/scaleX\(([^)]+)\)/)?.[1] || 0) * 160;
  }
  function seek(score) {
    const w = frame.contentWindow, trigger = w.ScrollTrigger?.getById("fate-story");
    if (trigger) w.scrollTo({ top: trigger.start + (trigger.end - trigger.start) * score / 160, behavior: "instant" });
    else staticScene(score)?.scrollIntoView({ behavior: "instant" });
  }
  function visible(element) {
    if (!element) return false;
    const w = frame.contentWindow, style = w.getComputedStyle(element), box = element.getBoundingClientRect();
    return Number(style.opacity) > .5 && style.visibility !== "hidden" && box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < w.innerHeight;
  }
  async function regression() {
    const button = document.getElementById("regression"), run = revision;
    const w = frame.contentWindow, d = frame.contentDocument, audio = w.qaAudio;
    checks.textContent = "Running…\n"; button.disabled = true;
    const check = (name, ok) => { checks.textContent += `${ok ? "PASS" : "FAIL"} ${name}\n`; };
    const settle = () => new Promise((resolve, reject) => {
      const until = performance.now() + 1300;
      function tick(now) {
        if (revision !== run) { reject(new Error("Case changed during the checks")); return; }
        if (now >= until) resolve(); else requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
    const at = async score => { seek(score); await settle(); };
    try {
      const motion = d.documentElement.classList.contains("enhanced");
      if (motion) {
        await at(92);
        check("Chapter II title is visible", visible(d.querySelector(".awakening-title")) && d.querySelector(".awakening-title").textContent.includes("ПРОБУЖДЕНИЕ"));
        await at(102);
        check("hands dissolve in the Ashes scene", d.querySelector(".chapter-name").textContent === "Ashes" && !visible(d.querySelector(".awakening-title")));
        await at(115);
        check("the solitary newborn has its own cue", visible(d.querySelector(".awakening-alone")));
        await at(130);
        check("the eye has its own chapter", d.querySelector(".chapter-name").textContent === "The eye" && Math.abs(renderedScore() - 130) < 1);
        await at(140);
        const claim = d.querySelector(".awakening-claim");
        check("the exact Russian claim is readable", visible(claim) && claim.innerText.replace(/\s+/g, " ").trim() === "Судьбу не получают. Её забирают.");
        await at(149);
        check("return remains inert while the eye closes", d.querySelector(".revelation").inert && !visible(d.querySelector(".revelation")));
        await at(157);
        const finale = d.querySelector(".revelation");
        check("TO BE CONTINUED appears after closing", visible(finale) && finale.querySelector(".reveal-name").textContent === "TO BE CONTINUED");
        check("final return becomes interactive", !finale.inert && visible(finale.querySelector(".return-link")));
        await at(92);
        check("reverse scroll restores the chapter title and gates the return", visible(d.querySelector(".awakening-title")) && finale.inert);
        await at(130);
        const oldTime = audio?.currentTime || 0, oldPlays = w.qaAudioPlays, wasPlaying = audio?.paused === false;
        d.querySelector(".still-toggle").click(); await settle();
        const eye = d.querySelector('.still-eye[data-story-at="126"]');
        check("motion to still preserves the eye scene", d.documentElement.classList.contains("is-still") && visible(eye) && Math.abs(eye.getBoundingClientRect().top) < 4);
        d.querySelector(".still-toggle").click(); await settle();
        check("still to motion restores the eye score", d.documentElement.classList.contains("enhanced") && Math.abs(renderedScore() - 126) < 1);
        check("view switches preserve the soundtrack without restarting", w.qaAudio === audio && w.qaAudioPlays === oldPlays && (audio?.currentTime || 0) >= oldTime - .1 && (!wasPlaying || audio.paused === false));
      } else {
        const scenes = [".still-awakening-title", ".still-ash", ".still-alone", ".still-eye", ".still-claim", ".still-ending"];
        check("every Chapter II scene exists in document flow", scenes.every(selector => d.querySelector(selector)?.getBoundingClientRect().height > 0));
        await at(130);
        check("static score selection reaches the eye", visible(d.querySelector(".still-eye")));
        await at(157);
        check("the static ending has a usable return", visible(d.querySelector(".still-ending .return-link")) && !d.querySelector(".still-ending").inert);
      }
      check("no story or shader errors", report.textContent.trim() === "");
      checks.textContent += "Complete.";
    } catch (error) { checks.textContent += `FAIL ${error.message}`; }
    finally { button.disabled = false; }
  }
  async function load() {
    revision++;
    clearInterval(interval);
    report.textContent = "";
    checks.textContent = "";
    metrics.textContent = "Loading…";
    const response = await fetch("../fate/");
    let html = await response.text();
    const setup = `<base href="${new URL("../fate/", location.href).href}"><script>
      try{localStorage.removeItem('fate-still')}catch{}
      window.addEventListener('error',e=>parent.qaError(e.message));
      window.addEventListener('unhandledrejection',e=>parent.qaError(String(e.reason)));
      const err=console.error;console.error=(...args)=>{parent.qaError(args.join(' '));err(...args)};
      const audio=window.Audio;window.qaAudioPlays=0;window.Audio=function(...args){const a=new audio(...args);window.qaAudio=a;const play=a.play.bind(a);a.play=(...args)=>{window.qaAudioPlays++;return play(...args)};return a};
      window.qaFPS=0;let start=performance.now(),n=0;function sample(t){n++;if(t-start>1800){window.qaFPS=Math.round(n*1000/(t-start));start=t;n=0}requestAnimationFrame(sample)}requestAnimationFrame(sample);
      ${mode.value === "reduced" ? "const mm=window.matchMedia;window.matchMedia=(q)=>q.includes('prefers-reduced-motion')?{matches:true,media:q,addEventListener(){},removeEventListener(){}}:mm.call(window,q);" : ""}
      ${mode.value === "no-webgl" ? "const gc=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return t.includes('webgl')?null:gc.call(this,t,...a)};" : ""}
      <\/script>`;
    html = html.replace("<head>", `<head>${setup}`);
    if (mode.value === "no-gsap") html = html.replace(/<script src="\.\.\/vendor\/(?:gsap|ScrollTrigger)\.min\.js"><\/script>/g, "");
    frame.onload = () => {
      interval = setInterval(() => {
        const w = frame.contentWindow, d = frame.contentDocument;
        const audio = w.qaAudio;
        const marker = d.querySelector(".chapter-name")?.textContent || "static";
        const caption = [...d.querySelectorAll(".caption")].filter(visible).map(e => e.textContent.trim().replace(/\s+/g, " ")).join(" / ");
        metrics.textContent = `${d.documentElement.className || 'static'} | ${w.innerWidth}×${w.innerHeight} | q${renderedScore().toFixed(1)} ${marker} | ${caption || "no caption"} | y${Math.round(w.scrollY)} | ${w.qaFPS || '…'}fps | ${audio?.paused === false ? 'playing' : 'silent'} ${(audio?.currentTime || 0).toFixed(1)}s`;
      }, 300);
    };
    frame.srcdoc = html;
  }
  document.getElementById("load").addEventListener("click", load);
  document.querySelectorAll("[data-score]").forEach(button => button.addEventListener("click", () => seek(Number(button.dataset.score))));
  document.getElementById("regression").addEventListener("click", regression);
  document.getElementById("lose-context").addEventListener("click", () => {
    const canvas = frame.contentDocument.querySelector("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  });
  load();
})();
