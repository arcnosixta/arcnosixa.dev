/* A field of steel, from its first fall to its final silhouette. */
(() => {
  "use strict";
  const clamp = value => Math.max(0, Math.min(1, value));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const secondaryHeightScale = 1.26;
  const parts = {
    blade: { depth: .013, bevel: .0025, face: 0x08090b, rim: 0x24262a },
    guard: { depth: .024, bevel: .003, face: 0x131417, rim: 0x25272b },
    grip: { depth: .026, bevel: .0025, face: 0x111114, rim: 0x1d1e22 },
    pommel: { depth: .028, bevel: .0025, face: 0x1a1b1e, rim: 0x25272b },
    ornament: { depth: .006, bevel: .001, face: 0x121316, rim: 0x1c1d21 },
  };
  // The first impacts are staged for the low camera at the hero blade. The
  // broader bands become visible as the same camera retreats from the meadow.
  const openers = [
    ["katana", 12, -42, 34, 0], ["short-cleaver", -12, -49, 37, .036],
    ["ken", 23, -58, 32, .074], ["greatsword", -25, -65, 49, .102],
    ["naginata", 13, -79, 51, .147], ["hooked-cleaver", 36, -51, 40, .185],
    ["tachi", -17, -96, 57, .224], ["chained-cleaver", 28, -106, 50, .259],
    ["angular-cleaver", -41, -58, 42, .301], ["greatsword", 57, -88, 53, .347],
    ["katana", 45, -32, 25, .399], ["tachi", -52, -37, 32, .452],
  ];
  const bands = [
    { x: 90, near: -27, far: -128, columns: 12, rows: 5, low: 18, high: 46, launch: [.06, .55] },
    { x: 220, near: -128, far: -267, columns: 16, rows: 6, low: 25, high: 66, launch: [.12, .64] },
    { x: 386, near: -267, far: -468, columns: 21, rows: 6, low: 34, high: 84, launch: [.19, .72] },
    { x: 265, near: 19, far: 149, columns: 16, rows: 5, low: 16, high: 46, launch: [.25, .72] },
  ];

  function profileGeometry(T, profile) {
    const positions = [], colors = [];
    for (const [name, part] of Object.entries(parts)) {
      const contour = profile[name];
      if (!contour || contour.length < 3) continue;
      const shape = new T.Shape(contour.map(([x, y]) => new T.Vector2(x, y)));
      const geometry = new T.ExtrudeGeometry(shape, {
        depth: part.depth, steps: 1, bevelEnabled: true, bevelSegments: 1,
        bevelSize: part.bevel, bevelThickness: part.bevel,
      });
      const { position, normal } = geometry.attributes;
      const face = new T.Color(part.face).convertSRGBToLinear();
      const rim = new T.Color(part.rim).convertSRGBToLinear();
      for (let i = 0; i < position.count; i++) {
        const y = Math.max(0, position.getY(i));
        // Bring both blade facets to the same physical point at local [0,0,0].
        const thickness = name === "blade" ? clamp(y / .046) : 1;
        positions.push(y === 0 ? 0 : position.getX(i), y, (position.getZ(i) - part.depth * .5) * thickness);
        const color = Math.abs(normal.getZ(i)) > .96 ? face : rim;
        colors.push(color.r, color.g, color.b);
      }
      geometry.dispose();
    }
    if (profile.wrap) {
      const { x, top, base, width } = profile.wrap;
      const color = new T.Color(0x5b1725).convertSRGBToLinear();
      const depth = parts.grip.depth * .5 + parts.grip.bevel + .0004;
      for (let i = 1; i <= 5; i++) {
        const y = mix(base, .976, i / 6), center = mix(x, top, (y - base) / (.981 - base));
        const diamond = [[center - width * .19, y], [center, y - .009],
          [center + width * .19, y], [center, y + .009]];
        for (const side of [-1, 1]) {
          const indices = side > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
          for (const index of indices) {
            positions.push(...diamond[index], side * depth);
            colors.push(color.r, color.g, color.b);
          }
        }
      }
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();
    return geometry;
  }

  function buildLayout(profiles, count, between) {
    const byId = new Map(profiles.map(profile => [profile.id, profile]));
    const specs = openers.slice(0, count).map(([id, x, z, height, launch], i) => ({
      profile: byId.get(id) || profiles[i % profiles.length], x, z, height, launch, featured: true,
    }));
    const candidates = bands.map(band => {
      const cells = [];
      for (let column = 0; column < band.columns; column++) {
        for (let row = 0; row < band.rows; row++) {
          const x = mix(-band.x, band.x, (column + between(.14, .86)) / band.columns);
          const z = mix(band.near, band.far, (row + between(.13, .87)) / band.rows);
          const clearance = z >= 0 ? 28 + z * .06 : 9 + Math.abs(z) * .035;
          if (Math.abs(x) < clearance) continue;
          const profile = profiles[Math.floor(between(0, profiles.length))];
          cells.push({ profile, x, z, height: between(band.low, band.high),
            launch: between(...band.launch), order: between(0, 1) });
        }
      }
      return cells.sort((a, b) => a.order - b.order);
    });
    // Interleave depth bands so a smaller field retains the same composition.
    const bandOrder = [0, 1, 2, 1, 3, 2, 0, 1, 2, 3];
    for (let i = 0; specs.length < count && candidates.some(cells => cells.length); i++) {
      const cells = candidates[bandOrder[i % bandOrder.length]];
      while (cells.length) {
        const next = cells.pop();
        if (specs.some(item => Math.hypot(item.x - next.x, item.z - next.z) < 6.5)) continue;
        specs.push(next);
        break;
      }
    }
    return specs;
  }

  class FateSwordField {
    constructor(journey, { start = 206, settle = 234, count = journey.quality < 1 ? 94 : 144 } = {}) {
      const profiles = window.FateSwordProfiles?.profiles;
      if (!profiles?.length) throw new Error("Load FateSwordProfiles before creating the sword field.");
      if (!Number.isFinite(start) || !Number.isFinite(settle) || settle <= start) {
        throw new RangeError("The sword field needs a start cue before its settle cue.");
      }
      const T = journey.T;
      this.journey = journey;
      this.start = start;
      this.settle = settle;
      this.resources = new Set();
      this.group = new T.Group();
      this.group.name = "falling-sword-field";
      this.transform = new T.Object3D();
      this.batches = [];
      this.triangleBudget = 0;
      let seed = 19773431;
      const between = (a, b) => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return mix(a, b, seed / 4294967296);
      };
      const groundHeight = journey.groundHeight || window.FateGrove.groundHeight;
      const span = settle - start;
      const specs = buildLayout(profiles, Math.max(0, Math.min(180, Math.floor(count))), between);
      this.entries = specs.map((spec, i) => {
        const { x, z, height, featured } = spec;
        const launchCue = start + spec.launch * span;
        const embedTime = span * between(.024, .043);
        const flightTime = span * (i < 4 ? between(.156, .205) : between(.188, .326));
        const impactCue = Math.min(settle - embedTime, launchCue + flightTime);
        const retreatAtLaunch = 18 + 482 * smooth(spec.launch);
        const heightJitter = between(0, featured ? 10 : 52);
        const fallHeight = i === 0 ? 32 : Math.max(32, 12 + (retreatAtLaunch - z) * .51) + heightJitter;
        const groundY = groundHeight(x, z);
        const yaw = between(-.78, .78) + (i % 4 === 2 ? Math.PI : 0);
        const chips = featured || (Math.abs(x) < 125 && z > -170 && i % 3 === 0)
          ? Array.from({ length: journey.quality < 1 ? 3 : 5 }, () => ({
            angle: between(0, Math.PI * 2), range: between(1.1, 3.5),
            lift: between(.45, 1.65), size: between(.085, .25),
          })) : [];
        return { ...spec, id: i, height: height * secondaryHeightScale, widthScale: height,
          groundY, launchCue, impactCue, settleCue: impactCue + embedTime,
          embedDepth: height * between(.056, .106), fallHeight, yaw,
          pitch: between(-.13, .13), lean: between(-.17, .17), twist: between(-.42, .42),
          driftX: between(-2.6, 2.6), driftZ: between(-2.4, 2.4), chips,
          tip: [x, groundY + fallHeight, z], phase: "waiting" };
      });
      if (this.entries.length) {
        const ink = this.track(journey.material(0xffffff, { vertexColors: true }));
        for (const profile of profiles) {
          const entries = this.entries.filter(entry => entry.profile === profile);
          if (!entries.length) continue;
          const geometry = this.track(profileGeometry(T, profile));
          const mesh = this.makeInstances(geometry, ink, entries.length, `sword-field-${profile.id}`);
          this.triangleBudget += geometry.attributes.position.count / 3 * entries.length;
          this.batches.push({ mesh, entries, id: profile.id });
        }
        const chipCount = this.entries.reduce((total, entry) => total + entry.chips.length, 0);
        if (chipCount) {
          const geometry = this.track(new T.TetrahedronGeometry(1, 0));
          const material = this.track(journey.material(0x090a0b));
          this.chips = this.makeInstances(geometry, material, chipCount, "sword-impact-earth-chips");
          this.triangleBudget += 4 * chipCount;
        }
      }
      this.distantCount = 999 - this.entries.length;
      this.buildDistantLayer(groundHeight);
      journey.scene.add(this.group);
      this.update(start - 1);
    }

    track(resource) {
      this.resources.add(resource);
      this.journey.own(resource);
      return resource;
    }

    makeInstances(geometry, material, capacity, name) {
      const T = this.journey.T;
      const mesh = this.track(new T.InstancedMesh(geometry, material, capacity));
      mesh.name = name;
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      this.group.add(mesh);
      return mesh;
    }

    buildDistantLayer(groundHeight) {
      const T = this.journey.T;
      // One narrow blade, guard and grip outline with real depth. At this
      // distance 32 triangles preserve the silhouette without copying fittings.
      const outline = [[0, 0], [.055, .2], [.062, .74], [.116, .74], [.063, .79],
        [.057, 1], [.026, 1], [.02, .78], [-.022, .73]];
      const shape = new T.Shape(outline.map(([x, y]) => new T.Vector2(x, y)));
      const geometry = this.track(new T.ExtrudeGeometry(shape, { depth: .009, steps: 1, bevelEnabled: false }));
      geometry.translate(0, 0, -.0045);
      const material = this.track(this.journey.material(0x000000));
      const mesh = this.makeInstances(geometry, material, this.distantCount, "distant-planted-katana");
      mesh.instanceMatrix.setUsage(T.StaticDrawUsage);
      const columns = 60, rows = Math.ceil(this.distantCount / columns);
      // Separate seed keeps every featured sword and all rain cues identical.
      let seed = 91821713;
      const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      const pose = this.transform;
      for (let i = 0; i < this.distantCount; i++) {
        const column = i * 37 % columns, row = Math.floor(i / columns);
        const x = mix(-780, 780, (column + mix(.07, .93, random())) / columns);
        const z = mix(-540, -850, (row + mix(.12, .88, random())) / rows);
        const height = mix(1.8, 4, Math.pow(random(), 1.65));
        pose.position.set(x, groundHeight(x, z) - height * .12, z);
        pose.rotation.set(mix(-.13, .13, random()), mix(-.8, .8, random()), mix(-.17, .17, random()), "YXZ");
        pose.scale.set(height * .76, height * 1.1, height);
        pose.updateMatrix();
        mesh.setMatrixAt(i, pose.matrix);
      }
      mesh.count = this.distantCount;
      mesh.instanceMatrix.needsUpdate = true;
      this.triangleBudget += geometry.attributes.position.count / 3 * mesh.count;
    }

    update(cue) {
      if (this.disposed) return;
      this.cue = cue;
      const score = Math.max(this.start - 1, Math.min(this.settle + 3, cue));
      if (score === this.poseCue) return;
      this.poseCue = score;
      this.group.visible = score >= this.start;
      this.counts = { waiting: 0, falling: 0, embedding: 0, planted: 0 };
      const pose = this.transform;
      for (const { mesh, entries } of this.batches) {
        let active = 0;
        for (const entry of entries) {
          const { x, z, height, groundY, launchCue, impactCue, settleCue, embedDepth } = entry;
          const flight = clamp((score - launchCue) / (impactCue - launchCue));
          const sink = clamp((score - impactCue) / (settleCue - impactCue));
          const phase = score < launchCue ? "waiting" : score < impactCue ? "falling" : score < settleCue ? "embedding" : "planted";
          const air = 1 - flight;
          const tipY = groundY + entry.fallHeight * (1 - Math.pow(flight, 1.9)) - embedDepth * (1 - Math.pow(1 - sink, 3));
          entry.tip[0] = x + entry.driftX * air * air;
          entry.tip[1] = tipY;
          entry.tip[2] = z + entry.driftZ * air * air;
          entry.phase = phase;
          this.counts[phase]++;
          if (phase === "waiting") continue;
          const strike = Math.sin(sink * Math.PI) * (1 - sink) * .037;
          pose.position.fromArray(entry.tip);
          pose.rotation.set(entry.pitch + strike, entry.yaw + entry.twist * air, entry.lean - strike, "YXZ");
          pose.scale.set(entry.widthScale, height, entry.widthScale);
          pose.updateMatrix();
          mesh.setMatrixAt(active++, pose.matrix);
        }
        mesh.count = active;
        if (active) mesh.instanceMatrix.needsUpdate = true;
      }
      this.updateChips(score);
    }

    updateChips(score) {
      if (!this.chips) return;
      const pose = this.transform;
      let active = 0;
      for (const entry of this.entries) {
        const p = (score - entry.impactCue) / 2.25;
        if (p <= 0 || p >= 1) continue;
        const distance = Math.sin(p * Math.PI / 2), lift = 4 * p * (1 - p);
        for (const chip of entry.chips) {
          const travel = chip.range * distance;
          pose.position.set(entry.x + Math.cos(chip.angle) * travel, entry.groundY + chip.lift * lift,
            entry.z + Math.sin(chip.angle) * travel);
          pose.rotation.set(p * 7, chip.angle, p * 4);
          pose.scale.setScalar(chip.size * Math.min(1, p * 12) * (1 - p));
          pose.updateMatrix();
          this.chips.setMatrixAt(active++, pose.matrix);
        }
      }
      this.chips.count = active;
      if (active) this.chips.instanceMatrix.needsUpdate = true;
    }

    snapshot({ details = true } = {}) {
      const state = { cue: this.cue, start: this.start, settle: this.settle, count: this.entries.length, distantCount: this.distantCount,
        visible: this.group.visible, ...this.counts, profiles: this.batches.map(batch => batch.id),
        meshCount: this.group.children.length, triangleBudget: this.triangleBudget, particleCount: this.chips?.count || 0 };
      if (details) state.swords = this.entries.map(entry => ({ id: entry.id, profile: entry.profile.id, phase: entry.phase,
        tip: entry.tip.slice(), anchor: [entry.x, entry.groundY, entry.z], groundY: entry.groundY, embedDepth: entry.embedDepth, height: entry.height,
        launchCue: entry.launchCue, impactCue: entry.impactCue, settleCue: entry.settleCue }));
      return state;
    }

    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      this.group.removeFromParent();
      this.group.clear();
      for (const resource of this.resources) {
        this.journey.resources?.delete(resource);
        resource.dispose();
      }
      this.resources.clear();
    }
  }

  window.FateSwordField = FateSwordField;
})();
