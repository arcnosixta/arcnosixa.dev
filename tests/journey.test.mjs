import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const THREE = require("../vendor/three.min.js");
const scope = { window: {} };
runInNewContext(await readFile(new URL("../fate/score.js", import.meta.url), "utf8"), scope);
runInNewContext(await readFile(new URL("../fate/grove.js", import.meta.url), "utf8"), scope);
runInNewContext(await readFile(new URL("../fate/katana.js", import.meta.url), "utf8"), scope);
const FateJourney = scope.window.FateJourney;
const snapshot = journey => JSON.parse(JSON.stringify(journey.snapshot()));
const sample = (journey, score, time = 0) => { journey.update(score, time); return snapshot(journey); };
function terrainVerticesInView(journey) {
  journey.scene.updateMatrixWorld(true);
  const matrix = new THREE.Matrix4().multiplyMatrices(journey.camera.projectionMatrix, journey.camera.matrixWorldInverse);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(matrix), point = new THREE.Vector3();
  let count = 0;
  journey.terrain.traverse(object => {
    if (!object.isMesh) return;
    const positions = object.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
      if (frustum.containsPoint(point)) count++;
    }
  });
  return count;
}

test("the scroll score roundtrips scene cues while extending blade and ground passages", () => {
  const score = scope.window.FateScore;
  assert.equal(score.length, 377);
  assert.equal(score.at(194) - score.at(146), 84, "the long blade passage must retain its full reading interval");
  assert.equal(score.at(206) - score.at(194), 24, "the ground reveal must remain separate from the horizontal grove");
  assert.equal(score.at(340), score.length);
  assert.equal(score.at(330) - score.at(250), 80, "the full foot-to-face orbit must retain its reading interval");
  for (const cue of [0, 42.5, 83.5, 84.999, 96, 116, 128, 146, 160, 173, 194, 200, 206, 230, 234, 250, 283, 310, 330, 340]) {
    assert.ok(Math.abs(score.cue(score.at(cue)) - cue) < 1e-9, `scene cue ${cue} must roundtrip, including retime boundaries`);
  }
  for (const position of [0, 84.999, 85, 100, 135, 182.25, 219, 231, 243, 277, 287, 320, 347, 367, 377]) {
    assert.ok(Math.abs(score.at(score.cue(position)) - position) < 1e-9, `scroll position ${position} must preserve its scene time`);
  }
});

test("the white void hides an existing landscape before the giant blade embeds into it", () => {
  const journey = new FateJourney(THREE);
  try {
    for (const score of [116, 120, 127.999, 128]) {
      const state = sample(journey, score);
      assert.equal(state.swordVisible, false, `sword must stay absent at q${score}`);
      assert.equal(state.groundVisible, true, "the landscape must already exist before the camera reaches it");
      assert.equal(state.terrainOpacity, 1, "the landscape must not be created by an opacity reveal");
      assert.equal(terrainVerticesInView(journey), 0, `the white void must contain no landscape pixels at q${score}`);
      assert.equal(journey.scene.background.getHex(), 0xffffff);
    }
    const early = sample(journey, 132), middle = sample(journey, 138), late = sample(journey, 145);
    assert.ok(early.tip[1] > middle.tip[1] && middle.tip[1] > late.tip[1] && late.tip[1] > -8,
      "the tip must descend continuously during the fall");
    const landed = sample(journey, 146);
    assert.equal(landed.tip[1], -8, "the point must be deeply embedded below ground, not resting on top");
    assert.equal(landed.scale, 2);
    assert.equal(landed.embedDepth, 8);
    assert.equal(landed.swordVisible, true);
    journey.scene.updateMatrixWorld(true);
    const blade = journey.scene.getObjectByName("curved-black-blade");
    const bounds = new THREE.Box3().setFromObject(blade);
    assert.ok(Math.abs(bounds.min.y + 8) < 1e-6, "the rendered steel must reach the same embedded depth as its physical tip");
  } finally { journey.dispose(); }
});

test("the camera descends along the planted blade while the tip remains fixed", () => {
  const journey = new FateJourney(THREE);
  try {
    const states = [160, 173, 186, 200].map(score => sample(journey, score));
    for (let i = 1; i < states.length; i++) assert.ok(states[i - 1].camera[1] > states[i].camera[1], "each note must be reached lower on the blade");
    for (const state of states) {
      assert.equal(state.tip[1], -8, "scrolling along the blade must not move its embedded tip");
      assert.ok(state.target[1] > state.camera[1], "the camera must look up along the enormous blade before the ground reveal");
    }
    assert.equal(states.at(-1).groundVisible, true);
    assert.equal(states.at(-1).terrainOpacity, 1);
  } finally { journey.dispose(); }
});

test("the information passage frames only the giant blade, with all terrain below view", () => {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const journey = new FateJourney(THREE);
    try {
      journey.resize(width, height);
      for (const cue of [116, 120, 128, 156, 160, 166, 169, 173, 179, 182, 186, 192]) {
        const state = sample(journey, cue);
        assert.equal(state.groundVisible, true);
        assert.equal(state.terrainOpacity, 1);
        assert.equal(terrainVerticesInView(journey), 0, `${width}×${height}, cue ${cue}: terrain must stay outside the information view`);
      }
    } finally { journey.dispose(); }
  }
});

test("the meadow traversal is strictly horizontal before the child approach", () => {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const journey = new FateJourney(THREE);
    try {
      journey.resize(width, height);
      const start = sample(journey, 206), states = [215, 230, 233.99].map(score => sample(journey, score, 100));
      let previousX = start.camera[0];
      for (const state of states) {
        assert.equal(state.camera[1], start.camera[1], "camera Y must never bob during the meadow");
        assert.equal(state.target[1], start.target[1], "target Y must remain fixed during the meadow");
        assert.equal(state.camera[2], start.camera[2]);
        assert.ok(state.camera[0] > previousX, "the camera must translate sideways through the meadow");
        previousX = state.camera[0];
      }
      assert.deepEqual(sample(journey, 230, 0), sample(journey, 230, 10000), "wall-clock time must not add vertical movement");
    } finally { journey.dispose(); }
  }
});

test("the enormous blade and its fittings leave the note band clear on desktop and phone", () => {
  for (const [width, height] of [[1440, 900], [390, 844], [360, 900], [375, 667]]) {
    const journey = new FateJourney(THREE);
    try {
      journey.resize(width, height);
      const blade = journey.scene.getObjectByName("curved-black-blade");
      const vertices = blade.geometry.attributes.position;
      let fittingSamples = 0;
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
        // The portrait closeup deliberately lets some of the colossal steel
        // pass the left edge; the text side remains clear throughout the move.
        const visibleWidth = Math.max(0, Math.min(1, right) - Math.max(0, left));
        assert.ok((width < 700 || left >= 0) && right <= .46 && visibleWidth >= .08,
          `${width}×${height}, q${score}: blade occupies ${left.toFixed(3)}–${right.toFixed(3)} with ${visibleWidth.toFixed(3)} visible, leaving note space`);
        for (const name of ["katana-angular-guard", "katana-chain"]) {
          const fitting = journey.scene.getObjectByName(name), points = fitting.geometry.attributes.position;
          let rightmost = -Infinity;
          for (let i = 0; i < points.count; i++) {
            const p = new THREE.Vector3().fromBufferAttribute(points, i).applyMatrix4(fitting.matrixWorld).project(journey.camera);
            const screenY = (1 - p.y) / 2;
            if (p.z >= -1 && p.z <= 1 && screenY >= .35 && screenY <= .65) {
              fittingSamples++;
              rightmost = Math.max(rightmost, (p.x + 1) / 2);
            }
          }
          assert.ok(rightmost <= (width < 700 ? .49 : .61), `${width}×${height}, q${score}: ${name} reaches ${rightmost.toFixed(3)} across the note band`);
        }
      }
      assert.ok(fittingSamples > 0, "the camera must actually pass fittings while the note band is protected");
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

test("the reference katana has a slender blade, open angular guard and physical fittings", () => {
  const journey = new FateJourney(THREE);
  try {
    journey.update(146, 0);
    journey.scene.updateMatrixWorld(true);
    const blade = journey.scene.getObjectByName("curved-black-blade");
    const bladeSize = new THREE.Box3().setFromObject(blade).getSize(new THREE.Vector3());
    assert.ok(bladeSize.y / bladeSize.x > 15, "the silhouette must remain a long slender katana");
    const guard = journey.scene.getObjectByName("katana-angular-guard");
    assert.ok(guard?.isMesh);
    const center = guard.getWorldPosition(new THREE.Vector3());
    const throughCenter = new THREE.Raycaster(center.clone().add(new THREE.Vector3(0, 5, 0)), new THREE.Vector3(0, -1, 0));
    assert.equal(throughCenter.intersectObject(guard, false).length, 0, "the guard must have a real central aperture");
    const rimOrigin = guard.localToWorld(new THREE.Vector3(.93, 5, 0));
    const rimDirection = new THREE.Vector3(0, -1, 0).transformDirection(guard.matrixWorld);
    const throughRim = new THREE.Raycaster(rimOrigin, rimDirection);
    assert.ok(throughRim.intersectObject(guard, false).length > 0, "shaped metal must surround the guard aperture");
    const grip = journey.scene.getObjectByName("katana-grip");
    const gripSize = new THREE.Box3().setFromObject(grip).getSize(new THREE.Vector3());
    assert.ok(gripSize.y > gripSize.x * 6, "the wrapped grip must retain its elongated proportion");
    for (const name of ["katana-wrap", "katana-chain", "katana-habaki", "katana-fuchi", "katana-kashira"]) {
      const fitting = journey.scene.getObjectByName(name);
      assert.ok(fitting?.isMesh && fitting.geometry.attributes.position.count > 20, `${name} must be actual fitted geometry`);
    }
    const chain = journey.scene.getObjectByName("katana-chain");
    const chainSize = new THREE.Box3().setFromObject(chain).getSize(new THREE.Vector3());
    assert.ok(chain.geometry.index.count > 1000 && chainSize.y > 10 && chainSize.z > .2,
      "the hanging chain must contain a volumetric sequence of links");
  } finally { journey.dispose(); }
});

test("the treeless meadow has dense real grasses, bounded draw work and complete disposal", () => {
  const journey = new FateJourney(THREE);
  const stats = journey.groveStats;
  for (const type of ["trees", "branches", "leaves", "ferns"]) assert.equal(stats[type], 0, `${type} must remain absent from the open meadow`);
  assert.ok(stats.tufts > 1000 && stats.grassBlades > 10000 && stats.seedHeads > 100,
    "the meadow needs many individually shaped grass blades and bent seed heads");
  const grasses = journey.scene.getObjectByName("dense-curved-meadow-grasses");
  const seeds = journey.scene.getObjectByName("bent-grass-seed-heads");
  assert.ok(grasses?.isMesh && seeds?.isMesh);
  assert.equal(grasses.material.side, THREE.DoubleSide);
  assert.ok(grasses.geometry.index.count / 3 > stats.grassBlades * 2, "the blades need curved surfaces rather than single flat triangles");
  for (const material of journey.terrainMaterials) {
    assert.equal(material.opacity, 1);
    assert.equal(material.transparent, false, "the existing meadow must be solid ink rather than a transparent reveal");
  }
  assert.equal(stats.meshes, 3, "the detailed landscape must remain merged into three meshes");
  assert.ok(journey.scene.getObjectByName("organic-black-earth")?.isMesh);
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
