import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const THREE = require("../vendor/three.min.js");
const scope = { window: {} };
for (const file of ["grove", "witness-camera"]) {
  runInNewContext(await readFile(new URL(`../fate/${file}.js`, import.meta.url), "utf8"), scope);
}
const path = scope.window.FateWitnessCamera;
const plain = value => JSON.parse(JSON.stringify(value));

test("approved cloak is volumetric, uniformly scaled, grounded and efficient", async () => {
  const actor = await loadActorGeometry(148);
  try {
    actor.update(283); actor.root.updateMatrixWorld(true);
    assert.equal(actor.model.visible, false, "the old shirt, tie and hair are excluded");
    const parts = [], bounds = new THREE.Box3(), point = new THREE.Vector3();
    let draws = 0, triangles = 0;
    actor.root.traverseVisible(object => {
      if (!object.isMesh) return;
      draws++; triangles += object.geometry.index.count / 3;
      parts.push(object.name, ...(object.userData.parts || []));
      for (let i = 0; i < object.geometry.attributes.position.count; i++) {
        point.fromBufferAttribute(object.geometry.attributes.position, i).applyMatrix4(object.matrixWorld);
        assert.ok(point.toArray().every(Number.isFinite));
        bounds.expandByPoint(point);
      }
    });
    for (const part of ["continuous-folded-cloak-back", "closed-high-undertunic", "high-folded-hood",
      "broad-wrapped-waist-sash", "wide-pleated-hakama-1", "hanging-wide-sleeve-1", "swept-fringe-2"]) {
      assert.ok(parts.includes(part), part);
    }
    assert.ok(draws <= 22 && triangles < 65000, `${draws} draws, ${triangles} triangles`);
    assert.ok(Math.abs(bounds.min.y - actor.groundY) < .001, "soles touch the ground");
    assert.ok(bounds.getSize(new THREE.Vector3()).y >= 147 && bounds.getSize(new THREE.Vector3()).y <= 151);
    assert.equal(actor.root.scale.x, actor.root.scale.y);
    assert.equal(actor.root.scale.y, actor.root.scale.z);
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      const journey = fixture(width, height); journey.witness = actor; journey.camera.far = 900; journey.camera.updateProjectionMatrix();
      const B = actor.root.position;
      for (let cue = 234; cue <= 250; cue += .5) {
        path.update(journey, cue);
        assert.equal(inView(actor.facePosition().project(journey.camera)), false, "no early face");
      }
      path.update(journey, cueAtAngle(journey, 90));
      for (const y of [1, 147]) assert.ok(inView(projected(journey, [B.x, B.y + y, B.z])), "full-height back view");
      path.update(journey, 330);
      assert.ok(inView(actor.facePosition().project(journey.camera)), "actual eyes framed");
    }
    const released = new Set(), resources = [...actor.resources];
    resources.forEach(r => r.addEventListener?.("dispose", () => released.add(r)));
    actor.dispose();
    assert.equal(released.size, resources.filter(r => r.addEventListener).length);
    assert.equal(actor.resources.size, 0);
  } finally { actor.dispose(); }
});

test("the full original katana is shorter than the enlarged witness", async () => {
  const journeyScope = { window: { FateGrove: scope.window.FateGrove } };
  runInNewContext(await readFile(new URL("../fate/katana.js", import.meta.url), "utf8"), journeyScope);
  const journey = new journeyScope.window.FateJourney(THREE, { quality: .6 });
  try {
    journey.update(283); journey.katana.updateMatrixWorld(true);
    const height = new THREE.Box3().setFromObject(journey.katana).getSize(new THREE.Vector3()).y;
    assert.equal(journey.katana.scale.x, 2, "preserve the sword's established scale");
    assert.ok(148 / height > 1.3 && 148 / height < 1.5, "human and sword keep natural proportions");
  } finally { journey.dispose(); }
});

function fixture(width = 1440, height = 900) {
  const groundY = scope.window.FateGrove.groundHeight(66, 4);
  return { width, height, mobile: width <= 700,
    camera: new THREE.PerspectiveCamera(width <= 700 ? 49 : 42, width / height, .1, 240),
    target: new THREE.Vector3(),
    witness: { root: { position: new THREE.Vector3(66, groundY, 4) }, height: 6, faceY: 5.5 } };
}
function projected(journey, point) {
  return new THREE.Vector3(...point).project(journey.camera);
}
function inView(point) { return Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1 && Math.abs(point.z) <= 1; }
function cueAtAngle(journey, degrees) {
  let low = 250, high = 330;
  for (let i = 0; i < 48; i++) {
    const mid = (low + high) / 2;
    if (path.sample(journey, mid).orbitDegrees < degrees) low = mid; else high = mid;
  }
  return (low + high) / 2;
}
async function loadActorGeometry(height = 6) {
  const previousLoader = THREE.GLTFLoader;
  const previousTextureLoad = THREE.TextureLoader.prototype.load;
  const geometryScope = { window: {}, THREE, TextDecoder, TextEncoder, ArrayBuffer, URL, Blob,
    self: { URL }, console, setTimeout, clearTimeout };
  runInNewContext(await readFile(new URL("../vendor/GLTFLoader.js", import.meta.url), "utf8"), geometryScope);
  runInNewContext(await readFile(new URL("../fate/witness.js", import.meta.url), "utf8"), geometryScope);
  const raw = await readFile(new URL("../assets/fate/witness.glb", import.meta.url));
  const bytes = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const Loader = THREE.GLTFLoader;
  // Decode the real mesh and skeleton; image decoding is irrelevant to framing.
  THREE.TextureLoader.prototype.load = function (url, onLoad) {
    const texture = new THREE.Texture(); queueMicrotask(() => onLoad(texture)); return texture;
  };
  THREE.GLTFLoader = class extends Loader { loadAsync() { return this.parseAsync(bytes, ""); } };
  const actor = new geometryScope.window.FateWitness(THREE, {
    scene: new THREE.Scene(), x: 112, z: 4, groundY: scope.window.FateGrove.groundHeight, height,
  });
  try { await actor.load("node-geometry"); return actor; }
  catch (error) { actor.dispose(); throw error; }
  finally {
    THREE.TextureLoader.prototype.load = previousTextureLoad;
    if (previousLoader) THREE.GLTFLoader = previousLoader; else delete THREE.GLTFLoader;
  }
}

test("the child is introduced by his foot without an early face or body reveal", () => {
  for (const [width, height] of [[1440, 900], [390, 844], [2560, 1080]]) {
    const journey = fixture(width, height), B = journey.witness.root.position;
    for (let cue = 234; cue <= 250; cue += .25) {
      path.update(journey, cue);
      for (const y of [4.2, 5.5, 6]) {
        assert.equal(inView(projected(journey, [B.x, B.y + y, B.z])), false,
          `${width}×${height}, cue${cue}: shoulders, face and crown must stay out of the introduction`);
      }
    }
    const pose = path.update(journey, 250), front = pose.front;
    const left = [front[2], 0, -front[0]];
    const foot = [B.x + left[0] * .12 + front[0] * .1, B.y + .12, B.z + left[2] * .12 + front[2] * .1];
    assert.ok(inView(projected(journey, foot)), `${width}×${height}: the foot must actually be inside the shot`);
    assert.ok(inView(projected(journey, [B.x, B.y + .7, B.z])), "the lower shin must be framed together with the shoe");
    assert.equal(inView(projected(journey, [B.x, B.y + 2.5, B.z])), false, "the first shot must crop the upper legs");
    assert.ok(Math.hypot(pose.camera[0] - B.x, pose.camera[2] - B.z) < 4,
      "the foot camera keeps a deliberate close-up distance");
  }
});

test("the real skinned shoes have complete silhouettes and margin in the lower part of the foot shot", async () => {
  const actor = await loadActorGeometry();
  try {
    const vertices = [], point = new THREE.Vector3();
    actor.root.updateMatrixWorld(true);
    actor.update(250);
    actor.root.traverseVisible(object => {
      if (!object.isMesh || !/Shoes/.test(object.name)) return;
      const positions = object.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i);
        if (object.isSkinnedMesh) object.boneTransform(i, point);
        point.applyMatrix4(object.matrixWorld);
        if (point.y <= actor.groundY + .75) vertices.push(point.clone());
      }
    });
    assert.ok(vertices.length > 100, "the framing regression must use the loaded, fitted shoe geometry");
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      const journey = fixture(width, height); journey.witness = actor;
      path.update(journey, 250);
      const bounds = new THREE.Box2();
      for (const vertex of vertices) {
        point.copy(vertex).project(journey.camera);
        assert.ok(inView(point), "the complete shoe/ankle geometry must remain inside the shot");
        bounds.expandByPoint(new THREE.Vector2((point.x + 1) / 2, (1 - point.y) / 2));
      }
      assert.ok(bounds.min.x >= .015 && bounds.max.x <= .985, "shoe toes and heels need horizontal margin");
      assert.ok(bounds.min.y >= .2 && bounds.max.y <= .95, "shoes must have top and bottom margin");
      assert.ok(bounds.getSize(new THREE.Vector2()).y >= .14, "boots occupy at least 14% of frame height with room for the cloak hem");
      const center = bounds.getCenter(new THREE.Vector2());
      assert.ok(center.y >= .5 && center.y <= .8, "the shoe belongs in the lower half, not clipped against the top edge");
      assert.equal(inView(actor.facePosition().project(journey.camera)), false, "the real face must stay outside the first shot");
    }
  } finally { actor.dispose(); }
});

test("a real 270 degree orbit rises from the left foot through the back to the frontal face", () => {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const journey = fixture(width, height), B = journey.witness.root.position;
    let previousAngle = -Infinity, previousEye = -Infinity, previousFocus = -Infinity;
    for (let cue = 250; cue <= 340; cue += .125) {
      const pose = path.update(journey, cue);
      assert.ok(pose.camera.concat(pose.target).every(Number.isFinite));
      assert.ok(pose.orbitAngle >= previousAngle - 1e-12, "the orbit must never reverse or take a shortcut");
      assert.ok(pose.camera[1] >= previousEye - 1e-12, "the orbit eye must rise through the body");
      assert.ok(pose.target[1] >= previousFocus - 1e-12, "the focus must rise through the body");
      assert.ok(pose.camera[1] > scope.window.FateGrove.groundHeight(pose.camera[0], pose.camera[2]) + .2,
        "the moving camera must stay above the actual earth");
      previousAngle = pose.orbitAngle; previousEye = pose.camera[1]; previousFocus = pose.target[1];
    }
    for (const [degrees, expected] of [[0, "left"], [90, "back"], [180, "right"], [270, "front"]]) {
      const pose = path.sample(journey, cueAtAngle(journey, degrees));
      const radial = new THREE.Vector3(pose.camera[0] - B.x, 0, pose.camera[2] - B.z).normalize();
      const front = new THREE.Vector3(...pose.front), left = new THREE.Vector3(front.z, 0, -front.x);
      const direction = expected === "left" ? left : expected === "right" ? left.negate() : expected === "front" ? front : front.negate();
      assert.ok(radial.dot(direction) > .999999, `the camera must physically reach the child's ${expected}`);
    }
    const final = path.sample(journey, 330);
    assert.ok(path.sample(journey, 310).camera[1] < B.y + 5.5 - .01,
      "the rise must continue during the last part of the turn, reaching eye level only at the face shot");
    assert.ok(Math.abs(final.orbitAngle - Math.PI * 1.5) < 1e-12);
    assert.ok(Math.abs(final.camera[1] - (B.y + 5.5)) < 1e-12, "the final camera must be at eye level");
    assert.deepEqual(plain(path.sample(journey, 340).camera), plain(final.camera), "the final face shot must hold still");
  }
});

test("the back shot faces the katana and frames the child's full height", () => {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const journey = fixture(width, height), cue = cueAtAngle(journey, 90);
    const pose = path.update(journey, cue), B = journey.witness.root.position;
    const view = new THREE.Vector3(...pose.target).sub(journey.camera.position).normalize();
    const katana = new THREE.Vector3(-B.x, 0, -B.z).normalize();
    assert.ok(view.dot(katana) > .99, "the boy's back view must look toward the planted katana");
    const crown = projected(journey, [B.x, B.y + 6, B.z]);
    assert.ok(inView(crown), "the camera pulls back to keep the crown inside the back shot");
    assert.ok(inView(projected(journey, [B.x, B.y + .05, B.z])), "the grounded feet remain in the back shot");
  }
});

test("the approach and orbit join continuously and retrace exactly on reverse scroll", () => {
  const journey = fixture(), startCamera = [51, 3, 18], startTarget = [50.3, 3, 0];
  assert.deepEqual(plain(path.sample(journey, 234, startCamera, startTarget).camera), startCamera);
  assert.deepEqual(plain(path.sample(journey, 234, startCamera, startTarget).target), startTarget);
  for (const cue of [234, 242, 250, 330]) {
    const before = path.sample(journey, cue - 1e-5, startCamera, startTarget);
    const after = path.sample(journey, cue + 1e-5, startCamera, startTarget);
    for (const key of ["camera", "target"]) {
      assert.ok(Math.hypot(...before[key].map((value, i) => value - after[key][i])) < 1e-5,
        `${key} must not cut at cue${cue}`);
    }
  }
  const checkpoints = new Map([239, 247.25, 264, 282.5, 309.4, 330].map(cue => [cue, plain(path.update(journey, cue))]));
  for (const cue of [340, 239, 330, 247.25, 309.4, 264, 282.5]) {
    const pose = plain(path.update(journey, cue));
    if (checkpoints.has(cue)) assert.deepEqual(pose, checkpoints.get(cue), `cue${cue} must not depend on previous camera state`);
  }
  const before = journey.camera.position.toArray();
  path.sample(journey, 300);
  assert.deepEqual(journey.camera.position.toArray(), before, "sampling a pose must not move the live camera");
});

test("the final face framing follows the loaded model's measured eyes", () => {
  const journey = fixture(), B = journey.witness.root.position;
  const F = new THREE.Vector3(-B.x, 0, -B.z).normalize();
  const eyes = B.clone().addScaledVector(F, .25).add(new THREE.Vector3(0, 5.2, 0));
  journey.witness.ready = true;
  journey.witness.facePosition = () => eyes.clone();
  const pose = path.update(journey, 330);
  assert.ok(Math.abs(journey.camera.position.y - eyes.y) < 1e-12, "camera height must use the actual rig");
  assert.ok(new THREE.Vector3(...pose.target).distanceTo(eyes) < 1e-12, "the final target must be the measured eyes");
  const towardCamera = journey.camera.position.clone().sub(eyes).normalize();
  assert.ok(towardCamera.dot(F) > .99, "the child must look straight toward the frontal camera");
});
