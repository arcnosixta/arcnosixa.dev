/* A monumental ink-black blade and a black grove in a white world.
   Geometry and camera transforms are deterministic functions of the scroll score. */
(() => {
  "use strict";
  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = (a, b, value) => { const t = clamp((value - a) / (b - a)); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;
  const bladeCenter = y => 1.25 * Math.pow(clamp(y / 44), 1.8) - .62 * (1 - clamp(y / 4.2));
  const bladeWidth = y => y < 4.2 ? 1.12 * clamp(y / 4.2) : mix(1.12, 1.5, clamp((y - 4.2) / 39.8));

  class FateJourney {
    constructor(THREE, { quality = 1 } = {}) {
      this.T = THREE;
      this.quality = quality;
      this.resources = new Set();
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0xffffff);
      this.camera = new THREE.PerspectiveCamera(42, 1, .1, 240);
      this.target = new THREE.Vector3();
      this.katana = new THREE.Group();
      this.katana.name = "black-katana";
      this.katana.scale.setScalar(2);
      this.katana.rotation.y = Math.PI / 4;
      this.terrain = new THREE.Group();
      this.terrain.name = "black-grove";
      this.scene.add(this.katana, this.terrain);
      this.terrainMaterials = [];
      this.makeKatana();
      this.makeGrove();
      if (!this.brave && window.FateWitness) this.witness = new window.FateWitness(THREE, {
        scene: this.scene, quality, x: 112, z: 4, groundY: this.groundHeight(112, 4), height: 148
      });
      this.resize(1440, 900);
      this.update(0, 0);
    }
    own(resource) { this.resources.add(resource); return resource; }
    material(color, extra = {}) {
      const material = this.own(new this.T.MeshBasicMaterial({ color, ...extra }));
      // r147 runs in legacy color mode; the renderer encodes its output as sRGB.
      // Decode literal ink/crimson colors once so they do not become grey/pink.
      material.color.convertSRGBToLinear();
      return material;
    }
    mesh(geometry, material, parent = this.katana) {
      const result = new this.T.Mesh(this.own(geometry), material);
      parent.add(result);
      return result;
    }
    makeKatana() {
      const T = this.T;
      const black = this.material(0x030304);
      const steel = this.material(0x0c0e11);
      const edgeSteel = this.material(0x30343a);
      const bevel = this.material(0x202329);
      const tipSteel = this.material(0x1a1d22);
      const crimson = this.material(0x961025);
      const darkCrimson = this.material(0x5e0a18);
      const metal = this.material(0x171a1e);
      const shoulder = bladeCenter(44);
      const stations = [0, 4.2];
      for (let y = 4.45; y < 44; y += .22) stations.push(y);
      stations.push(44);
      const positions = [], buckets = [[], [], [], [], []];
      const section = [[-.5, 0], [-.4, .055], [-.08, .15], [.46, .085], [.5, .045], [.5, -.045], [-.08, -.15], [-.4, -.055]];
      stations.forEach(y => {
        const w = Math.max(.001, bladeWidth(y)), depth = Math.min(1, y / 4.2), x = bladeCenter(y);
        section.forEach(([fraction, z]) => positions.push(x + fraction * w, y, z * depth));
      });
      for (let i = 0; i < stations.length - 1; i++) for (let side = 0; side < 8; side++) {
        const a = i * 8 + side, b = i * 8 + (side + 1) % 8, c = a + 8, d = b + 8;
        let surface = side === 0 || side === 7 ? 2 : side === 1 || side === 6 ? 3 : side === 4 ? 0 : 1;
        if (i === 0 && side >= 1 && side <= 3) surface = 4;
        buckets[surface].push(a, b, c, b, d, c);
      }
      const geometry = this.own(new T.BufferGeometry()), indices = [];
      geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
      buckets.forEach((triangles, material) => { geometry.addGroup(indices.length, triangles.length, material); indices.push(...triangles); });
      geometry.setIndex(indices); geometry.computeVertexNormals();
      const blade = new T.Mesh(geometry, [black, steel, edgeSteel, bevel, tipSteel]);
      blade.name = "curved-black-blade"; this.katana.add(blade);

      const frontSurface = (x, y) => {
        const fraction = (x - bladeCenter(y)) / Math.max(.001, bladeWidth(y));
        const profile = section.slice(0, 5);
        for (let i = 1; i < profile.length; i++) if (fraction <= profile[i][0]) {
          return mix(profile[i - 1][1], profile[i][1], clamp((fraction - profile[i - 1][0]) / (profile[i][0] - profile[i - 1][0]))) * Math.min(1, y / 4.2);
        }
        return .045;
      };
      const inkPositions = [], inkIndices = [];
      const ribbon = (path, width) => {
        const first = inkPositions.length / 3;
        path.forEach(([x, y], i) => {
          const previous = path[Math.max(0, i - 1)], next = path[Math.min(path.length - 1, i + 1)];
          const dx = next[0] - previous[0], dy = next[1] - previous[1], length = Math.hypot(dx, dy) || 1;
          for (const side of [-1, 1]) {
            const px = x + side * dy / length * width / 2, py = y - side * dx / length * width / 2;
            inkPositions.push(px, py, frontSurface(px, py) + .004);
          }
          if (i < path.length - 1) { const a = first + i * 2; inkIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        });
      };
      const spineTrace = [], hairline = [];
      for (let i = 0; i <= 230; i++) {
        const y = 4.8 + i / 230 * 38.1, w = bladeWidth(y);
        spineTrace.push([bladeCenter(y) + w * (.22 + Math.sin(y * .58) * .035), y]);
        hairline.push([bladeCenter(y) + w * (.31 + Math.sin(y * .58 + .3) * .02), y]);
      }
      ribbon(spineTrace, .025); ribbon(hairline, .009);
      for (let mark = 0; mark < 6; mark++) {
        const y = 7.2 + mark * 6.2, x = bladeCenter(y) + bladeWidth(y) * .22;
        ribbon([[x, y - .62], [x - .12, y - .18], [x + .11, y + .12], [x + .02, y + .65]], .017);
        ribbon([[x - .11, y - .19], [x - .21, y - .06], [x - .17, y + .22]], .011);
      }
      const engraving = new T.BufferGeometry();
      engraving.setAttribute("position", new T.Float32BufferAttribute(inkPositions, 3)); engraving.setIndex(inkIndices); engraving.computeVertexNormals();
      this.mesh(engraving, crimson).name = "crimson-steel-inlay";
      const yokotePoints = [new T.Vector3(bladeCenter(4.2) - bladeWidth(4.2) * .49, 4.2, .006),
        new T.Vector3(bladeCenter(4.2) - bladeWidth(4.2) * .08, 4.2, .154),
        new T.Vector3(bladeCenter(4.2) + bladeWidth(4.2) * .46, 4.2, .09)];
      const yokote = this.mesh(new T.TubeGeometry(new T.CatmullRomCurve3(yokotePoints), 12, .012, 4, false), edgeSteel);
      yokote.name = "kissaki-yokote";

      const merge = parts => {
        const vertices = [], normals = [];
        parts.forEach(part => {
          const expanded = part.index ? part.toNonIndexed() : part;
          vertices.push(...expanded.attributes.position.array);
          if (!expanded.attributes.normal) expanded.computeVertexNormals();
          normals.push(...expanded.attributes.normal.array);
          if (expanded !== part) expanded.dispose(); part.dispose();
        });
        const g = new T.BufferGeometry();
        g.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
        g.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
        return g;
      };
      const extrude = (points, depth, holes = []) => {
        const shape = new T.Shape(points.map(([x, y]) => new T.Vector2(x, y)));
        holes.forEach(points => shape.holes.push(new T.Path(points.map(([x, y]) => new T.Vector2(x, y)))));
        return new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: .023, bevelSize: .023, bevelSegments: 1, steps: 1 });
      };
      const habakiGeometry = extrude([[-.88, 0], [-.77, -.59], [.75, -.59], [.86, 0]], .39);
      habakiGeometry.translate(shoulder, 44.5, -.195);
      this.mesh(habakiGeometry, metal).name = "katana-habaki";
      const habakiLip = this.mesh(new T.BoxGeometry(1.68, .035, .41), edgeSteel); habakiLip.position.set(shoulder, 44.47, 0);

      // Open four-hook guard: shaped metal around a real aperture, not a disk.
      const guardParts = [];
      const hub = extrude([[-.98, -.58], [.98, -.58], [.98, .58], [-.98, .58]], .21,
        [[[-.83, -.22], [-.83, .22], [.83, .22], [.83, -.22]]]);
      hub.rotateX(-Math.PI / 2); guardParts.push(hub);
      for (let arm = 0; arm < 4; arm++) {
        const hook = extrude([[.71, -.19], [1.53, -.19], [1.53, .82], [1.27, .82], [1.27, .09], [.71, .09]], .21);
        hook.rotateX(-Math.PI / 2); hook.rotateY(arm * Math.PI / 2); guardParts.push(hook);
      }
      const guardGeometry = merge(guardParts), colors = [];
      for (let i = 0; i < guardGeometry.attributes.normal.count; i++) {
        const normal = new T.Vector3().fromBufferAttribute(guardGeometry.attributes.normal, i);
        const shade = .034 + Math.abs(normal.z) * .055 + Math.abs(normal.x) * .012;
        const color = new T.Color(shade, shade, shade).convertSRGBToLinear(); colors.push(color.r, color.g, color.b);
      }
      guardGeometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
      const guard = this.mesh(guardGeometry, this.material(0xffffff, { vertexColors: true }));
      guard.name = "katana-angular-guard"; guard.position.set(shoulder, 44.64, 0);

      const grip = new T.Group(); grip.name = "katana-grip"; grip.position.set(shoulder, 45, 0); grip.rotation.z = -Math.atan(.035); this.katana.add(grip);
      const underwrap = this.mesh(new T.CylinderGeometry(.39, .43, 8.25, 28), darkCrimson, grip);
      underwrap.scale.z = .68; underwrap.position.y = 4.25; underwrap.name = "tsuka-red-underwrap";
      const wrapParts = [], bandWidth = .15;
      for (let row = 0; row < 14; row++) for (const direction of [-1, 1]) for (const face of [-1, 1]) {
        const vertices = [], triangles = [];
        const center = .3 + row * .6;
        for (let i = 0; i <= 28; i++) {
          const angle = -Math.PI / 2 + i / 28 * Math.PI;
          const x = Math.sin(angle) * .447, z = Math.cos(angle) * .306 * face;
          const y = center + direction * Math.sin(angle) * .315;
          for (const side of [-1, 1]) vertices.push(x, Math.max(.12, Math.min(8.35, y + side * bandWidth / 2)), z);
          if (i < 28) { const a = i * 2; triangles.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        }
        const band = new T.BufferGeometry(); band.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
        band.setIndex(triangles); band.computeVertexNormals(); wrapParts.push(band);
      }
      // Double-sided only for the thin wrap bands that bend around the oval core.
      const wrap = this.mesh(merge(wrapParts), this.material(0x030304, { side: T.DoubleSide }), grip); wrap.name = "katana-wrap";
      const fuchi = this.mesh(new T.CylinderGeometry(.455, .47, .39, 28), black, grip); fuchi.scale.z = .7; fuchi.position.y = .05; fuchi.name = "katana-fuchi";
      const fuchiLip = this.mesh(new T.CylinderGeometry(.462, .462, .035, 28), metal, grip); fuchiLip.scale.z = .7; fuchiLip.position.y = .245;
      const cap = this.mesh(new T.CylinderGeometry(.43, .415, .34, 28), black, grip); cap.scale.z = .72; cap.position.y = 8.52; cap.name = "katana-kashira";
      const capLip = this.mesh(new T.CylinderGeometry(.437, .437, .034, 28), metal, grip); capLip.scale.z = .72; capLip.position.y = 8.36;
      const menuki = this.mesh(new T.SphereGeometry(.095, 10, 6), metal, grip); menuki.scale.set(1, .5, .3); menuki.position.set(.1, 2.4, .304);

      // One merged mesh of individually modelled, alternating interlocking links.
      const chainCurve = new T.CatmullRomCurve3([new T.Vector3(shoulder + .60, 53.7, .03),
        new T.Vector3(shoulder + 1.05, 52.5, .12), new T.Vector3(shoulder + 1.28, 47.5, .27),
        new T.Vector3(shoulder + 1.05, 41.9, .42), new T.Vector3(shoulder + .36, 36.3, .45), new T.Vector3(shoulder - .95, 34.1, .20)]);
      const chainPositions = [], chainTriangles = [], linkCount = Math.ceil(chainCurve.getLength() / .29), sides = 6, segments = 16;
      const chainPoints = chainCurve.getSpacedPoints(linkCount - 1);
      chainPoints.forEach((center, link) => {
        const tangent = chainCurve.getTangentAt(link / (linkCount - 1)).normalize();
        const side = new T.Vector3(tangent.y, -tangent.x, 0).normalize();
        const normal = new T.Vector3().crossVectors(side, tangent).normalize();
        if (link % 2) { const previous = side.clone(); side.copy(normal); normal.copy(previous).negate(); }
        const first = chainPositions.length / 3;
        for (let ring = 0; ring <= segments; ring++) {
          const theta = ring / segments * Math.PI * 2, rx = .112, ry = .19;
          const c = center.clone().addScaledVector(side, Math.cos(theta) * rx).addScaledVector(tangent, Math.sin(theta) * ry);
          const outward = side.clone().multiplyScalar(Math.cos(theta) * ry).addScaledVector(tangent, Math.sin(theta) * rx).normalize();
          for (let face = 0; face <= sides; face++) {
            const phi = face / sides * Math.PI * 2;
            const point = c.clone().addScaledVector(outward, Math.cos(phi) * .027).addScaledVector(normal, Math.sin(phi) * .027);
            chainPositions.push(point.x, point.y, point.z);
          }
        }
        for (let ring = 0; ring < segments; ring++) for (let face = 0; face < sides; face++) {
          const a = first + ring * (sides + 1) + face, b = a + sides + 1;
          chainTriangles.push(a, b, a + 1, a + 1, b, b + 1);
        }
      });
      const chainGeometry = new T.BufferGeometry(); chainGeometry.setAttribute("position", new T.Float32BufferAttribute(chainPositions, 3));
      chainGeometry.setIndex(chainTriangles); chainGeometry.computeVertexNormals();
      this.mesh(chainGeometry, metal).name = "katana-chain";
    }
    makeGrove() {
      if (window.FateBrave) this.brave = new window.FateBrave(this);
      else window.FateGrove.build(this);
    }
    resize(width, height) {
      this.mobile = width <= 700;
      this.width = Math.max(1, width); this.height = Math.max(1, height);
      this.camera.aspect = this.width / this.height;
      this.camera.fov = this.mobile ? 49 : 42;
      this.camera.updateProjectionMatrix();
    }
    update(score, time = 0) {
      if (this.disposed) return;
      this.score = score;
      const far = this.brave ? 1200 : this.witness ? mix(240, 900, smooth(234, 250, score)) : 240;
      if (this.camera.far !== far) { this.camera.far = far; this.camera.updateProjectionMatrix(); }
      this.witness?.update(score, time);
      this.katana.visible = score > 128;
      const fall = smooth(128, 146, score);
      this.katana.position.y = mix(330, -8, fall);
      this.katana.rotation.z = mix(-.035, 0, smooth(132, 146, score));
      const descent = smooth(146, 194, score);
      let targetHeight = score < 146 ? mix(230, 88, fall) : mix(88, 32, descent);
      let eyeHeight = targetHeight - 10;
      const distance = score < 146 ? mix(18, 124, fall) : mix(124, 18, smooth(146, 154, score));
      if (score >= 194) {
        const groundArrival = smooth(194, 206, score);
        eyeHeight = mix(22, 3, groundArrival);
        targetHeight = mix(32, 3, groundArrival);
      }
      const halfWidth = Math.tan(this.camera.fov * Math.PI / 360) * distance * this.camera.aspect;
      // The narrow portrait frame deliberately crops the blade's far left edge
      // so the enormous guard and hanging chain also clear the text column.
      const framing = this.mobile ? Math.max(.7, .06 + .41 / this.camera.aspect) : Math.max(.37, .7 - this.camera.aspect * .3);
      const offset = halfWidth * framing;
      const bladeX = 2 * bladeCenter(clamp((targetHeight + 8) / 88) * 44);
      const baseX = 2 * bladeCenter(5.5) + Math.tan(this.camera.fov * Math.PI / 360) * 18 * this.camera.aspect * framing;
      const travel = smooth(206, 234, score) * 44;
      const x = score >= 206 ? baseX + travel : bladeX + offset;
      // During the information passage we look upward, with the pre-existing
      // landscape below the frustum. Its reveal is a separate downward move.
      this.camera.position.set(x + .7, eyeHeight, distance);
      this.target.set(x, targetHeight, 0);
      // At the mobile wide establishing distance, aim higher until the zoom
      // closes in; otherwise the wider vertical FOV catches the distant grove.
      if (this.mobile) this.target.y += 40 * smooth(134, 146, score) * (1 - smooth(146, 154, score));
      this.camera.lookAt(this.target);
      this.camera.updateMatrixWorld();
      if (score >= 234 && this.witness && window.FateWitnessCamera) {
        this.witnessPose = window.FateWitnessCamera.update(this, score, this.camera.position.toArray(), this.target.toArray());
      }
      this.terrain.visible = true;
      this.terrainMaterials.forEach(material => { material.opacity = 1; });
      this.phase = score <= 128 ? "white" : score < 146 ? "fall" : score < 194 ? "blade" : score < 206 ? "ground" : score < 236 ? "grove" : "ending";
      this.brave?.update(score, time);
    }
    snapshot() {
      const scale = this.katana.scale.x;
      this.katana.updateMatrixWorld(true);
      const tip = this.katana.localToWorld(new this.T.Vector3(bladeCenter(0), 0, 0));
      return { score: this.score, phase: this.phase, camera: this.camera.position.toArray(), target: this.target.toArray(),
        katanaY: this.katana.position.y, tip: tip.toArray(),
        scale, embedDepth: 8,
        swordVisible: this.katana.visible, groundVisible: this.terrain.visible, terrain: this.terrain.visible,
        terrainOpacity: this.terrainMaterials[0].opacity, mobile: this.mobile };
    }
    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      this.witness?.dispose();
      this.brave?.dispose();
      this.resources.forEach(resource => resource.dispose());
      this.resources.clear(); this.scene.clear();
    }
  }
  window.FateJourney = FateJourney;
})();
