/* Local visual QA fixture, excluded from the build. It operates the same source
   document and exposes repeatable scroll positions through ordinary controls. */
(() => {
  const frame = document.getElementById("preview");
  const mode = document.getElementById("mode");
  const metrics = document.getElementById("metrics");
  const report = document.getElementById("report");
  const checks = document.getElementById("checks");
  const scoreLength = () => frame.contentWindow.FateScore?.length || 289;
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
    const overlap = Math.min(box.bottom, w.innerHeight) - Math.max(box.top, 0);
    return opacity > .5 && style.visibility !== "hidden" && box.width > 0 && box.height > 0 && overlap > 1;
  }
  function luminance(color) {
    const rgb = color.match(/[\d.]+/g)?.slice(0, 3).map(Number) || [];
    const channels = rgb.map(value => { const v = value / 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
    return channels.length === 3 ? channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722 : NaN;
  }
  function bitmap(canvas) {
    const { width, height } = canvas;
    if (!width || !height) return null;
    const copy = canvas.ownerDocument.createElement("canvas");
    copy.width = width;
    copy.height = height;
    const context = copy.getContext("2d", { willReadFrequently: true });
    context.drawImage(canvas, 0, 0);
    return context.getImageData(0, 0, width, height);
  }
  function sameBitmap(live, frozen) {
    if (!live || !frozen || live.width !== frozen.width || live.height !== frozen.height) return false;
    let dark = 0, light = 0;
    for (let i = 0; i < live.data.length; i += 4) {
      if (live.data[i] !== frozen.data[i] || live.data[i + 1] !== frozen.data[i + 1] || live.data[i + 2] !== frozen.data[i + 2] || live.data[i + 3] !== frozen.data[i + 3]) return false;
      if (live.data[i] < 25) dark++;
      if (live.data[i] > 230) light++;
    }
    const minimum = live.width * live.height * .05;
    return dark > minimum && light > minimum;
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
    const scrollTo = async top => { w.scrollTo({ top, behavior: "instant" }); await settle(); };
    const topOf = element => element.getBoundingClientRect().top;
    const near = (actual, expected) => Math.abs(actual - expected) < 4;
    try {
      const motion = d.documentElement.classList.contains("enhanced");
      const profile = d.querySelector("#fate-profile");
      const heading = profile.querySelector("h2");
      const returnLink = profile.querySelector(".fate-profile-return");
      const links = [...profile.querySelectorAll(".fate-profile-contacts a[href]")];
      check("one ARCNOSIXTA profile follows both forms of the story", d.querySelectorAll("#fate-profile").length === 1 && heading.textContent.trim() === "ARCNOSIXTA" && !profile.closest("#experience, #written-story") && !d.querySelector(".revelation, .ending-panel"));
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
        check("the katana reaches the ground before the sword rain", stage.dataset.journeyPhase === "ground" && Math.abs(renderedScore() - scoreForCue(200)) < 1 && !notes.some(visible));
        const webgl = d.querySelector("#fate-canvas");
        const horizon = d.querySelector("#sword-horizon");
        const drawsBeforeRain = w.qaGLDraws;
        await atCue(220);
        check("the sword rain uses live WebGL before the profile", stage.dataset.journeyPhase === "sword-rain" && w.qaGLDraws > drawsBeforeRain && !notes.some(visible) && visible(webgl) && !visible(horizon) && !visible(heading));
        await atCue(238);
        check("the settled sword field holds before the flat reveal", stage.dataset.journeyPhase === "sword-field" && visible(webgl) && !visible(horizon));
        // The default WebGL buffer may be discarded at presentation. Copy the
        // final live frame immediately after its render for a pixel comparison.
        let live;
        const scene = w.FateScene.prototype, render = scene.render;
        scene.render = function (progress, ...args) {
          const result = render.call(this, progress, ...args);
          if (!live && Math.abs(w.FateScore.cue(progress * scoreLength()) - 251) < .1) live = bitmap(this.canvas);
          return result;
        };
        try { await atCue(251); await settle(); }
        finally { scene.render = render; }
        const trigger = w.ScrollTrigger.getById("fate-story");
        check("the last live frame remains pinned immediately before the handoff", Boolean(live) && trigger.isActive && near(topOf(stage), 0) && visible(webgl) && !visible(horizon));
        await atCue(252); await settle();
        check("the 2D horizon replaces the 3D field at the pin end", stage.dataset.journeyPhase === "sword-horizon" && d.documentElement.classList.contains("is-sword-horizon") && visible(horizon) && !visible(webgl) && near(w.scrollY, trigger.end));
        check("the frozen 2D horizon matches every pixel of the last live 3D frame", sameBitmap(live, bitmap(horizon)));
        const profileStyle = w.getComputedStyle(profile);
        const blackProfile = profileStyle.backgroundColor === "rgb(0, 0, 0)" || profileStyle.backgroundImage.includes("rgb(0, 0, 0)");
        check("the white ARCNOSIXTA heading appears beneath the swords at the pin end", visible(heading) && topOf(heading) > w.innerHeight * .35 && luminance(w.getComputedStyle(heading).color) > .8 && blackProfile);
        const flatDraws = w.qaGLDraws;
        const pinnedTop = topOf(stage), profileTop = topOf(profile), pinnedY = w.scrollY;
        const belowPin = Math.round(w.innerHeight * .28);
        await scrollTo(trigger.end + belowPin);
        const delta = w.scrollY - pinnedY;
        check("the frozen frame and profile move together in native scroll after the pin", delta > w.innerHeight * .2 && !trigger.isActive && near(topOf(stage), pinnedTop - delta) && near(topOf(profile), profileTop - delta) && visible(heading));
        check("native scrolling past the pin keeps the frozen bitmap with no new WebGL draws", w.qaGLDraws === flatDraws && sameBitmap(live, bitmap(horizon)));
        const nativeTop = topOf(stage);
        const frameWidth = frame.style.width, frameHeight = frame.style.height, oldBackingWidth = horizon.width;
        // Keep the real scrub active while refreshing the pin after a resize.
        if (query.has("run")) trigger.scrubDuration(trigger.vars.scrub);
        frame.style.width = `${w.innerWidth + (w.innerWidth >= 480 ? -37 : 37)}px`;
        frame.style.height = `${Math.max(360, w.innerHeight - 41)}px`;
        try {
          await new Promise(resolve => setTimeout(resolve, 1300));
          check("resizing refreshes the flat bitmap without pulling the profile back to the pin", near(topOf(stage), nativeTop) && visible(horizon) && !visible(webgl) && horizon.width !== oldBackingWidth && horizon.width === webgl.width && horizon.height === webgl.height && w.qaGLDraws > flatDraws);
        } finally {
          frame.style.width = frameWidth;
          frame.style.height = frameHeight;
          await settle();
          if (query.has("run")) trigger.scrubDuration(0);
        }
        returnLink.scrollIntoView({ block: "end", behavior: "instant" }); await settle();
        check("the profile contains working contact and portfolio links in the scroll flow", links.length >= 3 && links.every(link => !link.closest("[inert]")) && visible(returnLink) && !returnLink.closest("[inert]") && returnLink.getAttribute("href") === "../");
        const resizedDraws = w.qaGLDraws;
        await atCue(238); await settle();
        check("rewinding from the profile pins the stage again and resumes live WebGL", trigger.isActive && near(topOf(stage), 0) && stage.dataset.journeyPhase === "sword-field" && w.qaGLDraws > resizedDraws && visible(webgl) && !visible(horizon) && !visible(heading));
        await at(85.8);
        check("reverse scroll restores the flash bridge before the profile", Number(w.getComputedStyle(d.querySelector(".whiteout")).opacity) > 0 && !visible(heading) && !d.querySelector(".awakening-title"));
        check("reverse scroll restores the dark world", paper() === 0 && !d.documentElement.classList.contains("is-paper"));
        await atCue(252); await settle();
        await scrollTo(trigger.end + belowPin);
        const beforeStill = bitmap(horizon), beforeStillTop = topOf(stage), beforeStillProfile = topOf(profile);
        const oldTime = audio?.currentTime || 0, oldPlays = w.qaAudioPlays, wasPlaying = audio?.paused === false;
        d.querySelector(".still-toggle").click(); await settle();
        const stillHorizon = d.querySelector(".still-sword-horizon");
        check("motion to still preserves the bitmap and native scroll offset below the pin", d.documentElement.classList.contains("is-still") && stillHorizon.contains(horizon) && visible(horizon) && near(topOf(stillHorizon), beforeStillTop) && near(topOf(profile), beforeStillProfile) && sameBitmap(beforeStill, bitmap(horizon)));
        d.querySelector(".still-toggle").click(); await settle();
        check("still to motion restores the canvas at the same native scroll offset", d.documentElement.classList.contains("enhanced") && stage.contains(horizon) && visible(horizon) && near(topOf(stage), beforeStillTop) && near(topOf(profile), beforeStillProfile) && Math.abs(renderedScore() - Number(stillHorizon.dataset.storyAt)) < 1);
        check("view switches preserve the soundtrack without restarting", w.qaAudio === audio && w.qaAudioPlays === oldPlays && (audio?.currentTime || 0) >= oldTime - .1 && (!wasPlaying || audio.paused === false));
      } else {
        const cues = [99, 116, 134, 158, 172, 186];
        check("the original katana scenes and notes remain in document flow", cues.every(cue => d.querySelector(`[data-story-at="${scoreForCue(cue)}"]`)?.getBoundingClientRect().height > 0));
        await atCue(120);
        check("static score selection reaches the white void", visible(d.querySelector(".still-void")));
        await atCue(252);
        const stillHorizon = d.querySelector(".still-sword-horizon");
        const image = stillHorizon.querySelector("picture img.sword-horizon");
        await image.decode();
        check("static score selection displays the pre-rendered sword horizon without WebGL", visible(image) && /\/sword-horizon(?:-mobile)?\.png(?:\?|$)/.test(image.currentSrc) && image.naturalWidth > 0 && w.qaGLDraws === 0);
        const oldY = w.scrollY, stillTop = topOf(stillHorizon), profileTop = topOf(profile);
        await scrollTo(oldY + Math.round(w.innerHeight * .28));
        const delta = w.scrollY - oldY;
        check("the illustrated horizon and shared profile use the same native scroll flow", delta > w.innerHeight * .2 && near(topOf(stillHorizon), stillTop - delta) && near(topOf(profile), profileTop - delta) && visible(heading) && w.qaGLDraws === 0);
        returnLink.scrollIntoView({ block: "end", behavior: "instant" }); await settle();
        check("the static profile keeps white readable contacts and a usable return", links.length >= 3 && visible(returnLink) && !returnLink.closest("[inert]") && luminance(w.getComputedStyle(returnLink).color) > .8);
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
      window.qaGLDraws=0;
      for(const type of [window.WebGLRenderingContext,window.WebGL2RenderingContext])for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
        const prototype=type?.prototype, draw=prototype?.[name];
        if(typeof draw==='function'&&Object.hasOwn(prototype,name))prototype[name]=function(...args){window.qaGLDraws++;return draw.apply(this,args)};
      }
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
        metrics.textContent = `${d.documentElement.className || 'static'} | ${w.innerWidth}×${w.innerHeight} | q${renderedScore().toFixed(1)}/${scoreLength()} cue${w.FateScore?.cue(renderedScore()).toFixed(1) || "…"} ${marker} ${d.querySelector("#stage")?.dataset.journeyPhase || ""} | GL draws ${w.qaGLDraws || 0} | paper ${Number.isFinite(paper) ? paper.toFixed(3) : "static"} | ${caption || "no caption"} | y${Math.round(w.scrollY)} | ${w.qaFPS || '…'}fps | ${audio?.paused === false ? 'playing' : 'silent'} ${(audio?.currentTime || 0).toFixed(1)}s`;
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
        score: renderedScore(), scoreLength: scoreLength(), cue: w.FateScore?.cue(renderedScore()), phase: d.querySelector("#stage")?.dataset.journeyPhase || "", glDraws: w.qaGLDraws || 0,
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
          // Audio loading does not affect layout. Wait for the story and its art.
          const stillHorizon = d.querySelector(".still-sword-horizon");
          const hasDocument = Boolean(stillHorizon && d.querySelector("#fate-profile") && w.getComputedStyle(stillHorizon).position === "relative" && w.FateScore);
          // WebGL failure is asynchronous; wait until the fallback has actually
          // finished before seeking its static scenes.
          const staticReady = d.documentElement.classList.contains("is-still");
          if (hasDocument && (staticReady || (w.ScrollTrigger?.getById("fate-story") && artwork.length >= 3))) {
            clearInterval(poll); resolve();
          } else if (performance.now() > deadline) {
            clearInterval(poll);
            reject(new Error(`Story readiness timed out: document=${hasDocument}, images=${artwork.length}, mode=${mode.value}`));
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
  document.getElementById("profile").addEventListener("click", () => frame.contentDocument.querySelector("#fate-profile")?.scrollIntoView({ behavior: "instant" }));
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
