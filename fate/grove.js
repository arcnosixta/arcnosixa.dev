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
    const clear = (x, z) => Math.hypot(x + .62, z) < 1.1 || Math.hypot(x - 66, z - 4) < 3.4;
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
        buffer.positions.push(cx - sx, cy, cz - sz, cx + sx, cy, cz + sz);
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
    const earth = new T.PlaneGeometry(300, 220, compact ? 120 : 192, compact ? 72 : 112);
    earth.rotateX(-Math.PI / 2); earth.translate(30, 0, -85);
    const points = earth.attributes.position;
    for (let i = 0; i < points.count; i++) {
      const x = points.getX(i), z = points.getZ(i), distance = Math.hypot(x + .62, z);
      const texture = (Math.sin(x * .49 + z * .31) + Math.sin(z * .63 - x * .17)) * .018 * clamp(distance / 5);
      points.setY(i, groundHeight(x, z) + texture);
    }
    earth.computeBoundingSphere();
    const ground = journey.mesh(earth, material(), journey.terrain); ground.name = "organic-black-earth";
    stats.triangles += earth.index.count / 3; stats.meshes++;
    // Three planting bands give actual depth and parallax without tall forms.
    // Jittered tuft centres and unequal blade lengths keep the meadow uncombed.
    const bands = [
      { count: compact ? 900 : 1800, z0: -7, z1: 14, blades: compact ? 7 : 9, segments: compact ? 3 : 4, size: 1 },
      { count: compact ? 650 : 1300, z0: -28, z1: -7, blades: compact ? 5 : 6, segments: 3, size: 1.08 },
      { count: compact ? 350 : 700, z0: -62, z1: -28, blades: compact ? 3 : 4, segments: 2, size: .83 },
    ];
    bands.forEach((band, layer) => {
      for (let i = 0; i < band.count; i++) {
        const x = between(-29, 114), z = between(band.z0, band.z1);
        if (clear(x, z)) continue;
        const patch = Math.sin(x * .24 + z * .17) + .7 * Math.sin(x * .081 - z * .36) + .3 * Math.cos(z * .63);
        if (patch > 1.52 && random() > .24) continue;
        stats.tufts++;
        const height = Math.min(1.4, between(.55, 1.3) * band.size * (.85 + .15 * Math.sin(x * .13 + z * .22)));
        const phase = between(0, Math.PI * 2), spread = between(.045, .16);
        for (let blade = 0; blade < band.blades; blade++) {
          const angle = phase + blade * 2.39996 + between(-.55, .55), radius = spread * random();
          const bx = x + Math.cos(angle) * radius, bz = z + Math.sin(angle) * radius;
          if (clear(bx, bz)) continue;
          const by = groundHeight(bx, bz) - .035;
          const h = Math.min(1.4, height * between(.48, 1.13));
          const width = between(.009, .026) * (layer === 0 ? 1 : .8);
          ribbon(grass, bx, by, bz, angle, h, width, h * between(.16, .58), band.segments, between(-.5, .5));
          stats.grassBlades++;
        }
        if (i % (layer === 0 ? 11 : 9) === 0) {
          seedHead(x, groundHeight(x, z) - .025, z, phase, Math.min(1.4, height * between(.95, 1.18)));
        }
      }
    });
    finish(grass, material(0x131416), "dense-curved-meadow-grasses");
    finish(heads, material(0x090a0c), "bent-grass-seed-heads");
    journey.groveStats = stats;
    return stats;
  }
  window.FateGrove = { build, groundHeight };
})();
