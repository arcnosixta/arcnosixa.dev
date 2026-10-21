/* Original synthesized score. No audio downloads, autoplay, or microphone access. */
(() => {
  "use strict";
  if (document.documentElement.dataset.design !== "cinematic") return;
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  if (!AudioEngine) return;
  const copy = {
    ru: { start: "Включить звук", active: "Звук включён", title: "ЗВУКОВАЯ СЦЕНА", settings: "Настройки звука", close: "Закрыть настройки звука", music: "Музыка", fx: "Эффекты", volume: "Громкость", on: "Вкл", off: "Выкл", note: "ARC / AFTER HOURS\nЭмбиент · 76 BPM · оригинальная композиция", hint: "Музыка и эффекты включаются отдельно.", error: "Не удалось включить звук. Попробуйте ещё раз." },
    en: { start: "Enable sound", active: "Sound is on", title: "SOUND STAGE", settings: "Sound settings", close: "Close sound settings", music: "Music", fx: "Effects", volume: "Volume", on: "On", off: "Off", note: "ARC / AFTER HOURS\nAmbient · 76 BPM · original score", hint: "Music and effects have separate controls.", error: "Could not enable audio. Please try again." },
  };
  let music = false, effects = false, musicVolume = .35, effectsVolume = .45;
  try {
    const saved = JSON.parse(localStorage.getItem("arc-sound-levels") || "{}");
    if (Number.isFinite(saved.music)) musicVolume = Math.max(0, Math.min(1, saved.music));
    if (Number.isFinite(saved.effects)) effectsVolume = Math.max(0, Math.min(1, saved.effects));
  } catch (_) { /* Every visit starts silent. Only levels are remembered. */ }
  const desk = document.createElement("aside");
  desk.className = "sound-desk";
  desk.innerHTML = `<button class="sound-main" type="button" aria-pressed="false"><span class="sound-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="sound-label"></span></button>
    <button class="sound-settings" type="button" aria-expanded="false" aria-controls="soundPanel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="#0b0b0b"/><circle cx="15" cy="17" r="3" fill="#0b0b0b"/></svg></button>
    <div class="sound-panel" id="soundPanel" hidden><div class="sound-panel-head"><span class="sound-title"></span><button class="sound-close" type="button">×</button></div><p class="sound-track"></p>
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
  let failed = false, pending = false;
  let context, musicBus, effectsBus, rhythmBus, noiseBuffer;
  let scheduler = 0, suspendTimer = 0, nextBeat = 0, beat = 0, inWork = false, lastEffect = -1;
  const stepTime = 60 / 76 / 2;
  const chords = [[45, 52, 59, 64], [41, 48, 55, 60], [48, 55, 62, 67], [43, 50, 57, 62]];
  const musicSources = new Set();
  const words = () => copy[document.documentElement.lang === "en" ? "en" : "ru"];

  function syncUI() {
    const t = words();
    desk.setAttribute("aria-label", t.title);
    main.setAttribute("aria-pressed", String(music || effects));
    q(".sound-label").textContent = music || effects ? t.active : t.start;
    settings.setAttribute("aria-label", t.settings);
    q(".sound-close").setAttribute("aria-label", t.close);
    q(".sound-title").textContent = t.title;
    q(".sound-track").textContent = t.note;
    q(".music-name").textContent = t.music;
    q(".effects-name").textContent = t.fx;
    musicButton.textContent = music ? t.on : t.off;
    effectsButton.textContent = effects ? t.on : t.off;
    musicButton.setAttribute("aria-pressed", String(music));
    effectsButton.setAttribute("aria-pressed", String(effects));
    musicButton.setAttribute("aria-label", t.music);
    effectsButton.setAttribute("aria-label", t.fx);
    musicSlider.setAttribute("aria-label", `${t.music}: ${t.volume}`);
    effectsSlider.setAttribute("aria-label", `${t.fx}: ${t.volume}`);
    q(".sound-status").textContent = failed ? t.error : t.hint;
    q(".sound-track").style.whiteSpace = "pre-line";
  }
  function ramp(param, value, seconds = .25) {
    param.cancelAndHoldAtTime(context.currentTime);
    param.linearRampToValueAtTime(value, context.currentTime + seconds);
  }
  function build() {
    context = new AudioEngine();
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -18;
    limiter.knee.value = 18;
    limiter.ratio.value = 5;
    limiter.connect(context.destination);
    musicBus = context.createGain();
    effectsBus = context.createGain();
    rhythmBus = context.createGain();
    musicBus.gain.value = effectsBus.gain.value = 0;
    rhythmBus.gain.value = inWork ? 1 : .12;
    musicBus.connect(limiter);
    effectsBus.connect(limiter);
    rhythmBus.connect(musicBus);
    const delay = context.createDelay(1), feedback = context.createGain(), echoFilter = context.createBiquadFilter();
    delay.delayTime.value = stepTime * 1.5;
    feedback.gain.value = .22;
    echoFilter.frequency.value = 1700;
    musicBus.connect(delay);
    delay.connect(echoFilter);
    echoFilter.connect(feedback);
    feedback.connect(delay);
    echoFilter.connect(limiter);
    noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  function track(source, nodes, bus) {
    if (bus === musicBus || bus === rhythmBus) musicSources.add(source);
    source.onended = () => {
      musicSources.delete(source);
      source.disconnect();
      nodes.forEach((node) => node.disconnect());
    };
  }
  function tone(midi, time, duration, level, bus, type = "sine", attack = .015, detune = 0, endFrequency) {
    const oscillator = context.createOscillator(), envelope = context.createGain(), filter = context.createBiquadFilter();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(440 * 2 ** ((midi - 69) / 12), time);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
    oscillator.detune.value = detune;
    filter.frequency.value = type === "triangle" ? 1100 : 4200;
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(level, time + attack);
    envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(filter);
    filter.connect(envelope);
    envelope.connect(bus);
    track(oscillator, [filter, envelope], bus);
    oscillator.start(time);
    oscillator.stop(time + duration + .05);
  }
  function noise(time, duration, level, frequency, bus, sweep = false) {
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), envelope = context.createGain();
    source.buffer = noiseBuffer;
    filter.type = "bandpass";
    filter.Q.value = .7;
    filter.frequency.setValueAtTime(frequency, time);
    if (sweep) filter.frequency.exponentialRampToValueAtTime(350, time + duration);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(level, time + Math.min(.08, duration / 3));
    envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(bus);
    track(source, [filter, envelope], bus);
    source.start(time);
    source.stop(time + duration + .05);
  }
  function schedule() {
    if (!music || document.hidden || context.state !== "running") return;
    if (nextBeat < context.currentTime) nextBeat = context.currentTime + .04;
    while (nextBeat < context.currentTime + .18) {
      const chord = chords[Math.floor(beat / 32) % chords.length];
      if (beat % 32 === 0) chord.forEach((note, i) => tone(note, nextBeat + i * .025, stepTime * 35, .045, musicBus, "triangle", 1.7, i % 2 ? 5 : -5));
      if (beat % 2 === 0) {
        const pattern = [0, 2, 1, 3, 2, 1, 3, 2];
        tone(chord[pattern[(beat / 2) % pattern.length]] + 12, nextBeat, 1.8, .045, musicBus);
      }
      if (beat % 4 === 0) tone(chord[0] - 12, nextBeat, .5, .18, rhythmBus, "sine", .008, 0, 34);
      if (beat % 2 === 1) noise(nextBeat, .07, .025, 5800, rhythmBus);
      beat++;
      nextBeat += stepTime;
    }
  }
  function updateMix() {
    if (!context) return;
    clearTimeout(suspendTimer);
    ramp(musicBus.gain, music ? musicVolume * .75 : 0, .6);
    ramp(effectsBus.gain, effects ? effectsVolume * .55 : 0);
    ramp(rhythmBus.gain, inWork ? 1 : .12, 1.4);
    if (music && !scheduler) {
      musicSources.forEach((source) => { try { source.stop(); } catch (_) { /* Already ended. */ } });
      musicSources.clear();
      beat = 0;
      nextBeat = context.currentTime + .06;
      scheduler = setInterval(schedule, 80);
      schedule();
    } else if (!music) {
      clearInterval(scheduler);
      scheduler = 0;
    }
    if (!music && !effects) suspendTimer = setTimeout(() => {
      if (!music && !effects) context.suspend().catch(() => {});
    }, 800);
  }
  async function toggle(nextMusic, nextEffects) {
    if (pending) return;
    pending = true;
    clearTimeout(suspendTimer);
    try {
      if (!context) build();
      if (context.state !== "running") await context.resume();
      music = nextMusic;
      effects = nextEffects;
      failed = false;
      updateMix();
      effect("click");
    } catch (_) {
      failed = true;
      music = effects = false;
    } finally { pending = false; syncUI(); }
  }
  function effect(kind) {
    if (!effects || !context || context.state !== "running" || document.hidden) return;
    const now = context.currentTime;
    if (now - lastEffect < .08) return;
    lastEffect = now;
    const t = now + .008;
    if (kind === "intro") {
      noise(t, .85, .12, 3600, effectsBus, true);
      tone(33, t + .65, .7, .3, effectsBus, "sine", .01, 0, 30);
      tone(81, t + .68, .8, .07, effectsBus);
    } else if (kind === "chapter") {
      noise(t, .3, .055, 2200, effectsBus, true);
      tone(69, t, .5, .035, effectsBus);
    } else if (kind === "open") {
      tone(64, t, .3, .12, effectsBus);
      tone(76, t + .07, .4, .065, effectsBus);
      noise(t, .06, .07, 1600, effectsBus);
    } else if (kind === "hover") tone(88, t, .09, .025, effectsBus);
    else {
      tone(kind === "close" ? 60 : 76, t, .12, .085, effectsBus, "triangle");
      noise(t, .035, .04, 2400, effectsBus);
    }
  }
  function setPanel(open, returnFocus = false) {
    panel.hidden = !open;
    settings.setAttribute("aria-expanded", String(open));
    if (open) q(".sound-close").focus();
    else if (returnFocus) settings.focus();
  }
  main.addEventListener("click", () => toggle(!(music || effects), !(music || effects)));
  musicButton.addEventListener("click", () => toggle(!music, effects));
  effectsButton.addEventListener("click", () => toggle(music, !effects));
  settings.addEventListener("click", () => setPanel(panel.hidden));
  q(".sound-close").addEventListener("click", () => setPanel(false, true));
  desk.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) { event.stopPropagation(); setPanel(false, true); }
  });
  document.addEventListener("click", (event) => { if (!desk.contains(event.target)) setPanel(false); });
  for (const [slider, channel] of [[musicSlider, "music"], [effectsSlider, "effects"]]) {
    slider.addEventListener("input", () => {
      if (channel === "music") musicVolume = Number(slider.value) / 100;
      else effectsVolume = Number(slider.value) / 100;
      updateMix();
      try { localStorage.setItem("arc-sound-levels", JSON.stringify({ music: musicVolume, effects: effectsVolume })); } catch (_) { /* Optional. */ }
    });
  }
  document.addEventListener("click", (event) => {
    if (desk.contains(event.target) || event.target.closest(".project-toggle, .intro-replay")) return;
    if (event.target.closest("a, button, summary")) effect("click");
  });
  document.addEventListener("pointerover", (event) => {
    const card = event.target.closest(".project");
    if (event.pointerType === "mouse" && card && !card.contains(event.relatedTarget)) effect("hover");
  });
  document.addEventListener("portfolio:render", syncUI);
  document.addEventListener("portfolio:intro", () => effect("intro"));
  document.addEventListener("portfolio:project", (event) => effect(event.detail.open ? "open" : "close"));
  document.addEventListener("portfolio:chapter", (event) => {
    inWork = event.detail.id === "work";
    if (context) ramp(rhythmBus.gain, inWork ? 1 : .12, 1.4);
    effect("chapter");
  });
  async function visibility() {
    if (!context) return;
    clearTimeout(suspendTimer);
    try {
      if (document.hidden) { clearInterval(scheduler); scheduler = 0; await context.suspend(); }
      else if (music || effects) { await context.resume(); updateMix(); }
    } catch (_) { /* The next click can resume interrupted audio. */ }
  }
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("pagehide", () => {
    clearInterval(scheduler); scheduler = 0; clearTimeout(suspendTimer);
    context?.suspend().catch(() => {});
  });
  window.addEventListener("pageshow", visibility);
  syncUI();
})();
