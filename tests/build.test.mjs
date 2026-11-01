import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";

const root = resolve("dist");
test("production contains all 3 portfolio designs and the standalone FATE route", async () => {
  const html = await readFile(join(root, "index.html"), "utf8");
  for (const design of ["cinematic", "studio", "atelier"]) assert.ok(html.includes(`?design=${design}`));
  assert.match(html, /href="fate\/" data-void-enter/);
  const fate = await readFile(join(root, "fate/index.html"), "utf8");
  assert.match(fate, /FATE — THE ASCENSION/);
  assert.match(fate, /id="written-story"/);
  for (const source of [html, fate]) {
    const directory = source === html ? root : join(root, "fate");
    for (const [, reference] of source.matchAll(/(?:src|href)="([^"#]+)"/g)) {
      if (/^(?:https?:|data:|mailto:|tel:|\?)/.test(reference)) continue;
      const local = reference.split(/[?#]/)[0];
      if (!local) continue;
      await assert.doesNotReject(stat(resolve(directory, local)), `Missing ${reference}`);
    }
  }
});
test("production includes the supplied recording and enables autoplay only on FATE", async () => {
  const scope = { window: {} };
  runInNewContext(await readFile(join(root, "fate/audio-config.js"), "utf8"), scope);
  assert.equal(scope.window.FATE_AUDIO.available, true);
  assert.equal(scope.window.FATE_AUDIO.autoplay, true);
  const recording = await readFile(resolve(root, "fate", scope.window.FATE_AUDIO.src));
  const supplied = await readFile("assets/audio/fate.mp3");
  const hash = data => createHash("sha256").update(data).digest("hex");
  assert.equal(hash(recording), hash(supplied));
  assert.ok(recording.length > 100000);
  assert.doesNotMatch(await readFile(join(root, "index.html"), "utf8"), /fate\/audio(?:-config)?\.js|assets\/audio\/fate\.mp3/);
});

test("QA fixtures and development files never enter the public build", async () => {
  for (const name of ["tests", "scripts", ".git", ".qa", "package.json"]) {
    await assert.rejects(stat(join(root, name)), { code: "ENOENT" });
  }
});
test("all narrative assets are real files with portable browser URLs", async () => {
  for (const asset of ["newborn.png", "hands-atlas.png", "congregation.png"]) {
    const file = await readFile(join(root, "assets/fate", asset));
    assert.equal(file.subarray(1, 4).toString(), "PNG");
    assert.ok(file.length > 100000);
  }
  for (const name of ["scene.js", "fate.js", "score.js", "katana.js", "grove.js", "witness.js", "witness-camera.js", "audio.js"]) {
    assert.doesNotMatch(await readFile(join(root, "fate", name), "utf8"), /[A-Z]:\\|file:\/\//);
  }
});

test("the witness is a real locally licensed skinned model with a matching loader", async () => {
  const binary = await readFile(join(root, "assets/fate/witness.glb"));
  assert.equal(binary.toString("ascii", 0, 4), "glTF");
  assert.equal(binary.readUInt32LE(4), 2);
  assert.equal(binary.readUInt32LE(8), binary.length);
  const model = JSON.parse(binary.toString("utf8", 20, 20 + binary.readUInt32LE(12)));
  assert.equal(model.extensions.VRM.meta.licenseName, "CC0");
  const bones = model.extensions.VRM.humanoid.humanBones.map(bone => bone.bone);
  for (const bone of ["head", "hips", "leftEye", "rightEye", "leftFoot", "rightFoot"]) assert.ok(bones.includes(bone));
  assert.ok(model.skins.length > 0 && model.meshes.length > 0 && model.images.length > 0);
  const license = await readFile(join(root, "assets/fate/witness-LICENSE.txt"), "utf8");
  assert.match(license, /Creative Commons CC0/);
  assert.ok(license.toLowerCase().includes(createHash("sha256").update(binary).digest("hex")));
  await stat(join(root, "vendor/GLTFLoader.js"));
  await stat(join(root, "vendor/three-LICENSE.txt"));
});
test("direct route, artwork and soundtrack streaming work under the GitHub Pages base", async () => {
  const server = spawn(process.execPath, ["scripts/serve.mjs"], {
    env: { ...process.env, PORT: "4178", BASE_PATH: "/arcnosixa.dev/" }, stdio: ["ignore", "pipe", "pipe"]
  });
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Preview server timed out")), 5000);
      server.stdout.once("data", () => { clearTimeout(timeout); resolve(); });
      server.once("error", (err) => { clearTimeout(timeout); reject(err); });
      server.once("exit", (code) => { if (code) { clearTimeout(timeout); reject(new Error(`Server exit ${code}`)); } });
    });
    const base = "http://127.0.0.1:4178/arcnosixa.dev/";
    const direct = await fetch(`${base}fate?test=1`, { redirect: "manual" });
    assert.equal(direct.status, 301);
    assert.equal(direct.headers.get("location"), "/arcnosixa.dev/fate/?test=1");
    for (const path of ["", "fate/", "fate/fate.css", "fate/scene.js?v=local", "fate/grove.js?v=local", "fate/katana.js?v=local", "vendor/three.min.js", "assets/fate/hands-atlas.png", "assets/fate/reference-katana.svg", "assets/fate/organic-grove.svg"]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200, path);
      await response.arrayBuffer();
    }
    const audio = await fetch(base + "assets/audio/fate.mp3", { method: "HEAD" });
    assert.equal(audio.status, 200);
    assert.equal(audio.headers.get("content-type"), "audio/mpeg");
    const recording = await readFile(join(root, "assets/audio/fate.mp3"));
    assert.equal(Number(audio.headers.get("content-length")), recording.length);
    const range = await fetch(base + "assets/audio/fate.mp3", { headers: { Range: "bytes=0-1023" } });
    assert.equal(range.status, 206);
    assert.equal(range.headers.get("content-range"), `bytes 0-1023/${recording.length}`);
    assert.deepEqual(Buffer.from(await range.arrayBuffer()), recording.subarray(0, 1024));
  } finally { server.kill(); }
});
