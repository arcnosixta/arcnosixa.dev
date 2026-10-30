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
  audio.preload = "none";
  audio.loop = true;
  let context, gain, source, fadeTimer, operation = 0, wanted = false, muted = false;
  let level = .55;
  try {
    const saved = Number(localStorage.getItem("fate-volume") ?? .55);
    if (Number.isFinite(saved)) level = Math.max(0, Math.min(1, saved));
  } catch { /* Storage is optional. */ }
  volume.value = Math.round(level * 100);

  function sync() {
    panel.classList.toggle("playing", wanted);
    play.setAttribute("aria-pressed", String(wanted));
    play.setAttribute("aria-label", wanted ? "Pause soundtrack" : "Play soundtrack");
    label.textContent = wanted ? "Sound on" : "Enable sound";
    mute.setAttribute("aria-pressed", String(muted));
    mute.setAttribute("aria-label", muted ? "Unmute soundtrack" : "Mute soundtrack");
    mute.textContent = muted ? "Unmute" : "Mute";
  }
  function ramp(value, duration = .65) {
    if (gain && context.state !== "closed") {
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(value, now + duration);
    } else audio.volume = value;
  }
  function stop(immediate = false) {
    operation++;
    wanted = false;
    clearTimeout(fadeTimer);
    ramp(0, immediate ? 0 : .45);
    if (immediate) audio.pause();
    else fadeTimer = setTimeout(() => { audio.pause(); }, 470);
    sync();
  }
  play.addEventListener("click", async () => {
    if (wanted) { stop(); return; }
    wanted = true;
    const request = ++operation;
    clearTimeout(fadeTimer);
    status.textContent = "";
    sync();
    try {
      // Audio graph and playback are created only inside this explicit gesture.
      if (!audio.src) audio.src = new URL(config.src, document.baseURI).href;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!context && AudioContext) {
        context = new AudioContext();
        gain = context.createGain();
        gain.gain.value = 0;
        source = context.createMediaElementSource(audio);
        source.connect(gain).connect(context.destination);
      }
      const resume = context?.state === "suspended" ? context.resume() : Promise.resolve();
      const playback = audio.play();
      await Promise.all([resume, playback]);
      if (request !== operation || !wanted) { if (!wanted) audio.pause(); return; }
      ramp(muted ? 0 : level, 1.5);
    } catch {
      if (request !== operation) return;
      stop(true);
      status.textContent = "The soundtrack is unavailable. The story continues in silence.";
    }
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
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(true); });
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
})();
