/* The supplied remix starts first; the director waits for real playback. */
(() => {
  "use strict";
  if (document.documentElement.dataset.design !== "cinematic") return;
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  const recording = document.createElement("audio");
  recording.id = "portfolioMusic";
  recording.src = "assets/audio/number-one-remix.mp3";
  recording.preload = "auto";
  recording.loop = true;
  recording.setAttribute("aria-hidden", "true");
  document.body.append(recording);
  const bladeRecording = document.createElement("audio");
  bladeRecording.id = "portfolioBlade";
  bladeRecording.src = "assets/audio/steel-blade-slice.mp3";
  bladeRecording.preload = "auto";
  bladeRecording.setAttribute("aria-hidden", "true");
  document.body.append(bladeRecording);
  const copy = {
    ru: { start: "Включить звук", active: "Звук включён", title: "ЗВУКОВАЯ СЦЕНА", settings: "Настройки звука", close: "Закрыть настройки звука", music: "Музыка", fx: "Эффекты", volume: "Громкость", on: "Вкл", off: "Выкл", hint: "Музыка и эффекты включаются отдельно.", blocked: "Нажмите на страницу, чтобы включить музыку.", error: "Не удалось загрузить музыку. Попробуйте включить её ещё раз." },
    en: { start: "Enable sound", active: "Sound is on", title: "SOUND STAGE", settings: "Sound settings", close: "Close sound settings", music: "Music", fx: "Effects", volume: "Volume", on: "On", off: "Off", hint: "Music and effects have separate controls.", blocked: "Interact with the page to enable music.", error: "Could not load the music. Try enabling it again." },
  };
  let music = false, effects = false, wantsMusic = true, wantsEffects = true;
  let musicVolume = .35, effectsVolume = .45;
  let cutReached = false, blocked = false, fileError = false;
  let introSession = false;
  let context, effectsBus, noiseBuffer, suspendTimer;
  let autoStartArmed = true, lastEffect = -1, musicRequest = 0;
  try {
    const saved = JSON.parse(localStorage.getItem("arc-sound-levels") || "{}");
    if (Number.isFinite(saved.music)) musicVolume = Math.max(0, Math.min(1, saved.music));
    if (Number.isFinite(saved.effects)) effectsVolume = Math.max(0, Math.min(1, saved.effects));
  } catch (_) { /* Optional preferences. */ }
  recording.volume = musicVolume;
  bladeRecording.volume = effectsVolume * .9;

  const desk = document.createElement("aside");
  desk.className = "sound-desk";
  desk.innerHTML = `<button class="sound-main" type="button" aria-pressed="false"><span class="sound-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="sound-label"></span></button>
    <button class="sound-settings" type="button" aria-expanded="false" aria-controls="soundPanel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="#0b0b0b"/><circle cx="15" cy="17" r="3" fill="#0b0b0b"/></svg></button>
    <div class="sound-panel" id="soundPanel" hidden><div class="sound-panel-head"><span class="sound-title"></span><button class="sound-close" type="button">×</button></div>
      <p class="sound-track">Number One’s One Else × Number One<br>BLEACH / REMIX</p>
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
    settings.setAttribute("aria-expanded", String(!panel.hidden));
    q(".sound-close").setAttribute("aria-label", t.close);
    q(".sound-title").textContent = t.title;
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
    q(".sound-status").textContent = fileError ? t.error : blocked ? t.blocked : t.hint;
  }
  function disarmAutoStart() {
    autoStartArmed = false;
    document.removeEventListener("pointerdown", firstInteraction, true);
    document.removeEventListener("keydown", firstInteraction, true);
  }
  function pauseMusic() {
    musicRequest++;
    recording.pause();
    music = false;
    syncUI();
  }
  async function requestMusic(restart = false) {
    if (!wantsMusic || document.hidden) return false;
    const request = ++musicRequest;
    try {
      if (recording.error) recording.load();
      if (restart) recording.currentTime = 0;
      recording.volume = musicVolume;
      await recording.play();
      if (request !== musicRequest || !wantsMusic || document.hidden) return false;
      music = true;
      blocked = fileError = false;
      syncUI();
      return true;
    } catch (error) {
      if (request !== musicRequest || error.name === "AbortError") return false;
      music = false;
      blocked = error.name === "NotAllowedError";
      fileError = !blocked;
      syncUI();
      return false;
    }
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
    bladeRecording.volume = effects ? effectsVolume * .9 : 0;
    if (!effects) bladeRecording.pause();
    if (!context) return;
    effectsBus.gain.cancelAndHoldAtTime(context.currentTime);
    effectsBus.gain.linearRampToValueAtTime(effects ? effectsVolume * .55 : 0, context.currentTime + .15);
  }

  async function resumeEffects() {
    if (!wantsEffects || document.hidden || !AudioEngine) return;
    clearTimeout(suspendTimer);
    try {
      buildEffects();
      await context.resume();
      effects = wantsEffects && !document.hidden && cutReached;
      setEffectsGain();
      syncUI();
    } catch (_) { effects = false; syncUI(); }
  }
  function setPlayback(nextMusic, nextEffects) {
    disarmAutoStart();
    wantsMusic = nextMusic;
    wantsEffects = nextEffects;
    cutReached = true;
    if (wantsMusic) void requestMusic();
    else pauseMusic();
    if (wantsEffects) void resumeEffects();
    else {
      effects = false;
      setEffectsGain();
      clearTimeout(suspendTimer);
      suspendTimer = setTimeout(() => { if (!wantsEffects) context?.suspend().catch(() => {}); }, 250);
    }
    syncUI();
  }
  function firstInteraction(event) {
    if (introSession || !autoStartArmed || !event.isTrusted || desk.contains(event.target)) return;
    if (event.type === "keydown" && ["Shift", "Control", "Alt", "Meta", "Escape"].includes(event.key)) return;
    // Outside the intro, retry audio after an autoplay block.
    if (cutReached) void requestMusic();
    void resumeEffects();
  }
  function setPanel(open, focus = false) {
    panel.hidden = !open;
    syncUI();
    if (!open && focus) settings.focus();
  }
  function track(source, nodes) {
    source.onended = () => { source.disconnect(); nodes.forEach((node) => node.disconnect()); };
  }
  function tone(midi, time, duration, level, type = "sine", endFrequency, pan = 0) {
    const oscillator = context.createOscillator(), envelope = context.createGain(), panner = context.createStereoPanner();
    panner.pan.value = pan;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(440 * 2 ** ((midi - 69) / 12), time);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(level, time + .01);
    envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(envelope);
    envelope.connect(panner);
    panner.connect(effectsBus);
    track(oscillator, [envelope, panner]);
    oscillator.start(time);
    oscillator.stop(time + duration + .05);
  }
  function noise(time, duration, level, frequency, sweep = false, pan = 0) {
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), envelope = context.createGain(), panner = context.createStereoPanner();
    panner.pan.value = pan;
    source.buffer = noiseBuffer;
    filter.type = "bandpass";
    filter.Q.value = .7;
    filter.frequency.setValueAtTime(frequency, time);
    if (sweep) filter.frequency.exponentialRampToValueAtTime(350, time + duration);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(level, time + Math.min(.08, duration / 3));
    envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
    source.connect(filter); filter.connect(envelope); envelope.connect(panner); panner.connect(effectsBus);
    track(source, [filter, envelope, panner]);
    source.start(time); source.stop(time + duration + .05);
  }
  function effect(kind, variant = 0) {
    if (!effects || context?.state !== "running" || document.hidden) return;
    const now = context.currentTime;
    if (now - lastEffect < .08) return;
    lastEffect = now;
    const t = now + .008;
    if (kind === "blade") {
      noise(t, .18, .2, 6800, true);
      tone(101, t + .015, .24, .075, "sine", 1500);
      tone(88, t + .04, .4, .045, "triangle");
      tone(40, t + .07, .23, .1, "sine", 44);
    } else if (kind === "splash") {
      const index = Math.max(0, Math.min(3, variant));
      const pan = [-.55, -.18, .22, .55][index];
      const pitch = [54, 60, 49, 64][index];
      // A wet impact, dropping liquid resonance, then a smaller trailing drop.
      noise(t, [.12, .09, .15, .1][index], .13, [1000, 650, 1450, 850][index], true, pan);
      tone(pitch, t, .13, .095, "sine", 72 + index * 13, pan);
      tone(pitch + 17, t + .045, .075, .045, "sine", 180 + index * 35, pan);
    } else if (kind === "chapter") { noise(t, .3, .055, 2200, true); tone(69, t, .5, .035); }
    else if (kind === "open") { tone(64, t, .3, .12); tone(76, t + .07, .4, .065); noise(t, .06, .07, 1600); }
    else if (kind === "hover") tone(88, t, .09, .025);
    else { tone(kind === "close" ? 60 : 76, t, .12, .085, "triangle"); noise(t, .035, .04, 2400); }
  }
  function playBlade() {
    if (!effects || document.hidden) return;
    bladeRecording.currentTime = 0;
    bladeRecording.volume = effectsVolume * .9;
    bladeRecording.play().then(() => {
      if (!effects || document.hidden || !introSession) bladeRecording.pause();
    }).catch(() => effect("blade"));
  }


  main.addEventListener("click", () => { const on = !(music || effects); setPlayback(on, on); });
  musicButton.addEventListener("click", () => setPlayback(!music, wantsEffects));
  effectsButton.addEventListener("click", () => setPlayback(wantsMusic, !effects));
  settings.addEventListener("click", () => setPanel(panel.hidden));
  q(".sound-close").addEventListener("click", () => setPanel(false, true));
  desk.addEventListener("keydown", (event) => { if (event.key === "Escape" && !panel.hidden) { event.stopPropagation(); setPanel(false, true); } });
  document.addEventListener("click", (event) => { if (!desk.contains(event.target)) setPanel(false); });
  for (const [slider, channel] of [[musicSlider, "music"], [effectsSlider, "effects"]]) {
    slider.addEventListener("input", () => {
      if (channel === "music") { musicVolume = Number(slider.value) / 100; recording.volume = musicVolume; }
      else { effectsVolume = Number(slider.value) / 100; setEffectsGain(); }
      try { localStorage.setItem("arc-sound-levels", JSON.stringify({ music: musicVolume, effects: effectsVolume })); } catch (_) { /* Optional. */ }
    });
  }
  recording.addEventListener("playing", () => {
    if (!wantsMusic || document.hidden) { recording.pause(); return; }
    music = true; blocked = fileError = false; syncUI();
  });
  recording.addEventListener("pause", () => { music = false; syncUI(); });
  recording.addEventListener("error", () => { music = false; fileError = true; syncUI(); });
  document.addEventListener("click", (event) => { if (!introSession && !desk.contains(event.target) && !event.target.closest(".project-toggle, .intro-replay") && event.target.closest("a, button, summary")) effect("click"); });
  document.addEventListener("pointerover", (event) => { const card = event.target.closest(".project"); if (event.pointerType === "mouse" && card && !card.contains(event.relatedTarget)) effect("hover"); });
  document.addEventListener("portfolio:render", syncUI);
  window.PortfolioSound = {
    async startIntro(silent = false) {
      introSession = true;
      cutReached = true;
      blocked = fileError = false;
      if (silent) { setPlayback(false, false); return { muted: true }; }
      bladeRecording.pause();
      pauseMusic();
      // Resume Web Audio in the same gesture as the MP3, without delaying music.
      void resumeEffects();
      const started = await requestMusic(true);
      return { started, blocked: blocked && wantsMusic, failed: fileError, muted: !wantsMusic };
    },
    cancelIntroStart() { pauseMusic(); },
  };
  document.addEventListener("portfolio:blade", playBlade);
  document.addEventListener("portfolio:splash", (event) => effect("splash", event.detail.index));
  document.addEventListener("portfolio:intro-end", () => {
    bladeRecording.pause();
    introSession = false;
    if (cutReached) return;
    cutReached = true;
    void requestMusic();
    void resumeEffects();
  });
  document.addEventListener("portfolio:project", (event) => effect(event.detail.open ? "open" : "close"));
  document.addEventListener("portfolio:chapter", () => effect("chapter"));
  function pauseForPage() {
    bladeRecording.pause();
    pauseMusic();
    effects = false;
    context?.suspend().catch(() => {});
    syncUI();
  }
  function resumeForPage() {
    if (!cutReached) return;
    void requestMusic();
    void resumeEffects();
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden) pauseForPage(); else resumeForPage(); });
  window.addEventListener("pagehide", pauseForPage);
  window.addEventListener("pageshow", (event) => { if (event.persisted) resumeForPage(); });
  document.addEventListener("pointerdown", firstInteraction, { capture: true, passive: true });
  document.addEventListener("keydown", firstInteraction, true);
  syncUI();
})();
