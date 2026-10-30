import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve, join } from "node:path";

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
test("unlicensed recording and QA fixtures never enter the public build", async () => {
  assert.match(await readFile(join(root, "fate/audio-config.js"), "utf8"), /"available":false/);
  await assert.rejects(stat(join(root, "assets/audio/fate.mp3")), { code: "ENOENT" });
  for (const name of ["tests", "scripts", ".git", ".qa", "package.json"]) {
    await assert.rejects(stat(join(root, name)), { code: "ENOENT" });
  }
});
test("all narrative assets are real files with portable browser URLs", async () => {
  for (const asset of ["child.png", "hands-atlas.png", "congregation.png"]) {
    const file = await readFile(join(root, "assets/fate", asset));
    assert.equal(file.subarray(1, 4).toString(), "PNG");
    assert.ok(file.length > 100000);
  }
  for (const name of ["scene.js", "fate.js", "audio.js"]) {
    assert.doesNotMatch(await readFile(join(root, "fate", name), "utf8"), /[A-Z]:\\|file:\/\//);
  }
});
test("direct route, slash redirect, JS and artwork work under the GitHub Pages base", async () => {
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
    for (const path of ["", "fate/", "fate/fate.css", "fate/scene.js?v=local", "vendor/three.min.js", "assets/fate/hands-atlas.png"]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200, path);
      await response.arrayBuffer();
    }
    assert.equal((await fetch(base + "assets/audio/fate.mp3")).status, 404);
  } finally { server.kill(); }
});
