import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const THREE = require("../vendor/three.min.js");
const scope = { window: {} };
runInNewContext(await readFile(new URL("../fate/katana.js", import.meta.url), "utf8"), scope);
const FateJourney = scope.window.FateJourney;
const snapshot = journey => JSON.parse(JSON.stringify(journey.snapshot()));
const sample = (journey, score, time = 0) => { journey.update(score, time); return snapshot(journey); };

test("the white void is empty before a continuous fall lands the actual blade tip", () => {
  const journey = new FateJourney(THREE);
  try {
    for (const score of [116, 120, 127.999, 128]) {
      const state = sample(journey, score);
      assert.equal(state.swordVisible, false, `sword must stay absent at q${score}`);
      assert.equal(state.groundVisible, false, `ground must stay absent at q${score}`);
      assert.equal(journey.scene.background.getHex(), 0xffffff);
    }
    const early = sample(journey, 132), middle = sample(journey, 138), late = sample(journey, 145);
    assert.ok(early.tip[1] > middle.tip[1] && middle.tip[1] > late.tip[1] && late.tip[1] > 0,
      "the tip must descend continuously during the fall");
    const landed = sample(journey, 146);
    assert.equal(landed.tip[1], 0);
    assert.equal(landed.swordVisible, true);
    journey.scene.updateMatrixWorld(true);
    const blade = journey.scene.getObjectByName("curved-black-blade");
    const bounds = new THREE.Box3().setFromObject(blade);
    assert.ok(Math.abs(bounds.min.y) < 1e-6, "the rendered steel tip must reach ground level");
  } finally { journey.dispose(); }
});

test("the camera descends along the planted blade while the tip remains fixed", () => {
  const journey = new FateJourney(THREE);
  try {
    const states = [160, 173, 186, 200].map(score => sample(journey, score));
    for (let i = 1; i < states.length; i++) assert.ok(states[i - 1].camera[1] > states[i].camera[1], "each note must be reached lower on the blade");
    for (const state of states) {
      assert.equal(state.tip[1], 0, "scrolling along the blade must not move its grounded tip");
      assert.equal(state.camera[1], state.target[1], "the camera must look horizontally at the current blade level");
    }
    assert.equal(states.at(-1).groundVisible, true);
    assert.equal(states.at(-1).terrainOpacity, 1);
  } finally { journey.dispose(); }
});

test("the grove traversal is strictly horizontal even when clock time changes", () => {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const journey = new FateJourney(THREE);
    try {
      journey.resize(width, height);
      const start = sample(journey, 206), states = [215, 230, 240].map(score => sample(journey, score, 100));
      let previousX = start.camera[0];
      for (const state of states) {
        assert.equal(state.camera[1], start.camera[1], "camera Y must never bob during the grove");
        assert.equal(state.target[1], start.target[1], "target Y must remain fixed during the grove");
        assert.equal(state.camera[2], start.camera[2]);
        assert.ok(state.camera[0] > previousX, "the camera must translate sideways through the grove");
        previousX = state.camera[0];
      }
      assert.deepEqual(sample(journey, 230, 0), sample(journey, 230, 10000), "wall-clock time must not add vertical movement");
    } finally { journey.dispose(); }
  }
});

test("visible blade slices leave the right half clear for notes on desktop and phone", () => {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const journey = new FateJourney(THREE);
    try {
      journey.resize(width, height);
      const blade = journey.scene.getObjectByName("curved-black-blade");
      const vertices = blade.geometry.attributes.position;
      for (const score of [156, 160, 166, 169, 173, 179, 182, 186, 192]) {
        journey.update(score, 0);
        journey.scene.updateMatrixWorld(true);
        const projected = [];
        for (let i = 0; i < vertices.count; i++) {
          const p = new THREE.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(blade.matrixWorld).project(journey.camera);
          if (Math.abs(p.y) <= .95 && p.z >= -1 && p.z <= 1) projected.push((p.x + 1) / 2);
        }
        assert.ok(projected.length >= 8, `a real blade slice must be visible at q${score}`);
        const right = Math.max(...projected), left = Math.min(...projected);
        assert.ok(left >= 0 && right <= .46, `${width}×${height}, q${score}: blade occupies ${left.toFixed(3)}–${right.toFixed(3)}, leaving note space`);
      }
    } finally { journey.dispose(); }
  }
});

test("scroll geometry is finite and fully reversible after arbitrary scene visits", () => {
  for (const quality of [1, .6]) {
    const journey = new FateJourney(THREE, { quality });
    try {
      for (const [width, height] of [[1440, 900], [390, 844]]) {
        journey.resize(width, height);
        for (const score of [0, 116, 128, 138, 146, 160, 173, 186, 200, 206, 218, 230, 240]) {
          const before = sample(journey, score);
          assert.ok([...before.camera, ...before.target, ...before.tip, before.katanaY, before.terrainOpacity].every(Number.isFinite));
          for (const visit of [240, 138, 116, 230, 0, 194]) journey.update(visit, 123);
          assert.deepEqual(sample(journey, score, 987), before, `q${score} must restore exactly after reverse scrolling`);
        }
      }
    } finally { journey.dispose(); }
  }
});

test("merged grove geometry has bounded draw work and releases all owned resources", () => {
  const journey = new FateJourney(THREE);
  let meshes = 0, drawCalls = 0;
  journey.scene.traverse(object => {
    if (!object.isMesh) return;
    meshes++;
    drawCalls += Array.isArray(object.material) ? object.geometry.groups.length : 1;
    assert.ok([...object.geometry.attributes.position.array].every(Number.isFinite), "every geometry vertex must remain finite");
  });
  assert.ok(meshes <= 48 && drawCalls <= 48, `merged grove must remain bounded: ${meshes} meshes / ${drawCalls} draw calls`);
  const resources = [...journey.resources];
  assert.ok(resources.length > 0);
  const released = new Set();
  resources.forEach(resource => resource.addEventListener("dispose", () => released.add(resource)));
  journey.dispose();
  assert.equal(released.size, resources.length, "every geometry and material must be disposed");
  assert.equal(journey.resources.size, 0);
  assert.equal(journey.scene.children.length, 0);
  journey.dispose();
  assert.equal(released.size, resources.length, "disposal must remain idempotent");
});
