/* One continuous camera move: meadow, left foot, back, opposite side, face.
   No state is accumulated, so resize and reverse scrolling retrace the shot. */
(() => {
  "use strict";
  const clamp = value => Math.max(0, Math.min(1, value));
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = (a, b, value) => {
    const t = clamp((value - a) / (b - a));
    return t * t * t * (t * (t * 6 - 15) + 10);
  };
  const lerp = (a, b, t) => a.map((value, i) => mix(value, b[i], t));
  const vector = value => Array.isArray(value) ? value.slice(0, 3) : [value.x, value.y, value.z];
  function track(points, angle) {
    for (let i = 1; i < points.length; i++) {
      if (angle <= points[i][0]) return mix(points[i - 1][1], points[i][1], ease(points[i - 1][0], points[i][0], angle));
    }
    return points[points.length - 1][1];
  }
  function anchor(journey) {
    const witness = journey.witness || {};
    const root = witness.root || witness;
    const height = Number.isFinite(witness.height) ? witness.height : 148;
    const position = root.position ? vector(root.position) : [112, window.FateGrove ? window.FateGrove.groundHeight(112, 4) : 0, 4];
    const measuredFace = witness.ready && typeof witness.facePosition === "function" ? vector(witness.facePosition()) : null;
    const faceY = measuredFace ? measuredFace[1] - position[1] : Number.isFinite(witness.faceY) ? witness.faceY : height * 11 / 12;
    const face = measuredFace || [position[0], position[1] + faceY, position[2]];
    const length = Math.hypot(position[0], position[2]) || 1;
    const front = [-position[0] / length, 0, -position[2] / length];
    // Local left is +Z for a child who faces approximately west toward the blade.
    const left = [front[2], 0, -front[0]];
    return { position, front, left, height, faceY, face, scale: height / 6 };
  }
  function oldEnding(journey) {
    const camera = journey.camera;
    const aspect = camera.aspect || (journey.width || 1440) / (journey.height || 900);
    const mobile = !!journey.mobile;
    const framing = mobile ? Math.max(.7, .06 + .41 / aspect) : Math.max(.37, .7 - aspect * .3);
    const center = 2 * 1.25 * Math.pow(5.5 / 44, 1.8);
    const x = center + Math.tan((camera.fov || (mobile ? 49 : 42)) * Math.PI / 360) * 18 * aspect * framing + 44;
    return { camera: [x + .7, 3, 18], target: [x, 3, 0] };
  }
  function sample(journey, cue, startCamera, startTarget) {
    const base = anchor(journey), B = base.position, F = base.front, L = base.left, unit = base.scale;
    const fallback = oldEnding(journey);
    const start = startCamera ? vector(startCamera) : fallback.camera;
    const startFocus = startTarget ? vector(startTarget) : fallback.target;
    const mobile = !!journey.mobile;
    const footRadius = (mobile ? 3.6 : 2.9) * unit;
    const footEye = .4 * unit;
    const footAim = (mobile ? .7 : .65) * unit;
    const footCamera = [B[0] + L[0] * footRadius, B[1] + footEye, B[2] + L[2] * footRadius];
    const footTarget = [B[0] + L[0] * .25 * unit + F[0] * .08 * unit, B[1] + footAim, B[2] + L[2] * .25 * unit + F[2] * .08 * unit];
    let camera, target, phase, framing, angle = 0, radius = footRadius;
    if (cue < 250) {
      // Lower the frame before translating toward the child: his upper body
      // never passes through the first shot while the foot enters from the side.
      const stagingCamera = [start[0], footCamera[1], footCamera[2]];
      const stagingTarget = [startFocus[0], footTarget[1], footTarget[2]];
      if (cue <= 242) {
        const t = ease(234, 242, cue);
        camera = lerp(start, stagingCamera, t); target = lerp(startFocus, stagingTarget, t);
        phase = "witness-approach"; framing = "grass";
      } else {
        const t = ease(242, 250, cue);
        camera = lerp(stagingCamera, footCamera, t); target = lerp(stagingTarget, footTarget, t);
        phase = "witness-foot"; framing = "foot";
      }
    } else {
      const degrees = ease(250, 330, cue) * 270;
      angle = degrees * Math.PI / 180;
      const portrait = Math.max(1, .72 / (journey.camera.aspect || 1));
      radius = track([[0, footRadius], [20, 3.6 * unit], [45, 7.8 * unit * portrait], [82, 10 * unit * portrait], [100, 10 * unit * portrait], [180, 7.2 * unit * portrait], [240, 4.6 * unit], [270, (mobile ? 4.5 : 3.6) * unit]], degrees);
      const eye = track([[0, footEye], [20, 1.8 * unit], [45, 3 * unit], [82, base.faceY * .60], [100, base.faceY * .72], [180, base.faceY * .88], [240, base.faceY * .96], [270, base.faceY]], degrees);
      const aim = track([[0, footAim], [20, 1.4 * unit], [45, 2.7 * unit], [82, base.faceY * .58], [100, base.faceY * .62], [180, base.faceY * .90], [240, base.faceY * .965], [270, base.faceY]], degrees);
      const lead = track([[0, 0], [45, 0], [82, 1.1 * unit], [100, 1.1 * unit], [150, 0], [270, 0]], degrees);
      const footFocus = 1 - ease(0, 20, degrees);
      // 0° left, 90° back, 180° right, 270° directly in front.
      const radial = L.map((value, i) => value * Math.cos(angle) - F[i] * Math.sin(angle));
      camera = [B[0] + radial[0] * radius, B[1] + eye, B[2] + radial[2] * radius];
      target = [B[0] + F[0] * lead + (footTarget[0] - B[0]) * footFocus, B[1] + aim,
        B[2] + F[2] * lead + (footTarget[2] - B[2]) * footFocus];
      const faceFocus = ease(180, 250, degrees);
      target[0] += (base.face[0] - B[0]) * faceFocus;
      target[2] += (base.face[2] - B[2]) * faceFocus;
      if (degrees < 20) { phase = "witness-foot"; framing = "foot"; }
      else if (degrees < 82) { phase = "witness-rise"; framing = "body"; }
      else if (degrees <= 100) { phase = "witness-back"; framing = "back-and-blade"; }
      else if (degrees < 250) { phase = "witness-orbit"; framing = "head"; }
      else { phase = "witness-face"; framing = "face"; }
    }
    return { phase, framing, camera, target, focus: target.slice(), orbitAngle: angle, orbitDegrees: angle * 180 / Math.PI,
      actor: B.slice(), front: F.slice(), face: base.face.slice(), height: base.height, faceY: base.faceY, radius };
  }
  function update(journey, cue, startCamera, startTarget) {
    const pose = sample(journey, cue, startCamera, startTarget);
    journey.camera.position.fromArray(pose.camera);
    journey.target.fromArray(pose.target);
    journey.camera.lookAt(journey.target);
    journey.camera.updateMatrixWorld();
    return pose;
  }
  window.FateWitnessCamera = { update, sample, startCue: 234, footCue: 250, faceCue: 330, endCue: 340 };
})();
