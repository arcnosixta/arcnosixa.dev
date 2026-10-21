/* Official Number One — Bankai stream, plus independently synthesized UI effects. */
(() => {
  "use strict";
  if (document.documentElement.dataset.design !== "cinematic") return;
  const VIDEO_ID = "7nQAGywy3Rw";
  const WATCH_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  const copy = {
    ru: { start: "Включить звук", active: "Звук включён", title: "ЗВУКОВАЯ СЦЕНА", settings: "Настройки звука", close: "Скрыть плеер и остановить музыку", music: "Музыка", fx: "Эффекты", volume: "Громкость", on: "Вкл", off: "Выкл", source: "Официальная публикация VIZ ↗", hint: "Музыка и эффекты включаются отдельно.", blocked: "Нажмите ▶ в плеере, чтобы включить музыку.", error: "Плеер недоступен. Открыть трек можно по ссылке выше.", local: "Откройте сайт через localhost или HTTPS, чтобы включить плеер." },
    en: { start: "Enable sound", active: "Sound is on", title: "SOUND STAGE", settings: "Sound settings", close: "Hide player and stop music", music: "Music", fx: "Effects", volume: "Volume", on: "On", off: "Off", source: "Official VIZ release ↗", hint: "Music and effects have separate controls.", blocked: "Press ▶ in the player to start the music.", error: "Player unavailable. Open the track using the link above.", local: "Open the site on localhost or HTTPS to use the player." },
  };
  let music = false, effects = false, wantsMusic = true, wantsEffects = true;
  let musicVolume = .35, effectsVolume = .45;
  let player, playerReady = false, playerLoading = false, playerError = false, blocked = false;
  let context, effectsBus, noiseBuffer, suspendTimer, loadTimer;
  let autoStartArmed = true, lastEffect = -1;
  let expanded = false;
  try {
    const saved = JSON.parse(localStorage.getItem("arc-sound-levels") || "{}");
    if (Number.isFinite(saved.music)) musicVolume = Math.max(0, Math.min(1, saved.music));
    if (Number.isFinite(saved.effects)) effectsVolume = Math.max(0, Math.min(1, saved.effects));
  } catch (_) { /* Optional preferences. */ }

  const desk = document.createElement("aside");
  desk.className = "sound-desk";
  desk.innerHTML = `<button class="sound-main" type="button" aria-pressed="false"><span class="sound-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="sound-label"></span></button>
    <button class="sound-settings" type="button" aria-expanded="false" aria-controls="soundPanel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="#0b0b0b"/><circle cx="15" cy="17" r="3" fill="#0b0b0b"/></svg></button>
    <div class="sound-panel" id="soundPanel" hidden><div class="sound-panel-head"><span class="sound-title"></span><button class="sound-close" type="button">×</button></div>
      <p class="sound-track">Number One — Bankai<br>Shiro SAGISU · Hazel Fernandes</p>
      <a class="sound-source" target="_blank" rel="noreferrer" href="${WATCH_URL}"></a>
      <div id="soundPlayer" class="sound-player"></div>
      <div class="sound-row"><label for="musicVolume" class="music-name"></label><button type="button" class="sound-music" aria-pressed="false"></button><input id="musicVolume" type="range" min="0" max="100" step="1" /></div>
      <div class="sound-row"><label for="effectsVolume" class="effects-name"></label><button type="button" class="sound-effects" aria-pressed="false"></button><input id="effectsVolume" type="range" min="0" max="100" step="1" /></div>
      <p class="sound-status" role="status"></p></div>`;
  document.body.append(desk);
  const q = (selector) => desk.querySelector(selector);
  const main = q(".sound-main"), settings = q(".sound-settings"), panel = q(".sound-panel");
  const musicButton = q(".sound-music"), effectsButton = q(".sound-effects");
  const musicSlider = q("#musicVolume"), effectsSlider = q("#effectsVolume");
  musicSlider.value = String(musicVolume * 100);
  effectsSlider.value = String(effectsVolume * 100);
  const words = () => copy[document.documentElement.lang === "en" ? "en" : "ru"];

  function syncUI() {
    const t = words();
    desk.setAttribute("aria-label", t.title);
    main.setAttribute("aria-pressed", String(music || effects));
    q(".sound-label").textContent = music || effects ? t.active : t.start;
    settings.setAttribute("aria-label", t.settings);
    settings.setAttribute("aria-expanded", String(!panel.hidden && expanded));
    panel.classList.toggle("is-compact", !expanded);
    panel.classList.toggle("has-message", playerError || blocked || location.protocol === "file:");
    q(".sound-close").setAttribute("aria-label", t.close);
    q(".sound-title").textContent = t.title;
    q(".sound-source").textContent = t.source;
    q(".music-name").textContent = t.music;
    q(".effects-name").textContent = t.fx;
    musicButton.textContent = music ? t.on : t.off;
    effectsButton.textContent = effects ? t.on : t.off;
    musicButton.setAttribute("aria-pressed", String(music));
    effectsButton.setAttribute("aria-pressed", String(effects));
    musicButton.setAttribute("aria-label", t.music);
    effectsButton.setAttribute("aria-label", t.fx);
    effectsButton.disabled = !AudioEngine;
    musicSlider.setAttribute("aria-label", `${t.music}: ${t.volume}`);
    effectsSlider.setAttribute("aria-label", `${t.fx}: ${t.volume}`);
    q(".sound-status").textContent = location.protocol === "file:" ? t.local : playerError ? t.error : blocked ? t.blocked : t.hint;
    const iframe = q("iframe");
    if (iframe) { iframe.title = "Number One — Bankai / BLEACH: Thousand-Year Blood War / VIZ"; iframe.classList.add("sound-player"); }
  }
  function showPanel() { panel.hidden = false; syncUI(); }
  function disarmAutoStart() {
    autoStartArmed = false;
    document.removeEventListener("pointerdown", firstInteraction, true);
    document.removeEventListener("keydown", firstInteraction, true);
  }

  function createPlayer() {
    if (player || !window.YT?.Player) return;
    player = new window.YT.Player("soundPlayer", {
      width: "100%", height: "200", videoId: VIDEO_ID,
      host: "https://www.youtube-nocookie.com",
      playerVars: { playsinline: 1, controls: 1, rel: 0, origin: location.origin, loop: 1, playlist: VIDEO_ID },
      events: {
        onReady(event) {
          clearTimeout(loadTimer);
          playerReady = true;
          playerError = false;
          event.target.setVolume(Math.round(musicVolume * 100));
          syncUI();
          if (wantsMusic && !document.hidden) { showPanel(); event.target.playVideo(); }
        },
        onStateChange(event) {
          if (event.data === 1) {
            if (document.hidden || !wantsMusic) { event.target.pauseVideo(); return; }
            music = true;
            blocked = playerError = false;
            showPanel();
          } else if (event.data === 2) {
            if (music && !document.hidden) { wantsMusic = false; disarmAutoStart(); }
            music = false;
          } else if (event.data === 0) {
            music = false;
            if (wantsMusic && !document.hidden) { event.target.seekTo(0); event.target.playVideo(); }
          }
          syncUI();
        },
        onAutoplayBlocked() { music = false; blocked = true; syncUI(); },
        onError() { clearTimeout(loadTimer); music = wantsMusic = false; playerError = true; syncUI(); },
      },
    });
  }
  function ensurePlayer() {
    if (playerReady) return;
    if (window.YT?.Player) { createPlayer(); return; }
    if (playerLoading) return;
    playerLoading = true;
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previous?.(); createPlayer(); };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => { playerError = true; playerLoading = false; syncUI(); script.remove(); };
    document.head.append(script);
    loadTimer = setTimeout(() => { if (!playerReady) { playerError = true; syncUI(); } }, 15000);
  }

  function buildEffects() {
    if (!AudioEngine || context) return;
    context = new AudioEngine();
    effectsBus = context.createGain();
    effectsBus.gain.value = 0;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -18;
    limiter.ratio.value = 5;
    effectsBus.connect(limiter);
    limiter.connect(context.destination);
    noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  function setEffectsGain() {
    if (!context) return;
    effectsBus.gain.cancelAndHoldAtTime(context.currentTime);
    effectsBus.gain.linearRampToValueAtTime(effects ? effectsVolume * .55 : 0, context.currentTime + .15);
  }
  function resumeEffects() {
    if (!wantsEffects || document.hidden) return;
    clearTimeout(suspendTimer);
    try {
      buildEffects();
      context?.resume().then(() => {
        effects = wantsEffects && !document.hidden;
        setEffectsGain();
        syncUI();
      }).catch(() => {});
    } catch (_) { effects = false; syncUI(); }
  }
  function setPlayback(nextMusic, nextEffects, manual = true) {
    if (manual) disarmAutoStart();
    wantsMusic = nextMusic;
    wantsEffects = nextEffects;
    if (wantsMusic) {
      blocked = false;
      showPanel();
      ensurePlayer();
      if (playerReady && !document.hidden) { player.setVolume(Math.round(musicVolume * 100)); player.playVideo(); }
    } else {
      music = false;
      if (playerReady) player.pauseVideo();
    }
    if (wantsEffects) resumeEffects();
    else {
      effects = false;
      setEffectsGain();
      clearTimeout(suspendTimer);
      suspendTimer = setTimeout(() => { if (!wantsEffects) context?.suspend().catch(() => {}); }, 250);
    }
    syncUI();
  }
  function firstInteraction(event) {
    if (!autoStartArmed || !event.isTrusted || desk.contains(event.target)) return;
    if (event.type === "keydown" && ["Shift", "Control", "Alt", "Meta", "Escape"].includes(event.key)) return;
    disarmAutoStart();
    setPlayback(true, true, false);
  }
  function closePanel(returnFocus = false) {
    // Keep the official video visible during playback. Closing also pauses music.
    setPlayback(false, wantsEffects);
    panel.hidden = true;
    syncUI();
    if (returnFocus) settings.focus();
  }

  function track(source, nodes) {
    source.onended = () => { source.disconnect(); nodes.forEach((node) => node.disconnect()); };
  }
  function tone(midi, time, duration, level, type = "sine", endFrequency) {
    const oscillator = context.createOscillator(), envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(440 * 2 ** ((midi - 69) / 12), time);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(level, time + .01);
    envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(envelope);
    envelope.connect(effectsBus);
    track(oscillator, [envelope]);
    oscillator.start(time);
    oscillator.stop(time + duration + .05);
  }
  function noise(time, duration, level, frequency, sweep = false) {
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), envelope = context.createGain();
    source.buffer = noiseBuffer;
    filter.type = "bandpass";
    filter.Q.value = .7;
    filter.frequency.setValueAtTime(frequency, time);
    if (sweep) filter.frequency.exponentialRampToValueAtTime(350, time + duration);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(level, time + Math.min(.08, duration / 3));
    envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
    source.connect(filter); filter.connect(envelope); envelope.connect(effectsBus);
    track(source, [filter, envelope]);
    source.start(time); source.stop(time + duration + .05);
  }
  function effect(kind) {
    if (!effects || context?.state !== "running" || document.hidden) return;
    const now = context.currentTime;
    if (now - lastEffect < .08) return;
    lastEffect = now;
    const t = now + .008;
    if (kind === "intro") {
      noise(t + .65, .45, .12, 3600, true);
      tone(33, t + 1.1, .7, .3, "sine", 30);
      tone(81, t + 1.12, .8, .07);
    } else if (kind === "chapter") { noise(t, .3, .055, 2200, true); tone(69, t, .5, .035); }
    else if (kind === "open") { tone(64, t, .3, .12); tone(76, t + .07, .4, .065); noise(t, .06, .07, 1600); }
    else if (kind === "hover") tone(88, t, .09, .025);
    else { tone(kind === "close" ? 60 : 76, t, .12, .085, "triangle"); noise(t, .035, .04, 2400); }
  }

  main.addEventListener("click", () => { const on = !(music || effects); setPlayback(on, on); if (!on) { panel.hidden = true; syncUI(); } });
  musicButton.addEventListener("click", () => setPlayback(!music, wantsEffects));
  effectsButton.addEventListener("click", () => setPlayback(wantsMusic, !effects));
  settings.addEventListener("click", () => {
    if (panel.hidden || !expanded) { expanded = true; showPanel(); ensurePlayer(); }
    else { expanded = false; if (!music && !wantsMusic) panel.hidden = true; syncUI(); }
  });
  q(".sound-close").addEventListener("click", () => closePanel(true));
  desk.addEventListener("keydown", (event) => { if (event.key === "Escape" && !panel.hidden) { event.stopPropagation(); closePanel(true); } });
  document.addEventListener("click", (event) => { if (!desk.contains(event.target) && !music && !wantsMusic) { panel.hidden = true; syncUI(); } });
  for (const [slider, channel] of [[musicSlider, "music"], [effectsSlider, "effects"]]) {
    slider.addEventListener("input", () => {
      if (channel === "music") { musicVolume = Number(slider.value) / 100; if (playerReady) player.setVolume(Math.round(musicVolume * 100)); }
      else { effectsVolume = Number(slider.value) / 100; setEffectsGain(); }
      try { localStorage.setItem("arc-sound-levels", JSON.stringify({ music: musicVolume, effects: effectsVolume })); } catch (_) { /* Optional. */ }
    });
  }
  document.addEventListener("click", (event) => { if (!desk.contains(event.target) && !event.target.closest(".project-toggle, .intro-replay") && event.target.closest("a, button, summary")) effect("click"); });
  document.addEventListener("pointerover", (event) => { const card = event.target.closest(".project"); if (event.pointerType === "mouse" && card && !card.contains(event.relatedTarget)) effect("hover"); });
  document.addEventListener("portfolio:render", syncUI);
  document.addEventListener("portfolio:intro", () => effect("intro"));
  document.addEventListener("portfolio:project", (event) => effect(event.detail.open ? "open" : "close"));
  document.addEventListener("portfolio:chapter", () => effect("chapter"));
  function pauseForPage() {
    if (playerReady) player.pauseVideo();
    music = effects = false;
    context?.suspend().catch(() => {});
    syncUI();
  }
  function resumeForPage() { setPlayback(wantsMusic, wantsEffects, false); }
  document.addEventListener("visibilitychange", () => { if (document.hidden) pauseForPage(); else resumeForPage(); });
  window.addEventListener("pagehide", pauseForPage);
  window.addEventListener("pageshow", (event) => { if (event.persisted) resumeForPage(); });
  document.addEventListener("pointerdown", firstInteraction, { capture: true, passive: true });
  document.addEventListener("keydown", firstInteraction, true);
  syncUI();
  ensurePlayer();
  resumeEffects();
})();
