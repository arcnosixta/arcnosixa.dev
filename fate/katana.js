/* A monumental ink-black blade and a black grove in a white world.
   Geometry and camera transforms are deterministic functions of the scroll score. */
(() => {
  "use strict";
  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = (a, b, value) => { const t = clamp((value - a) / (b - a)); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;
  const randomSource = initial => {
    let seed = initial;
    return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  };
  const bladeCenter = y => 1.55 * Math.pow(clamp(y / 44), 1.65) - .62 * (1 - smooth(0, 3.2, y));
  const bladeWidth = y => 2.15 * smooth(0, 2.6, y) * (1 - .12 * clamp(y / 44));
  const groundHeight = (x, z) => Math.sin((x + .62) * .08) * .13 + Math.sin(z * .12) * .085;

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
      this.terrain = new THREE.Group();
      this.terrain.name = "black-grove";
      this.scene.add(this.katana, this.terrain);
      this.terrainMaterials = [];
      this.makeKatana();
      this.makeGrove();
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
      const face = this.material(0x0b0b0e);
      const bevel = this.material(0x2a2b2f);
      const crimson = this.material(0xb10925);
      const darkCrimson = this.material(0x720b1c);
      const positions = [], indices = [];
      const steps = 176;
      // An actual eight-sided cross-section: a broad dark face and narrow bevels.
      for (let i = 0; i <= steps; i++) {
        const y = i / steps * 44, x = bladeCenter(y), w = Math.max(.002, bladeWidth(y));
        const inset = Math.min(.11, w * .22);
        const section = [[-w / 2, 0], [-w / 2 + inset, .12], [w / 2 - inset, .12], [w / 2, .035],
          [w / 2, -.035], [w / 2 - inset, -.12], [-w / 2 + inset, -.12], [-w / 2, -.015]];
        section.forEach(([dx, z]) => positions.push(x + dx, y, z));
      }
      const geometry = this.own(new T.BufferGeometry());
      geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
      for (let side = 0; side < 8; side++) {
        const first = indices.length;
        for (let i = 0; i < steps; i++) {
          const a = i * 8 + side, b = i * 8 + (side + 1) % 8;
          const c = a + 8, d = b + 8;
          indices.push(a, b, c, b, d, c);
        }
        geometry.addGroup(first, indices.length - first, side === 0 || side === 6 ? 2 : side === 1 || side === 5 ? 1 : 0);
      }
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const blade = new T.Mesh(geometry, [black, face, bevel]);
      blade.name = "curved-black-blade";
      this.katana.add(blade);

      const ribbon = (path, width, material, z = .125) => {
        const vertices = [], triangles = [];
        for (let i = 0; i < path.length; i++) {
          const previous = path[Math.max(0, i - 1)], next = path[Math.min(path.length - 1, i + 1)];
          const dx = next[0] - previous[0], dy = next[1] - previous[1], length = Math.hypot(dx, dy) || 1;
          const nx = -dy / length * width / 2, ny = dx / length * width / 2;
          vertices.push(path[i][0] + nx, path[i][1] + ny, z, path[i][0] - nx, path[i][1] - ny, z);
          if (i < path.length - 1) { const a = i * 2; triangles.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        }
        const g = new T.BufferGeometry();
        g.setAttribute("position", new T.Float32BufferAttribute(vertices, 3)); g.setIndex(triangles); g.computeVertexNormals();
        return this.mesh(g, material);
      };
      // Etching follows the curvature instead of floating beside the steel.
      const river = [], edge = [];
      for (let i = 0; i <= 220; i++) {
        const y = 2.1 + i / 220 * 40.7;
        river.push([bladeCenter(y) + Math.sin(y * .67) * .245 + Math.sin(y * 1.71) * .035, y]);
        edge.push([bladeCenter(y) - bladeWidth(y) * .34 + Math.sin(y * 1.25) * .045, y]);
      }
      ribbon(river, .065, crimson);
      ribbon(edge, .025, darkCrimson);
      for (let mark = 0; mark < 7; mark++) {
        const y = 5.2 + mark * 5.45, x = bladeCenter(y);
        const knot = [[x, y - 1.1], [x - .48, y - .34], [x + .36, y + .2], [x, y + 1.05],
          [x - .29, y + .22], [x + .48, y - .34], [x, y - 1.1]];
        ribbon(knot, .045, crimson, .132);
        ribbon([[x - .58, y + .55], [x - .19, y + .28], [x + .09, y + .5]], .025, darkCrimson, .134);
      }

      const shoulder = bladeCenter(44);
      const collar = this.mesh(new T.BoxGeometry(2.02, .42, .4), black);
      collar.position.set(shoulder, 44.13, 0);
      const collarLine = this.mesh(new T.BoxGeometry(1.98, .045, .415), crimson);
      collarLine.position.set(shoulder, 44.22, 0);
      const guard = this.mesh(new T.CylinderGeometry(1.96, 1.96, .28, 32), black);
      guard.scale.z = .54; guard.position.set(shoulder, 44.58, 0);
      const guardRim = this.mesh(new T.CylinderGeometry(1.82, 1.82, .035, 32), bevel);
      guardRim.scale.z = .54; guardRim.position.set(shoulder, 44.73, 0);
      const grip = this.mesh(new T.CylinderGeometry(.48, .52, 8.45, 12), black);
      grip.scale.z = .69; grip.position.set(shoulder, 49.02, 0);
      // Red underwrap diamonds are inset into a black tsuka, not a red handle.
      const diamondVertices = [], diamondIndices = [];
      for (let i = 0; i < 11; i++) {
        const y = 45.2 + i * .72, halfWidth = .28, halfHeight = .29;
        const base = diamondVertices.length / 3;
        diamondVertices.push(shoulder, y - halfHeight, .365, shoulder + halfWidth, y, .365,
          shoulder, y + halfHeight, .365, shoulder - halfWidth, y, .365);
        diamondIndices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
      const wrapGeometry = new T.BufferGeometry();
      wrapGeometry.setAttribute("position", new T.Float32BufferAttribute(diamondVertices, 3));
      wrapGeometry.setIndex(diamondIndices); wrapGeometry.computeVertexNormals();
      this.mesh(wrapGeometry, darkCrimson);
      const pommel = this.mesh(new T.CylinderGeometry(.51, .49, .36, 12), black);
      pommel.scale.z = .72; pommel.position.set(shoulder, 53.42, 0);
      const pommelScar = this.mesh(new T.BoxGeometry(.13, .26, .025), crimson);
      pommelScar.position.set(shoulder, 53.42, .379);
    }
    makeGrove() {
      const T = this.T, random = randomSource(87291);
      const earth = this.material(0x030303, { transparent: true, opacity: 0, side: T.DoubleSide });
      const treeInk = this.material(0x030303, { transparent: true, opacity: 0 });
      const grassInk = this.material(0x030303, { transparent: true, opacity: 0, side: T.DoubleSide });
      this.terrainMaterials.push(earth, treeInk, grassInk);
      const ground = new T.PlaneGeometry(300, 220, 80, 44);
      ground.rotateX(-Math.PI / 2); ground.translate(30, -.055, -85);
      const groundPositions = ground.attributes.position;
      for (let i = 0; i < groundPositions.count; i++) groundPositions.setY(i, groundHeight(groundPositions.getX(i), groundPositions.getZ(i)) + .015);
      ground.computeVertexNormals();
      this.mesh(ground, earth, this.terrain);

      const vertices = [], triangles = [];
      const segment = (a, b, r1, r2, sides = 6) => {
        const axis = new T.Vector3().subVectors(b, a).normalize();
        const normal = new T.Vector3(Math.abs(axis.y) < .94 ? 0 : 1, Math.abs(axis.y) < .94 ? 1 : 0, 0).cross(axis).normalize();
        const across = new T.Vector3().crossVectors(axis, normal);
        const first = vertices.length / 3;
        for (const [center, radius] of [[a, r1], [b, r2]]) {
          for (let j = 0; j < sides; j++) {
            const angle = j / sides * Math.PI * 2;
            const p = center.clone().addScaledVector(normal, Math.cos(angle) * radius).addScaledVector(across, Math.sin(angle) * radius);
            vertices.push(p.x, p.y, p.z);
          }
        }
        for (let j = 0; j < sides; j++) {
          const k = (j + 1) % sides;
          triangles.push(first + j, first + k, first + sides + j, first + k, first + sides + k, first + sides + j);
        }
      };
      const ellipsoid = (center, radii, rings = 7, sides = 14) => {
        const first = vertices.length / 3;
        for (let ring = 0; ring <= rings; ring++) {
          const phi = ring / rings * Math.PI;
          for (let side = 0; side <= sides; side++) {
            const theta = side / sides * Math.PI * 2;
            vertices.push(center.x + Math.sin(phi) * Math.cos(theta) * radii.x,
              center.y + Math.cos(phi) * radii.y, center.z + Math.sin(phi) * Math.sin(theta) * radii.z);
          }
        }
        for (let ring = 0; ring < rings; ring++) for (let side = 0; side < sides; side++) {
          const a = first + ring * (sides + 1) + side, b = a + sides + 1;
          triangles.push(a, a + 1, b, a + 1, b + 1, b);
        }
      };
      const tree = (x, z, height, kind) => {
        const base = new T.Vector3(x, groundHeight(x, z), z);
        const lean = (random() - .5) * height * .11;
        const crown = base.clone().add(new T.Vector3(lean, height, 0));
        const radius = height * (.019 + random() * .009);
        segment(base, crown, radius, .025);
        if (kind === "pine") {
          for (let tier = 0; tier < 7; tier++) {
            const y = height * (.25 + tier * .095), spread = height * (.22 - tier * .025);
            const b = base.clone().add(new T.Vector3(lean * y / height, y, 0));
            segment(b, b.clone().add(new T.Vector3(0, height * .28, 0)), spread, .01, 7);
          }
          return;
        }
        const count = kind === "bare" ? 8 : 6;
        for (let branch = 0; branch < count; branch++) {
          const fraction = .36 + branch / count * .55;
          const start = base.clone().lerp(crown, fraction);
          const side = branch % 2 ? 1 : -1;
          const end = start.clone().add(new T.Vector3(side * height * (.15 + random() * .12), height * (.12 + random() * .15), (random() - .5) * height * .2));
          segment(start, end, radius * .57, .02);
          for (let twig = 0; twig < 3; twig++) {
            const fork = start.clone().lerp(end, .4 + twig * .22);
            const tip = fork.clone().add(new T.Vector3(side * height * (.065 + random() * .05), height * (.1 + random() * .1), (random() - .5) * height * .13));
            segment(fork, tip, radius * .24, .006, 5);
          }
          if (kind === "crown") ellipsoid(end, new T.Vector3(height * (.13 + random() * .08), height * (.09 + random() * .06), height * .12));
        }
      };
      // Three depth layers yield real parallax as the camera translates sideways.
      const foreground = [[10, 7, 15, "bare"], [26, 5, 17, "crown"], [43, 8, 16, "bare"], [61, 6, 18, "pine"], [80, 7, 17, "crown"]];
      foreground.forEach(data => tree(...data));
      for (let i = 0; i < 12; i++) tree(-22 + i * 10 + random() * 3, -10 - random() * 12,
        9 + random() * 8, i % 3 === 0 ? "bare" : i % 3 === 1 ? "crown" : "pine");
      const distantCount = this.quality < 1 ? 28 : 52;
      for (let i = 0; i < distantCount; i++) tree(-45 + i / distantCount * 190, -34 - random() * 26,
        8 + random() * 10, i % 4 === 0 ? "bare" : i % 3 === 0 ? "crown" : "pine");
      const treeGeometry = new T.BufferGeometry();
      treeGeometry.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
      treeGeometry.setIndex(triangles); treeGeometry.computeVertexNormals();
      this.mesh(treeGeometry, treeInk, this.terrain);

      const grass = [], grassCount = this.quality < 1 ? 1050 : 2400;
      for (let i = 0; i < grassCount; i++) {
        const x = -35 + random() * 150, z = -21 + random() * 33, y = groundHeight(x, z);
        const height = .16 + Math.pow(random(), 2) * .75, width = .025 + random() * .06;
        grass.push(x - width, y, z, x + width, y, z, x + (random() - .5) * .33, y + height, z + (random() - .5) * .1);
      }
      const grassGeometry = new T.BufferGeometry();
      grassGeometry.setAttribute("position", new T.Float32BufferAttribute(grass, 3));
      grassGeometry.computeVertexNormals();
      this.mesh(grassGeometry, grassInk, this.terrain);
      const stones = [], stoneIndices = [];
      // Low angular stones make the ground plane legible without introducing color.
      for (let i = 0; i < 80; i++) {
        const x = -25 + random() * 130, z = -19 + random() * 29, y = groundHeight(x, z);
        const radius = .1 + random() * .55, first = stones.length / 3;
        stones.push(x - radius, y, z, x, y + radius * .55, z - radius * .2, x + radius, y, z,
          x, y + radius * .2, z + radius * .8);
        stoneIndices.push(first, first + 1, first + 2, first, first + 3, first + 1, first + 1, first + 3, first + 2);
      }
      const stoneGeometry = new T.BufferGeometry();
      stoneGeometry.setAttribute("position", new T.Float32BufferAttribute(stones, 3));
      stoneGeometry.setIndex(stoneIndices); stoneGeometry.computeVertexNormals();
      this.mesh(stoneGeometry, treeInk, this.terrain);
    }
    resize(width, height) {
      this.mobile = width < 700;
      this.width = Math.max(1, width); this.height = Math.max(1, height);
      this.camera.aspect = this.width / this.height;
      this.camera.fov = this.mobile ? 49 : 42;
      this.camera.updateProjectionMatrix();
    }
    update(score, time = 0) {
      if (this.disposed) return;
      this.score = score;
      this.katana.visible = score > 128;
      this.katana.position.y = mix(80, 0, smooth(128, 146, score));
      this.katana.rotation.z = mix(-.035, 0, smooth(132, 146, score));
      const descent = smooth(146, 194, score);
      const height = mix(44, 3, descent);
      const distance = mix(48, 18, smooth(146, 154, score));
      const halfWidth = Math.tan(this.camera.fov * Math.PI / 360) * distance * this.camera.aspect;
      const offset = halfWidth * (this.mobile ? .53 : .37);
      const bladeX = bladeCenter(Math.min(44, height));
      const baseX = bladeCenter(3) + Math.tan(this.camera.fov * Math.PI / 360) * 18 * this.camera.aspect * (this.mobile ? .53 : .37);
      const travel = smooth(206, 234, score) * 44;
      const x = score >= 206 ? baseX + travel : bladeX + offset;
      // At q194 the tip has been reached; from q206 both Y values are constant.
      this.camera.position.set(x + .7, height, distance);
      this.target.set(x, height, 0);
      this.camera.lookAt(this.target);
      this.camera.updateMatrixWorld();
      const terrainAlpha = smooth(186, 198, score);
      this.terrain.visible = terrainAlpha > 0;
      this.terrainMaterials.forEach(material => { material.opacity = terrainAlpha; });
      this.phase = score <= 128 ? "white" : score < 146 ? "fall" : score < 194 ? "blade" : score < 206 ? "ground" : score < 236 ? "grove" : "ending";
    }
    snapshot() {
      const angle = this.katana.rotation.z;
      return { score: this.score, phase: this.phase, camera: this.camera.position.toArray(), target: this.target.toArray(),
        katanaY: this.katana.position.y, tip: [bladeCenter(0) * Math.cos(angle), this.katana.position.y + bladeCenter(0) * Math.sin(angle), 0],
        swordVisible: this.katana.visible, groundVisible: this.terrain.visible, terrain: this.terrain.visible,
        terrainOpacity: this.terrainMaterials[0].opacity, mobile: this.mobile };
    }
    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      this.resources.forEach(resource => resource.dispose());
      this.resources.clear(); this.scene.clear();
    }
  }
  window.FateJourney = FateJourney;
})();
