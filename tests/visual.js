/* Local visual QA fixture, excluded from the build. It operates the same source
   document and exposes repeatable scroll positions through ordinary controls. */
(() => {
  const frame = document.getElementById("preview");
  const mode = document.getElementById("mode");
  const metrics = document.getElementById("metrics");
  const report = document.getElementById("report");
  const checks = document.getElementById("checks");
  const query = new URLSearchParams(location.search);
  if ([...mode.options].some(option => option.value === query.get("mode"))) mode.value = query.get("mode");
  if (query.has("preview")) {
    document.body.classList.add("frame-only");
    const style = document.createElement("style");
    style.textContent = ".frame-only{display:block}.frame-only>nav,.frame-only>details{display:none}.frame-only iframe{height:100vh}";
    document.head.append(style);
    for (const dimension of ["width", "height"]) {
      const size = Number(query.get(dimension));
      if (size >= 320 && size <= 3000) frame.style[dimension] = `${size}px`;
    }
  }
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
  function luminance(color) {
    const rgb = color.match(/[\d.]+/g)?.slice(0, 3).map(Number) || [];
    const channels = rgb.map(value => { const v = value / 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
    return channels.length === 3 ? channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722 : NaN;
  }
  function paperContrast(scene, text) {
    const w = frame.contentWindow, background = luminance(w.getComputedStyle(scene).backgroundColor), ink = luminance(w.getComputedStyle(text).color);
    return background > .75 && ink < .2 && (background + .05) / (ink + .05) >= 4.5;
  }
  async function regression() {
    const button = document.getElementById("regression"), run = revision;
    const w = frame.contentWindow, d = frame.contentDocument, audio = w.qaAudio;
    const paper = () => Number.parseFloat(w.getComputedStyle(d.documentElement).getPropertyValue("--fate-paper"));
    checks.textContent = "Running…\n"; button.disabled = true;
    const check = (name, ok) => {
      const line = `${ok ? "PASS" : "FAIL"} ${name}`;
      checks.textContent += `${line}\n`;
      if (query.has("run")) console.log(`FATE_QA_CHECK ${line}`);
    };
    const settle = () => new Promise((resolve, reject) => {
      if (query.has("run")) {
        setTimeout(() => {
          w.ScrollTrigger?.update();
          w.ScrollTrigger?.getById("fate-story")?.getTween()?.progress(1);
          resolve();
        }, 1300);
        return;
      }
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
        check("the world remains dark before ignition", paper() === 0 && !d.documentElement.classList.contains("is-paper"));
        await at(102);
        check("hands dissolve in the Ashes scene", d.querySelector(".chapter-name").textContent === "Ashes" && !visible(d.querySelector(".awakening-title")));
        await at(106); const flood = paper();
        await at(112); const engulf = paper();
        check("the white front advances continuously", flood > 0 && flood < 1 && engulf > flood && engulf <= 1);
        await at(115);
        check("the solitary newborn has its own cue", visible(d.querySelector(".awakening-alone")));
        await at(118);
        check("the white world is complete after engulfment", Math.abs(paper() - 1) < .001 && d.documentElement.classList.contains("is-paper"));
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
        check("the ending keeps the white world", Math.abs(paper() - 1) < .001 && d.documentElement.classList.contains("is-paper"));
        await at(92);
        check("reverse scroll restores the chapter title and gates the return", visible(d.querySelector(".awakening-title")) && finale.inert);
        check("reverse scroll restores the dark world", paper() === 0 && !d.documentElement.classList.contains("is-paper"));
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
        const eye = d.querySelector(".still-eye");
        check("the static eye uses dark readable ink on white", paperContrast(eye, eye.querySelector("figcaption")));
        await at(157);
        check("the static ending has a usable return", visible(d.querySelector(".still-ending .return-link")) && !d.querySelector(".still-ending").inert);
        const ending = d.querySelector(".still-ending");
        check("the static final return has readable contrast", paperContrast(ending, ending.querySelector(".return-link")));
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
      if (!frame.contentDocument.querySelector("#written-story")) return;
      interval = setInterval(() => {
        const w = frame.contentWindow, d = frame.contentDocument;
        const audio = w.qaAudio;
        const marker = d.querySelector(".chapter-name")?.textContent || "static";
        const caption = [...d.querySelectorAll(".caption")].filter(visible).map(e => e.textContent.trim().replace(/\s+/g, " ")).join(" / ");
        const paper = Number.parseFloat(w.getComputedStyle(d.documentElement).getPropertyValue("--fate-paper"));
        metrics.textContent = `${d.documentElement.className || 'static'} | ${w.innerWidth}×${w.innerHeight} | q${renderedScore().toFixed(1)} ${marker} | paper ${Number.isFinite(paper) ? paper.toFixed(3) : "static"} | ${caption || "no caption"} | y${Math.round(w.scrollY)} | ${w.qaFPS || '…'}fps | ${audio?.paused === false ? 'playing' : 'silent'} ${(audio?.currentTime || 0).toFixed(1)}s`;
      }, 300);
      // CLI browser QA can load a reproducible scene without automating an app UI.
      if (query.has("score") || query.has("run")) {
        setTimeout(async () => {
          // Virtual-time CLI captures should not lag behind their clock jumps.
          const w = frame.contentWindow;
          await new Promise(resolve => {
            const poll = setInterval(() => {
              const staticMode = mode.value !== "motion";
              const artwork = w.performance.getEntriesByType("resource").filter(entry => /assets\/fate\/(newborn|hands-atlas|congregation)\.png/.test(entry.name));
              if ((staticMode && frame.contentDocument.querySelector(".still-ending")) || (w.ScrollTrigger?.getById("fate-story") && artwork.length >= 3)) {
                clearInterval(poll); resolve();
              }
            }, 50);
          });
          w.gsap?.ticker.lagSmoothing(0);
          w.gsap?.getTweensOf(".captions").forEach(tween => tween.totalProgress(1));
          const style = frame.contentDocument.createElement("style");
          style.textContent = ".fate-hud,.sound-control{animation:none!important;opacity:1!important}";
          frame.contentDocument.head.append(style);
          if (query.has("run")) await regression();
          else {
            w.ScrollTrigger?.refresh();
            seek(Number(query.get("score")));
            w.ScrollTrigger?.update();
            w.ScrollTrigger?.getById("fate-story")?.animation.progress(Number(query.get("score")) / 160);
          }
          setTimeout(() => {
            document.body.dataset.qaReady = "true";
            console.log("FATE_QA_RESULT " + JSON.stringify({ checks: checks.textContent, errors: report.textContent,
              score: renderedScore(), paper: frame.contentWindow.getComputedStyle(frame.contentDocument.documentElement).getPropertyValue("--fate-paper"),
              viewport: [frame.contentWindow.innerWidth, frame.contentWindow.innerHeight] }));
          }, 1800);
        }, 3000);
      }
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
