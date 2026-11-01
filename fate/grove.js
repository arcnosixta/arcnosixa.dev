/* An ink-black meadow: irregular earth, dense curved grass blades and sparse
   bent seed heads. Three merged meshes; no trees, shrubs or crown geometry. */
(() => {
  "use strict";
  const clamp = value => Math.max(0, Math.min(1, value));
  const groundHeight = (x, z) => {
    const distance = Math.hypot(x + .62, z);
    const ridge = Math.max(.16, 1.2 + .9 * Math.sin(x * .10 + .35) + .6 * Math.sin(x * .27 + 1.4));
    const bank = Math.exp(-Math.pow((z + 18) / 12, 2)) * ridge * 1.45 * (1 - Math.exp(-distance * distance / 70));
    return Math.sin((x + .62) * .08) * .13 + Math.sin(z * .12) * .085 + bank;
  };
  function build(journey) {
    const T = journey.T, compact = journey.quality < 1;
    let seed = 724931;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const between = (a, b) => a + (b - a) * random();
    const grass = { positions: [], indices: [] }, heads = { positions: [], indices: [] };
    const stats = { trees: 0, branches: 0, leaves: 0, tufts: 0, ferns: 0, grassBlades: 0, seedHeads: 0, triangles: 0, meshes: 0 };
    const material = (color = 0x010102) => {
      const ink = journey.material(color, { side: T.DoubleSide, transparent: false, opacity: 1 });
      journey.terrainMaterials.push(ink);
      return ink;
    };
    function finish(buffer, ink, name) {
      const geometry = new T.BufferGeometry();
      geometry.setAttribute("position", new T.Float32BufferAttribute(buffer.positions, 3));
      geometry.setIndex(buffer.indices); geometry.computeBoundingSphere();
      const mesh = journey.mesh(geometry, ink, journey.terrain); mesh.name = name;
      stats.triangles += buffer.indices.length / 3; stats.meshes++;
      return mesh;
    }
    const clear = (x, z) => Math.hypot(x + .62, z) < .85;
    // Each blade follows its own curved centreline, lean and twist. Width tapers
    // continuously to a true point instead of ending in straight vertical spikes.
    function ribbon(buffer, x, y, z, angle, height, width, lean, segments, twist) {
      const first = buffer.positions.length / 3, wind = Math.sin(x * .14 + z * .17) * .12;
      const directionX = Math.cos(angle), directionZ = Math.sin(angle);
      for (let i = 0; i <= segments; i++) {
        const t = i / segments, bend = lean * t * t;
        const sway = Math.sin(t * Math.PI) * height * .035;
        const cx = x + directionX * bend + wind * height * t * t - directionZ * sway;
        const cy = y + height * (t - .065 * t * t);
        const cz = z + directionZ * bend + directionX * sway;
        const turn = angle + Math.PI / 2 + twist * t;
        const radius = width * Math.pow(Math.max(0, 1 - t), .82) * (.72 + .28 * Math.sin(t * Math.PI));
        const sx = Math.cos(turn) * radius, sz = Math.sin(turn) * radius;
        // Both edges of a wide blade meet the rendered slope, not just its centre.
        const leftY = i === 0 ? surfaceHeight(cx - sx, cz - sz) - .035 : cy;
        const rightY = i === 0 ? surfaceHeight(cx + sx, cz + sz) - .035 : cy;
        buffer.positions.push(cx - sx, leftY, cz - sz, cx + sx, rightY, cz + sz);
        if (i < segments) {
          const a = first + i * 2;
          buffer.indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
    }
    function seedHead(x, y, z, angle, height) {
      const lean = height * between(.2, .52), dx = Math.cos(angle), dz = Math.sin(angle);
      ribbon(heads, x, y, z, angle, height, between(.004, .007), lean, 4, .12);
      const count = compact ? 5 : 7;
      // Short paired florets follow the bent panicle. No woody branch network.
      for (let i = 0; i < count; i++) {
        const t = .76 + i / count * .215, sway = Math.sin(t * Math.PI) * height * .035;
        const wind = Math.sin(x * .14 + z * .17) * .12;
        const cx = x + dx * lean * t * t + wind * height * t * t - dz * sway;
        const cy = y + height * (t - .065 * t * t), cz = z + dz * lean * t * t + dx * sway;
        const side = i % 2 ? 1 : -1, length = height * between(.045, .075) * (1 - (t - .76) * 2.2);
        const sx = -dz * side, sz = dx * side, first = heads.positions.length / 3;
        const tx = cx + sx * length + dx * length * .23, ty = cy + length * .55, tz = cz + sz * length + dz * length * .23;
        const mx = (cx + tx) / 2, my = (cy + ty) / 2, mz = (cz + tz) / 2, width = length * .16;
        heads.positions.push(cx, cy, cz, mx - dx * width, my, mz - dz * width,
          tx, ty, tz, mx + dx * width, my, mz + dz * width);
        heads.indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
      }
      stats.seedHeads++;
    }
    const divisions = compact ? 150 : 220;
    const earth = new T.PlaneGeometry(1800, 1800, divisions, divisions);
    earth.rotateX(-Math.PI / 2);
    const points = earth.attributes.position;
    for (let i = 0; i < points.count; i++) {
      const x = points.getX(i), z = points.getZ(i), distance = Math.hypot(x + .62, z);
      const texture = (Math.sin(x * .49 + z * .31) + Math.sin(z * .63 - x * .17)) * .018 * clamp(distance / 5);
      points.setY(i, groundHeight(x, z) + texture);
    }
    // Sample the same two triangles that PlaneGeometry renders in each cell.
    // The analytic hills can sit above a coarse triangle, especially on mobile;
    // using that formula for plants used to leave whole patches floating.
    const surfaceHeight = (x, z) => {
      const column = Math.min(divisions - 1, Math.floor(clamp((x + 900) / 1800) * divisions));
      const row = Math.min(divisions - 1, Math.floor(clamp((z + 900) / 1800) * divisions));
      const a = row * (divisions + 1) + column, b = a + divisions + 1, d = a + 1, c = b + 1;
      const u = clamp((x - points.getX(a)) / (points.getX(d) - points.getX(a)));
      const v = clamp((z - points.getZ(a)) / (points.getZ(b) - points.getZ(a)));
      return u + v <= 1
        ? points.getY(a) + (points.getY(d) - points.getY(a)) * u + (points.getY(b) - points.getY(a)) * v
        : points.getY(c) + (points.getY(b) - points.getY(c)) * (1 - u) + (points.getY(d) - points.getY(c)) * (1 - v);
    };
    journey.groundHeight = surfaceHeight;
    earth.computeBoundingSphere();
    const ground = journey.mesh(earth, material(), journey.terrain); ground.name = "organic-black-earth";
    stats.triangles += earth.index.count / 3; stats.meshes++;
    // Jittered, occupied cells form a carpet. Fine blades cover the sword
    // passage; broader, lower-detail blades continue underneath the full orbit.
    // Overlapping density bands feather their border so no rectangular planting
    // patch appears under the boy when the camera rises.
    const bands = [
      { x0: -28, x1: 178, z0: -38, z1: 82, step: compact ? 1.05 : .78, blades: 3, segments: compact ? 2 : 3, size: 1 },
      { x0: -260, x1: 510, z0: -350, z1: 350, step: compact ? 5 : 3.6, blades: 2, segments: 2, size: 1.8 },
    ];
    const nearCoverage = (x, z) => clamp(Math.min(x + 28, 178 - x, z + 38, 82 - z) / 24);
    bands.forEach((band, layer) => {
      let i = 0;
      for (let gx = band.x0; gx < band.x1; gx += band.step) for (let gz = band.z0; gz < band.z1; gz += band.step) {
        i++;
        const x = gx + between(.08, .92) * band.step, z = gz + between(.08, .92) * band.step;
        const coverage = nearCoverage(x, z);
        if (layer ? random() < coverage : random() > coverage) continue;
        if (clear(x, z)) continue;
        stats.tufts++;
        const height = between(.65, 1.38) * band.size * (.88 + .12 * Math.sin(x * .13 + z * .22));
        const phase = between(0, Math.PI * 2), spread = band.step * .34;
        for (let blade = 0; blade < band.blades; blade++) {
          const angle = phase + blade * 2.39996 + between(-.55, .55), radius = spread * random();
          const bx = x + Math.cos(angle) * radius, bz = z + Math.sin(angle) * radius;
          if (clear(bx, bz)) continue;
          const by = surfaceHeight(bx, bz) - .035;
          const h = height * between(.68, 1.08);
          const width = between(.04, .09) * (layer === 0 ? (compact ? 1.3 : 1) : 4.2);
          ribbon(grass, bx, by, bz, angle, h, width, h * between(.16, .58), band.segments, between(-.5, .5));
          stats.grassBlades++;
        }
        if (i % (layer === 0 ? 71 : 131) === 0) {
          seedHead(x, surfaceHeight(x, z) - .035, z, phase, Math.min(1.4, height * between(.95, 1.18)));
        }
      }
    });
    stats.coverage = "continuous-stratified-carpet";
    stats.nearSpacing = bands[0].step;
    finish(grass, material(0x131416), "dense-curved-meadow-grasses");
    finish(heads, material(0x090a0c), "bent-grass-seed-heads");
    journey.groveStats = stats;
    return stats;
  }
  window.FateGrove = { build, groundHeight };
})();
