import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const code = await readFile(new URL("../fate/audio.js", import.meta.url), "utf8");
const flush = () => new Promise((resolve) => setImmediate(resolve));
class Element {
  constructor() { this.listeners = new Map(); this.attributes = {}; this.textContent = ""; this.classList = { toggle() {} }; }
  addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(fn); }
  removeEventListener(name, fn) { this.listeners.get(name)?.delete(fn); }
  dispatch(name, properties = {}) { for (const fn of [...(this.listeners.get(name) || [])]) fn({ target: this, isTrusted: true, ...properties }); }
  setAttribute(name, value) { this.attributes[name] = value; }
  closest() { return null; }
}
function harness({ blocked = false, hidden = false, available = true } = {}) {
  const panel = new Element(), label = new Element();
  panel.querySelector = () => label;
  const controls = Object.fromEntries(["sound-play", "sound-mute", "sound-volume", "sound-status"].map(id => [id, new Element()]));
  const document = new Element();
  Object.assign(document, { hidden, baseURI: "https://example.test/arcnosixa.dev/fate/", querySelector: () => panel, getElementById: id => controls[id] });
  const window = new Element();
  window.FATE_AUDIO = { available, autoplay: true, src: "../assets/audio/fate.mp3" };
  const audios = [], timers = new Map();
  let timerId = 0;
  class FakeAudio extends Element {
    constructor() { super(); this.paused = true; this.volume = 1; this.playCalls = 0; audios.push(this); }
    play() {
      this.playCalls++;
      if (blocked && this.playCalls === 1) return Promise.reject(Object.assign(new Error("Autoplay blocked"), { name: "NotAllowedError" }));
      this.paused = false;
      return Promise.resolve();
    }
    pause() { this.paused = true; }
  }
  runInNewContext(code, { window, document, Audio: FakeAudio, URL, performance,
    localStorage: { getItem() { return null; }, setItem() {} },
    requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; }, clearTimeout(id) { timers.delete(id); }
  });
  return { document, window, controls, audios, label, finishTimers() { for (const fn of timers.values()) fn(); timers.clear(); } };
}

test("opening FATE requests the exact local recording without a sound-button click", async () => {
  const h = harness();
  await flush();
  assert.equal(h.audios[0].src, "https://example.test/arcnosixa.dev/assets/audio/fate.mp3");
  assert.equal(h.audios[0].playCalls, 1);
  assert.equal(h.audios[0].paused, false);
  assert.equal(h.controls["sound-play"].attributes["aria-label"], "Pause soundtrack");
});
test("blocked autoplay waits for a page gesture; manual pause prevents future gesture restarts", async () => {
  const h = harness({ blocked: true });
  await flush();
  assert.equal(h.audios[0].paused, true);
  assert.equal(h.controls["sound-status"].textContent, "");
  h.document.dispatch("click");
  await flush();
  assert.equal(h.audios[0].playCalls, 2);
  assert.equal(h.audios[0].paused, false);
  h.controls["sound-play"].dispatch("click");
  h.finishTimers();
  h.document.dispatch("click");
  h.document.dispatch("keydown", { key: "ArrowDown" });
  await flush();
  assert.equal(h.audios[0].playCalls, 2);
  assert.equal(h.audios[0].paused, true);
});
test("hidden-page entry waits for visibility; hiding after playback stops without resuming", async () => {
  const h = harness({ hidden: true });
  assert.equal(h.audios[0].playCalls, 0);
  h.document.hidden = false; h.document.dispatch("visibilitychange");
  await flush();
  assert.equal(h.audios[0].playCalls, 1);
  h.document.hidden = true; h.document.dispatch("visibilitychange");
  assert.equal(h.audios[0].paused, true);
  h.document.hidden = false; h.document.dispatch("visibilitychange");
  await flush();
  assert.equal(h.audios[0].playCalls, 1);
});
test("page exit stops playback and disabled audio creates no audio element", async () => {
  const h = harness();
  await flush();
  h.window.dispatch("pagehide", { persisted: false });
  assert.equal(h.audios[0].paused, true);
  const silent = harness({ available: false });
  assert.equal(silent.audios.length, 0);
});
