(() => {
  "use strict";
  const config = window.FATE_AUDIO;
  const panel = document.querySelector(".sound-control");
  if (!config?.available || !panel) return;
  panel.hidden = false;
  const play = document.getElementById("sound-play");
  const mute = document.getElementById("sound-mute");
  const volume = document.getElementById("sound-volume");
  const label = panel.querySelector(".sound-state");
  const status = document.getElementById("sound-status");
  const audio = new Audio();
  audio.preload = "auto";
  audio.loop = true;
  audio.src = new URL(config.src, document.baseURI).href;
  // A nonzero level makes this a genuine audible-autoplay request. Do not use
  // muted autoplay and then unmute: browsers may pause that playback again.
  audio.volume = .0001;
  let context, gain, source, fadeTimer, volumeFrame = 0, operation = 0;
  let wanted = false, muted = false, waitingForGesture = false, pending = false;
  let initialPending = config.autoplay !== false;
  let level = .55;
  try {
    const saved = Number(localStorage.getItem("fate-volume") ?? .55);
    if (Number.isFinite(saved)) level = Math.max(0, Math.min(1, saved));
  } catch { /* Storage is optional. */ }
  volume.value = Math.round(level * 100);

  function sync() {
    panel.classList.toggle("playing", wanted);
    panel.classList.toggle("awaiting-sound", waitingForGesture);
    play.setAttribute("aria-pressed", String(wanted));
    play.setAttribute("aria-label", wanted ? "Pause soundtrack" : "Play soundtrack");
    label.textContent = pending ? "Starting sound" : wanted ? "Sound on" : "Enable sound";
    mute.setAttribute("aria-pressed", String(muted));
    mute.setAttribute("aria-label", muted ? "Unmute soundtrack" : "Mute soundtrack");
    mute.textContent = muted ? "Unmute" : "Mute";
  }
  function ramp(value, duration = .65) {
    cancelAnimationFrame(volumeFrame);
    volumeFrame = 0;
    if (gain && context.state !== "closed") {
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(value, now + duration);
    } else if (!duration) audio.volume = value;
    else {
      const from = audio.volume, start = performance.now();
      let progress = 0;
      const tick = (now) => {
        // A delayed frame timestamp can predate the fade or regress. Keep the
        // envelope moving toward its endpoint and media volume inside [0, 1].
        progress = Math.max(progress, Math.min(1, (now - start) / (duration * 1000)));
        audio.volume = Math.max(0, Math.min(1, from + (value - from) * progress));
        volumeFrame = progress < 1 ? requestAnimationFrame(tick) : 0;
      };
      volumeFrame = requestAnimationFrame(tick);
    }
  }
  function disarm() {
    waitingForGesture = false;
    document.removeEventListener("click", resumeOnGesture, true);
    document.removeEventListener("keydown", resumeOnGesture, true);
  }
  function arm() {
    if (waitingForGesture) return;
    waitingForGesture = true;
    // Click follows touch release too, when mobile browsers grant activation.
    document.addEventListener("click", resumeOnGesture, true);
    document.addEventListener("keydown", resumeOnGesture, true);
  }
  function resumeOnGesture(event) {
    if (event.isTrusted === false || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "Escape" || event.key === "Tab") return;
    if (event.target?.closest?.(".sound-control, [data-void-return]")) return;
    void start(true);
  }
  function stop(immediate = false) {
    operation++;
    wanted = pending = initialPending = false;
    disarm();
    clearTimeout(fadeTimer);
    ramp(0, immediate ? 0 : .45);
    if (immediate) audio.pause();
    else fadeTimer = setTimeout(() => { audio.pause(); }, 470);
    sync();
  }
  async function start(fromGesture = false) {
    initialPending = false;
    if (document.hidden) return;
    disarm();
    wanted = pending = true;
    const request = ++operation;
    clearTimeout(fadeTimer);
    status.textContent = "";
    sync();
    try {
      // On entry try HTML audio directly. Create/resume Web Audio only during
      // a gesture, avoiding a suspended graph that would swallow audible audio.
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (fromGesture && !context && AudioContext) {
        context = new AudioContext();
        gain = context.createGain();
        gain.gain.value = 0;
        source = context.createMediaElementSource(audio);
        source.connect(gain).connect(context.destination);
        cancelAnimationFrame(volumeFrame);
        audio.volume = 1;
      }
      if (!gain && audio.paused) audio.volume = .0001;
      const resume = context?.state === "suspended" ? context.resume() : Promise.resolve();
      const playback = audio.play();
      await Promise.all([resume, playback]);
      if (request !== operation || !wanted) { if (!wanted) audio.pause(); return; }
      pending = false;
      ramp(muted ? 0 : level, 1.5);
      sync();
    } catch (error) {
      if (request !== operation) return;
      stop(true);
      if (error?.name === "NotAllowedError") {
        // Permission blocking is not a missing recording. The first real page
        // gesture retries once; a manual pause always disarms this retry.
        if (!fromGesture) arm();
        else status.textContent = "Press Play to enable the soundtrack.";
        sync();
      } else status.textContent = "The soundtrack is unavailable. The story continues in silence.";
    }
  }
  play.addEventListener("click", () => {
    if (wanted) stop();
    else void start(true);
  });
  mute.addEventListener("click", () => {
    muted = !muted;
    ramp(wanted && !muted ? level : 0, .2);
    sync();
  });
  volume.addEventListener("input", () => {
    level = Number(volume.value) / 100;
    ramp(wanted && !muted ? level : 0, .08);
    try { localStorage.setItem("fate-volume", String(level)); } catch { /* optional */ }
  });
  audio.addEventListener("error", () => {
    stop(true);
    status.textContent = "The soundtrack is unavailable. The story continues in silence.";
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && !initialPending) stop(true);
    else if (!document.hidden && initialPending) void start();
  });
  window.addEventListener("pagehide", (event) => {
    stop(true);
    if (event.persisted) void context?.suspend();
    else {
      source?.disconnect(); gain?.disconnect();
      void context?.close();
    }
  });
  window.FateAudio = { fadeOut: () => stop(), stop: () => stop(true) };
  sync();
  if (initialPending && !document.hidden) void start();
})();
