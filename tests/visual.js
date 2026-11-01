/* Local visual QA fixture, excluded from the build. It operates the same source
   document and exposes repeatable scroll positions through ordinary controls. */
(() => {
  const frame = document.getElementById("preview");
  const mode = document.getElementById("mode");
  const metrics = document.getElementById("metrics");
  const report = document.getElementById("report");
  const checks = document.getElementById("checks");
  const scoreLength = () => frame.contentWindow.FateScore?.length || 377;
  const scoreForCue = cue => frame.contentWindow.FateScore.at(cue);
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
    return scenes.filter(scene => Number(scene.dataset.storyStart || scene.dataset.storyAt) <= score).at(-1) || scenes[0];
  }
  function renderedScore() {
    const transform = frame.contentDocument.querySelector(".story-progress span")?.style.transform || "";
    return Number(transform.match(/scaleX\(([^)]+)\)/)?.[1] || 0) * scoreLength();
  }
  function seek(score) {
    const w = frame.contentWindow, trigger = w.ScrollTrigger?.getById("fate-story");
    if (trigger) w.scrollTo({ top: trigger.start + (trigger.end - trigger.start) * score / scoreLength(), behavior: "instant" });
    else staticScene(score)?.scrollIntoView({ behavior: "instant" });
  }
  function visible(element) {
    if (!element) return false;
    const w = frame.contentWindow, style = w.getComputedStyle(element), box = element.getBoundingClientRect();
    let opacity = 1;
    for (let parent = element; parent; parent = parent.parentElement) {
      const computed = w.getComputedStyle(parent);
      if (computed.display === "none") return false;
      opacity *= Number(computed.opacity);
    }
    return opacity > .5 && style.visibility !== "hidden" && box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < w.innerHeight;
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
          try {
            if (revision !== run) throw new Error("Case changed during the checks");
            w.ScrollTrigger?.update();
            // A trigger with scrubDuration(0) may return false rather than a
            // tween. A missing tween is already settled, not an error.
            w.ScrollTrigger?.getById("fate-story")?.getTween()?.progress?.(1);
            w.gsap?.getTweensOf(".captions").forEach(tween => tween.totalProgress(1));
            resolve();
          } catch (error) { reject(error); }
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
    const at = async score => {
      seek(score); await settle();
      // Headless virtual time may skip RAF ticks. Seek the real story timeline
      // explicitly after scrolling so DOM assertions observe the requested cue.
      if (query.has("run")) frame.contentWindow.ScrollTrigger?.getById("fate-story")?.animation.progress(score / scoreLength());
    };
    const atCue = cue => at(scoreForCue(cue));
    try {
      const motion = d.documentElement.classList.contains("enhanced");
      check("the removed chapter title is absent from every story mode", !d.querySelector(".awakening-title, .still-awakening-title") && !d.body.textContent.toUpperCase().includes("ПРОБУЖДЕНИЕ"));
      if (mode.value === "motion") check("requested motion renderer starts", motion);
      if (motion) {
        await at(84.9); const beforeBridge = Number(w.getComputedStyle(d.querySelector(".whiteout")).opacity);
        await at(85.8); const duringBridge = Number(w.getComputedStyle(d.querySelector(".whiteout")).opacity);
        await at(87); const afterBridge = Number(w.getComputedStyle(d.querySelector(".whiteout")).opacity);
        check("the flash fades continuously into ash without an intermission", beforeBridge > duringBridge && duringBridge > afterBridge && afterBridge === 0 && !d.documentElement.classList.contains("is-void") && ![...d.querySelectorAll(".caption")].some(visible));
        check("the world remains dark before ignition", paper() === 0 && !d.documentElement.classList.contains("is-paper"));
        await atCue(102);
        check("hands dissolve in the Ashes scene", d.querySelector(".chapter-name").textContent === "Ashes");
        await atCue(106); const flood = paper();
        await atCue(112); const engulf = paper();
        check("the white front advances continuously", flood > 0 && flood < 1 && engulf > flood && engulf <= 1);
        await atCue(118);
        check("the white world is complete after engulfment", Math.abs(paper() - 1) < .001 && d.documentElement.classList.contains("is-paper"));
        await atCue(120);
        const stage = d.querySelector("#stage");
        const notes = [...d.querySelectorAll(".journey-notes > *")];
        check("the white void has no captions or journey notes", Math.abs(paper() - 1) < .001 && stage.dataset.journeyPhase === "void" && d.documentElement.classList.contains("is-void") && ![...d.querySelectorAll(".caption, .journey-notes")].some(visible) && !notes.some(visible));
        await atCue(138);
        check("the katana leaves the blank void without early notes", stage.dataset.journeyPhase === "fall" && !d.documentElement.classList.contains("is-void") && Math.abs(renderedScore() - scoreForCue(138)) < 1 && !notes.some(visible));
        for (const [score, selector, name, facts] of [
          [160, ".note-architecture", "architecture", ["границы модулей, API и движение данных", "систему с понятной логикой"]],
          [173, ".note-services", "services", ["серверной логикой, локальными сервисами", "интеграциями ИИ-агентов"]],
          [186, ".note-craft", "craft", ["устройстве Linux", "объяснить, проверить и развивать"]],
        ]) {
          await atCue(score);
          const note = d.querySelector(selector), text = note?.innerText.replace(/\s+/g, " ").trim() || "";
          const box = note?.getBoundingClientRect();
          check(`${name} note has readable factual copy`, stage.dataset.journeyPhase === "blade" && visible(note) && facts.every(fact => text.includes(fact)));
          check(`${name} note stays inside the viewport and appears alone`, Boolean(box) && box.left >= 0 && box.right <= w.innerWidth + 1 && box.top >= 0 && box.bottom <= w.innerHeight + 1 && notes.filter(visible).length === 1);
        }
        await atCue(200);
        check("the katana reaches the ground before the meadow", stage.dataset.journeyPhase === "ground" && Math.abs(renderedScore() - scoreForCue(200)) < 1 && !notes.some(visible));
        await atCue(215);
        const grovePhase = stage.dataset.journeyPhase;
        check("the meadow begins with a clear white field", grovePhase === "meadow" && paper() === 1 && !notes.some(visible));
        await atCue(230);
        check("the horizontal meadow continues without early return", stage.dataset.journeyPhase === grovePhase && d.querySelector(".revelation").inert && !visible(d.querySelector(".revelation")));
        const finale = d.querySelector(".revelation");
        check("the real child model finishes loading before the camera visits him", stage.dataset.witnessReady === "true");
        for (const [cue, phase, shot] of [[238, "witness-approach", "meadow approach"], [250, "witness-rise", "first foot"], [283, "witness-back", "back and katana"], [310, "witness-orbit", "rising orbit"], [330, "witness-face", "frontal face"]]) {
          await atCue(cue);
          check(`${shot} has no early captions, notes or return`, stage.dataset.journeyPhase === phase && stage.dataset.witnessReady === "true" && paper() === 1 && ![...d.querySelectorAll(".caption, .journey-notes")].some(visible) && !notes.some(visible) && finale.inert && !visible(finale));
        }
        await atCue(338);
        check("the ending appears after the final face shot", stage.dataset.journeyPhase === "witness-face" && visible(finale) && finale.querySelector(".reveal-name").textContent.trim().length > 0);
        check("final return becomes interactive", !finale.inert && visible(finale.querySelector(".return-link")));
        check("the ending keeps the white world", Math.abs(paper() - 1) < .001 && d.documentElement.classList.contains("is-paper"));
        await at(85.8);
        check("reverse scroll restores the flash bridge and gates the return", Number(w.getComputedStyle(d.querySelector(".whiteout")).opacity) > 0 && finale.inert && !d.querySelector(".awakening-title"));
        check("reverse scroll restores the dark world", paper() === 0 && !d.documentElement.classList.contains("is-paper"));
        await atCue(215);
        const oldTime = audio?.currentTime || 0, oldPlays = w.qaAudioPlays, wasPlaying = audio?.paused === false;
        d.querySelector(".still-toggle").click(); await settle();
        const grove = d.querySelector(".still-grove");
        check("motion to still preserves the grove scene", d.documentElement.classList.contains("is-still") && visible(grove) && Math.abs(grove.getBoundingClientRect().top) < 4);
        d.querySelector(".still-toggle").click(); await settle();
        check("still to motion restores the grove score", d.documentElement.classList.contains("enhanced") && Math.abs(renderedScore() - scoreForCue(218)) < 1);
        check("view switches preserve the soundtrack without restarting", w.qaAudio === audio && w.qaAudioPlays === oldPlays && (audio?.currentTime || 0) >= oldTime - .1 && (!wasPlaying || audio.paused === false));
      } else {
        const cues = [99, 116, 134, 158, 172, 186, 199, 218, 250, 281, 330, 336];
        check("every katana, meadow and child scene exists in document flow", cues.every(cue => d.querySelector(`[data-story-at="${scoreForCue(cue)}"]`)?.getBoundingClientRect().height > 0));
        await atCue(120);
        check("static score selection reaches the white void", visible(d.querySelector(".still-void")));
        await atCue(230);
        check("static score selection reaches the meadow", visible(d.querySelector(".still-grove")));
        const grove = d.querySelector(".still-grove");
        check("the static meadow uses dark readable ink on white", paperContrast(grove, grove.querySelector("figcaption")));
        for (const [cue, shot] of [[250, "foot"], [281, "back"], [330, "face"]]) {
          await atCue(cue);
          const scene = d.querySelector(`[data-story-at="${scoreForCue(cue)}"]`);
          check(`the static child ${shot} shot exists before the ending`, visible(scene) && Boolean(scene.querySelector("svg, img")) && !visible(d.querySelector(".still-ending")));
        }
        await atCue(338);
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
      try{localStorage.removeItem('fate-still');history.scrollRestoration='manual'}catch{}
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
        const caption = [...d.querySelectorAll(".caption, .journey-notes > *")].filter(visible).map(e => e.textContent.trim().replace(/\s+/g, " ")).join(" / ");
        const paper = Number.parseFloat(w.getComputedStyle(d.documentElement).getPropertyValue("--fate-paper"));
        metrics.textContent = `${d.documentElement.className || 'static'} | ${w.innerWidth}×${w.innerHeight} | q${renderedScore().toFixed(1)}/${scoreLength()} cue${w.FateScore?.cue(renderedScore()).toFixed(1) || "…"} ${marker} ${d.querySelector("#stage")?.dataset.journeyPhase || ""} | child ${d.querySelector("#stage")?.dataset.witnessReady || "pending"} | paper ${Number.isFinite(paper) ? paper.toFixed(3) : "static"} | ${caption || "no caption"} | y${Math.round(w.scrollY)} | ${w.qaFPS || '…'}fps | ${audio?.paused === false ? 'playing' : 'silent'} ${(audio?.currentTime || 0).toFixed(1)}s`;
      }, 300);
    };
    frame.srcdoc = html;
    // Do not depend on iframe load timing: dynamic module/resource requests can
    // delay that event beyond a headless virtual-time capture's first frame.
    if (query.has("score") || query.has("cue") || query.has("run")) void cli(revision);
  }
  async function cli(run) {
    let finished = false;
    const started = performance.now();
    let readyAt = null, watchdog;
    const phase = value => {
      document.body.dataset.qaPhase = value;
      console.log(`FATE_QA_STAGE ${value}`);
    };
    const finish = () => {
      if (finished || run !== revision) return;
      finished = true;
      const w = frame.contentWindow, d = frame.contentDocument;
      document.body.dataset.qaReady = "true";
      console.log("FATE_QA_RESULT " + JSON.stringify({ checks: checks.textContent, errors: report.textContent,
        score: renderedScore(), scoreLength: scoreLength(), cue: w.FateScore?.cue(renderedScore()), phase: d.querySelector("#stage")?.dataset.journeyPhase || "", witnessReady: d.querySelector("#stage")?.dataset.witnessReady === "true",
        paper: w.getComputedStyle(d.documentElement).getPropertyValue("--fate-paper"),
        enhanced: d.documentElement.classList.contains("enhanced"), viewport: [w.innerWidth, w.innerHeight],
        startupMs: readyAt === null ? null : Math.round(readyAt - started), durationMs: Math.round(performance.now() - started) }));
    };
    const armWatchdog = (milliseconds, budget) => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        report.textContent += `CLI ${budget} timed out in ${document.body.dataset.qaPhase}.\n`;
        finish();
      }, milliseconds);
    };
    // Resource decoding and the regression have separate budgets. A slow model
    // must not consume the time reserved for visiting every story cue.
    armWatchdog(120000, "startup");
    try {
      phase("waiting-for-story");
      await new Promise((resolve, reject) => {
        const deadline = performance.now() + 120000;
        const poll = setInterval(() => {
          if (run !== revision) { clearInterval(poll); reject(new Error("Case changed during startup")); return; }
          const w = frame.contentWindow, d = frame.contentDocument;
          const artwork = w.performance.getEntriesByType("resource").filter(entry => /assets\/fate\/(newborn|hands-atlas|congregation)\.png/.test(entry.name));
          // Audio loading does not affect layout and may outlive the model.
          // The explicit artwork/model signals are the visual readiness gate.
          const hasDocument = Boolean(d.querySelector(".still-ending")) && w.getComputedStyle(d.querySelector(".still-ending")).position === "relative" && Boolean(w.FateScore);
          const staticReady = mode.value !== "motion" || d.documentElement.classList.contains("is-still");
          const witnessReady = d.querySelector("#stage")?.dataset.witnessReady === "true";
          if (hasDocument && (staticReady || (w.ScrollTrigger?.getById("fate-story") && artwork.length >= 3 && witnessReady))) {
            clearInterval(poll); resolve();
          } else if (performance.now() > deadline) {
            clearInterval(poll);
            reject(new Error(`Story readiness timed out: document=${hasDocument}, images=${artwork.length}, child=${witnessReady}, mode=${mode.value}`));
          }
        }, 50);
      });
      readyAt = performance.now();
      armWatchdog(180000, "regression");
      phase("ready");
      const w = frame.contentWindow, d = frame.contentDocument;
      w.ScrollTrigger?.getById("fate-story")?.scrubDuration(0);
      w.ScrollTrigger?.config({ autoRefreshEvents: "visibilitychange,DOMContentLoaded,resize" });
      // A late global load refresh can restore the iframe's original scroll.
      // Static captures have no triggers and keep their explicit test position.
      if (!d.documentElement.classList.contains("enhanced")) {
        w.ScrollTrigger?.config({ autoRefreshEvents: "none" });
        w.history.scrollRestoration = "manual";
      }
      w.gsap?.ticker.lagSmoothing(0);
      w.gsap?.getTweensOf(".captions").forEach(tween => tween.totalProgress(1));
      const style = d.createElement("style");
      style.textContent = ".fate-hud,.sound-control{animation:none!important;opacity:1!important}";
      d.head.append(style);
      if (query.has("run")) { phase("regression"); await regression(); }
      else {
        w.ScrollTrigger?.refresh();
        const score = query.has("cue") ? scoreForCue(Number(query.get("cue"))) : Number(query.get("score"));
        seek(score);
        w.ScrollTrigger?.update();
        w.ScrollTrigger?.getById("fate-story")?.animation.progress(score / scoreLength());
      }
      phase("complete");
      await new Promise(resolve => setTimeout(resolve, 1800));
    } catch (error) { report.textContent += `${error.stack || error.message}\n`; }
    finally { clearTimeout(watchdog); finish(); }
  }
  document.getElementById("load").addEventListener("click", load);
  document.querySelectorAll("[data-score]").forEach(button => button.addEventListener("click", () => seek(Number(button.dataset.score))));
  document.querySelectorAll("[data-cue]").forEach(button => button.addEventListener("click", () => seek(scoreForCue(Number(button.dataset.cue)))));
  document.getElementById("regression").addEventListener("click", regression);
  document.getElementById("lose-context").addEventListener("click", () => {
    const canvas = frame.contentDocument.querySelector("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  });
  load();
})();
