import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const THREE = require("../vendor/three.min.js");
const scope = { window: {} };
for (const script of ["score", "grove", "sword-profiles", "sword-field", "katana"]) {
  runInNewContext(await readFile(new URL(`../fate/${script}.js`, import.meta.url), "utf8"), scope);
}
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

test("the scroll score roundtrips original cues and gives the sword rain and finale distinct phases", () => {
  const score = scope.window.FateScore;
  assert.equal(score.length, 297);
  assert.equal(score.at(194) - score.at(146), 84, "the long blade passage must retain its full reading interval");
  assert.equal(score.at(206) - score.at(194), 24, "the ground reveal must finish before the sword rain");
  assert.deepEqual({ ...score.ending }, { rain: 206, settled: 234, flatten: 244, flat: 252, return: 254, end: 260 });
  assert.equal(score.at(score.ending.end), score.length);
  for (const [cue, phase] of [[205.99, "ground"], [206, "sword-rain"], [233.99, "sword-rain"], [234, "sword-field"], [251.99, "sword-field"], [252, "sword-horizon"]]) {
    assert.equal(score.phase(cue), phase);
  }
  for (const cue of [0, 42.5, 83.5, 84.999, 96, 116, 128, 146, 160, 173, 194, 200, 206, 220, 234, 244, 252, 254, 260]) {
    assert.ok(Math.abs(score.cue(score.at(cue)) - cue) < 1e-9, `scene cue ${cue} must roundtrip, including retime boundaries`);
  }
  for (const position of [0, 84.999, 85, 100, 135, 182.25, 219, 231, 243, 271, 281, 289, 291, 297]) {
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

test("the camera retreats smoothly during the rain and aligns the hero with the 35% seam", () => {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const journey = new FateJourney(THREE);
    try {
      journey.resize(width, height);
      const before = sample(journey, 205.9999), start = sample(journey, 206);
      assert.ok(new THREE.Vector3(...before.camera).distanceTo(new THREE.Vector3(...start.camera)) < .01, "the rain must join the ground shot without a camera cut");
      const falling = sample(journey, 226), settled = sample(journey, 238), flatten = sample(journey, 244), flat = sample(journey, 252);
      assert.ok(start.camera[2] < falling.camera[2] && falling.camera[2] < settled.camera[2] && settled.camera[2] < flatten.camera[2]);
      assert.ok(start.silhouette === 0 && falling.silhouette > 0 && falling.silhouette < 1 && flatten.silhouette === 1);
      assert.deepEqual(flat.camera, flatten.camera, "the camera holds through the frozen-frame handoff");
      assert.deepEqual(flat.target, flatten.target);
      const [x, , z] = flat.tip;
      const contact = new THREE.Vector3(x, journey.groundHeight(x, z), z).project(journey.camera);
      assert.ok(Math.abs((contact.x + 1) / 2 - .5) < .015, "the hero contact must be centered in the flat artwork");
      assert.ok(Math.abs((1 - contact.y) / 2 - .35) < .015, "the hero contact must meet the flat artwork's seam");
    } finally { journey.dispose(); }
  }
});

test("swords descend in staggered groups and remain embedded in the rendered terrain", () => {
  for (const quality of [1, .6]) {
    const journey = new FateJourney(THREE, { quality });
    try {
      assert.equal(sample(journey, 205).swordField.visible, false);
      const rain = sample(journey, 220).swordField;
      assert.ok(rain.visible && rain.falling > 0 && rain.waiting > 0 && rain.planted > 0, "the rain mixes falling, waiting and already planted swords");
      const falling = journey.swordField.snapshot().swords.find(sword => sword.phase === "falling");
      const tipY = cue => {
        journey.update(cue);
        return journey.swordField.snapshot().swords.find(sword => sword.id === falling.id).tip[1];
      };
      const flight = falling.impactCue - falling.launchCue;
      assert.ok(tipY(falling.launchCue + flight * .2) > tipY(falling.launchCue + flight * .8), "a sword travels downward before it hits");
      const settled = sample(journey, 234).swordField;
      assert.equal(settled.planted, settled.count);
      assert.equal(settled.waiting + settled.falling + settled.embedding, 0);
      assert.ok(settled.count >= 80 && settled.meshCount <= 12 && settled.triangleBudget < 200000, "instanced sword rain must stay within its render budget");
      const swords = journey.swordField.snapshot().swords;
      assert.equal(new Set(swords.map(sword => sword.profile)).size, 9);
      for (const sword of swords) {
        const [x, y, z] = sword.tip;
        assert.ok(sword.launchCue < sword.impactCue && sword.impactCue < sword.settleCue && sword.settleCue <= 234);
        assert.equal(x, sword.anchor[0]);
        assert.equal(z, sword.anchor[2]);
        assert.ok(sword.embedDepth > 0 && Math.abs(y - (journey.groundHeight(x, z) - sword.embedDepth)) < 1e-7);
      }
      const finalField = sample(journey, 252).swordField;
      assert.deepEqual(finalField.swords, settled.swords, "the planted swords hold through the reveal");
      assert.equal(finalField.count + finalField.distantCount + 1, 1000, "near, distant and hero blades make the same thousand-sword scene");
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
        for (const score of [0, 116, 128, 138, 146, 160, 173, 186, 200, 206, 218, 230, 244, 252, 260]) {
          const before = sample(journey, score);
          assert.ok([...before.camera, ...before.target, ...before.tip, before.katanaY, before.terrainOpacity].every(Number.isFinite));
          for (const visit of [252, 138, 116, 230, 0, 194]) journey.update(visit, 123);
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

test("grass roots follow rendered terrain triangles at both quality levels", () => {
  for (const quality of [1, .6]) {
    const journey = new FateJourney(THREE, { quality });
    try {
      const ground = journey.scene.getObjectByName("organic-black-earth");
      const grass = journey.scene.getObjectByName("dense-curved-meadow-grasses").geometry;
      const positions = grass.attributes.position, index = grass.index;
      const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
      let previous = -4, roots = 0, hits = 0;
      for (let i = 0; i < index.count; i += 6) {
        const first = index.getX(i);
        if (first !== previous + 2) {
          roots++;
          for (const vertex of [first, first + 1]) {
            const x = positions.getX(vertex), z = positions.getZ(vertex), y = positions.getY(vertex);
            assert.ok(Math.abs(journey.groundHeight(x, z) - y - .035) < .0001,
              `both blade edges must be embedded in the surface at ${x}, ${z}`);
          }
          if (roots % 2401 === 0) {
            ray.ray.origin.set(positions.getX(first), 20, positions.getZ(first));
            const hit = ray.intersectObject(ground, false)[0];
            assert.ok(hit, "sampled root has rendered earth beneath it");
            assert.ok(Math.abs(hit.point.y - positions.getY(first) - .035) < .0001,
              "grass must meet actual triangles, including their diagonal and displacement");
            hits++;
          }
        }
        previous = first;
      }
      assert.equal(roots, journey.groveStats.grassBlades);
      assert.ok(hits >= 30, "check roots across near and far planting bands");
    } finally { journey.dispose(); }
  }
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
