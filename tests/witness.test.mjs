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
async function loadActorGeometry() {
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
    scene: new THREE.Scene(), x: 66, z: 4, groundY: scope.window.FateGrove.groundHeight, height: 6,
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
    assert.ok(Math.hypot(pose.camera[0] - B.x, pose.camera[2] - B.z) < 3.4,
      "the foot camera must remain inside the meadow's clear patch");
  }
});

test("the real skinned shoes have complete silhouettes and margin in the lower part of the foot shot", async () => {
  const actor = await loadActorGeometry();
  try {
    const vertices = [], point = new THREE.Vector3();
    actor.root.updateMatrixWorld(true);
    actor.root.traverse(object => {
      if (!object.isMesh) return;
      const positions = object.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i);
        if (object.isSkinnedMesh) object.boneTransform(i, point);
        point.applyMatrix4(object.matrixWorld);
        if (point.y <= actor.groundY + .75) vertices.push(point.clone());
      }
    });
    assert.ok(vertices.length > 1000, "the framing regression must use the loaded, deformed shoe geometry");
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
      assert.ok(bounds.getSize(new THREE.Vector2()).y >= .25, "shoes must read at an intentional close-up size");
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

test("the back shot faces the katana and retains a towering blade above the child", () => {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const journey = fixture(width, height), cue = cueAtAngle(journey, 90);
    const pose = path.update(journey, cue), B = journey.witness.root.position;
    const view = new THREE.Vector3(...pose.target).sub(journey.camera.position).normalize();
    const katana = new THREE.Vector3(-B.x, 0, -B.z).normalize();
    assert.ok(view.dot(katana) > .99, "the boy's back view must look toward the planted katana");
    const crown = projected(journey, [B.x, B.y + 6, B.z]);
    // A 99-unit black blade with a real cross-section and the scene's fixed 45° yaw.
    // Only its upper visible section needs to clear the child's silhouette.
    const blade = [];
    for (let y = 5; y <= 99; y += .5) {
      for (const x of [-1.25, 0, 1.25]) for (const z of [-.18, .18]) blade.push([x, y, z]);
    }
    const yaw = new THREE.Matrix4().makeRotationY(Math.PI / 4);
    const clear = blade.map(point => new THREE.Vector3(...point).applyMatrix4(yaw))
      .map(point => projected(journey, point.toArray())).filter(point => inView(point) && point.y > crown.y + .02);
    assert.ok(clear.length >= 30, "a substantial blade section must remain in frame above the boy's head");
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
