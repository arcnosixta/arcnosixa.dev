/* Seeded oak/birch woodland. Crowns are open branch networks carrying individual
   leaves: no solid canopy primitives, image billboards or grey fog layers. */
(() => {
  "use strict";
  const clamp = value => Math.max(0, Math.min(1, value));
  const randomSource = initial => {
    let seed = initial;
    return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  };
  const groundHeight = (x, z) => {
    const distance = Math.hypot(x + .62, z);
    // A broken, low woodland bank rises behind the clearing. Its crest and
    // vegetation make a real silhouette; the katana's landing point stays zero.
    const ridge = Math.max(.16, 1.2 + .9 * Math.sin(x * .10 + .35) + .6 * Math.sin(x * .27 + 1.4));
    const bank = Math.exp(-Math.pow((z + 18) / 12, 2)) * ridge * 1.45 * (1 - Math.exp(-distance * distance / 70));
    return Math.sin((x + .62) * .08) * .13 + Math.sin(z * .12) * .085 + bank;
  };

  function build(journey) {
    const T = journey.T, compact = journey.quality < 1, random = randomSource(724931);
    const wood = { positions: [], indices: [] }, leaves = { positions: [], indices: [] }, meadow = { positions: [], indices: [] };
    const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
    const between = (a, b) => a + (b - a) * random();
    const stats = { trees: 0, branches: 0, leaves: 0, tufts: 0, ferns: 0, triangles: 0, meshes: 0 };
    const ink = extra => {
      const material = journey.material(0x020203, { transparent: true, opacity: 0, ...extra });
      journey.terrainMaterials.push(material);
      return material;
    };
    const append = (buffer, points) => {
      const first = buffer.positions.length / 3;
      points.forEach(p => buffer.positions.push(p.x, p.y, p.z));
      return first;
    };
    function mesh(buffer, material, name) {
      const geometry = new T.BufferGeometry();
      geometry.setAttribute("position", new T.Float32BufferAttribute(buffer.positions, 3));
      geometry.setIndex(buffer.indices);
      geometry.computeBoundingSphere();
      const result = journey.mesh(geometry, material, journey.terrain);
      result.name = name;
      stats.triangles += buffer.indices.length / 3;
      stats.meshes++;
      return result;
    }
    // Tubes follow a transported tangent frame; irregular radius and taper make
    // roots, trunks and forks continuous rather than stacks of straight cylinders.
    function tube(points, radii, sides = 6, roughness = .08) {
      const first = wood.positions.length / 3, phase = between(0, Math.PI * 2);
      let previousNormal;
      for (let i = 0; i < points.length; i++) {
        const tangent = points[Math.min(points.length - 1, i + 1)].clone().sub(points[Math.max(0, i - 1)]).normalize();
        let normal;
        if (previousNormal) {
          normal = previousNormal.clone().addScaledVector(tangent, -previousNormal.dot(tangent)).normalize();
        } else {
          normal = tangent.clone().cross(Math.abs(tangent.y) < .92 ? V(0, 1, 0) : V(0, 0, 1)).normalize();
        }
        const across = tangent.clone().cross(normal).normalize();
        previousNormal = normal;
        for (let side = 0; side < sides; side++) {
          const angle = side / sides * Math.PI * 2;
          const irregularity = 1 + roughness * (Math.sin(angle * 3 + phase + i * .23) * .65 + Math.sin(angle * 5 - i * .19) * .35);
          const radius = radii[i] * irregularity;
          const p = points[i].clone().addScaledVector(normal, Math.cos(angle) * radius).addScaledVector(across, Math.sin(angle) * radius);
          wood.positions.push(p.x, p.y, p.z);
          if (i < points.length - 1) {
            const a = first + i * sides + side, b = first + i * sides + (side + 1) % sides;
            wood.indices.push(a, b, a + sides, b, b + sides, a + sides);
          }
        }
      }
      const cap = append(wood, [points.at(-1)]), end = first + (points.length - 1) * sides;
      for (let side = 0; side < sides; side++) wood.indices.push(end + side, end + (side + 1) % sides, cap);
    }

    // A folded, asymmetric leaf with pointed tip; oak leaves have lobed edges,
    // birch leaves a small serrated diamond. Orientations vary inside loose sprays.
    function leaf(base, direction, length, width, species = "birch") {
      const axis = direction.clone().normalize();
      const sideways = axis.clone().cross(V(between(-1, 1), between(-.5, 1), between(-1, 1))).normalize();
      const fold = sideways.clone().cross(axis).normalize();
      const outline = species === "oak"
        ? [[0, 0], [.18, -.32], [.30, -.84], [.42, -.47], [.55, -1], [.68, -.54], [.80, -.63], [1, 0], [.79, .62], [.64, .46], [.53, .94], [.39, .44], [.27, .7], [.15, .3]]
        : [[0, 0], [.25, -.55], [.43, -.83], [.55, -.69], [1, 0], [.57, .75], [.41, .8], [.24, .49]];
      const points = outline.map(([t, w]) => base.clone().addScaledVector(axis, t * length)
        .addScaledVector(sideways, w * width * (w < 0 ? 1 : .86))
        .addScaledVector(fold, Math.sin(t * Math.PI) * length * .09 - Math.abs(w) * width * .16));
      const middle = base.clone().addScaledVector(axis, length * .48).addScaledVector(fold, length * .09);
      const first = append(leaves, [middle, ...points]);
      for (let i = 0; i < points.length; i++) leaves.indices.push(first, first + 1 + i, first + 1 + (i + 1) % points.length);
      stats.leaves++;
    }

    function twigSpray(points, direction, species, density, size) {
      const count = Math.max(2, Math.round(density));
      const axis = direction.clone().normalize(), side = axis.clone().cross(V(0, 1, .31)).normalize();
      for (let i = 0; i < count; i++) {
        const t = .2 + i / count * .77;
        const index = Math.min(points.length - 2, Math.floor(t * (points.length - 1)));
        const local = t * (points.length - 1) - index;
        const at = points[index].clone().lerp(points[index + 1], local);
        const sign = i % 2 ? 1 : -1;
        const length = size * between(.65, 1.35);
        const aim = axis.clone().multiplyScalar(.4).addScaledVector(side, sign * between(.5, .95))
          .add(V(between(-.16, .16), between(-.5, .15), between(-.2, .2))).normalize();
        leaf(at, aim, length, length * (species === "oak" ? .3 : .32), species);
      }
    }

    function tree(x, z, height, species, level, bare = false) {
      stats.trees++;
      const ground = groundHeight(x, z), trunk = [], radii = [];
      const phase = between(0, Math.PI * 2), leanX = between(-.07, .07) * height, leanZ = between(-.055, .055) * height;
      const trunkRadius = height * (species === "oak" ? between(.023, .032) : between(.012, .019));
      const trunkHeight = height * (species === "oak" ? .78 : 1);
      const stations = level === 0 ? 13 : level === 1 ? 9 : 7;
      for (let i = 0; i <= stations; i++) {
        const t = i / stations;
        const gnarled = species === "oak" ? (Math.sin(t * 7.5 + phase) - Math.sin(phase)) * height * .035 * Math.sqrt(t)
          + Math.sin(clamp((t - .15) / .72) * Math.PI) * height * .035 * Math.sign(leanX || 1) : Math.sin(t * 5.3 + phase) * height * .016 * t;
        trunk.push(V(x + leanX * t * t + gnarled,
          ground + trunkHeight * t,
          z + leanZ * t * t + Math.sin(t * 4.1 + phase * .7) * height * (species === "oak" ? .025 : .011) * t));
        radii.push(trunkRadius * (Math.pow(1 - t, .91) * .96 + .025) * (1 + .25 * Math.exp(-t * 17)));
      }
      tube(trunk, radii, level === 0 ? 9 : level === 1 ? 7 : 5, species === "oak" ? .16 : .08);
      // Buttress roots flare and enter the terrain at unequal distances.
      const roots = level === 0 ? 6 : 3;
      for (let i = 0; i < roots; i++) {
        const angle = i / roots * Math.PI * 2 + between(-.35, .35), length = trunkRadius * between(3, 6);
        const start = V(x, ground + trunkRadius * .6, z), end = V(x + Math.cos(angle) * length, 0, z + Math.sin(angle) * length);
        end.y = groundHeight(end.x, end.z) - .025;
        const mid = start.clone().lerp(end, .45); mid.y += trunkRadius * .24;
        tube([start, mid, end], [trunkRadius * .5, trunkRadius * .28, .012], level === 0 ? 7 : 5, .14);
      }
      function grow(start, direction, length, radius, depth, order) {
        stats.branches++;
        const segments = depth > 1 ? (level === 0 ? 6 : 4) : 3;
        const points = [], widths = [], bend = V(between(-1, 1), between(-.2, .5), between(-1, 1)).normalize();
        const droop = species === "birch" && order > 1 ? between(.16, .35) : between(-.04, .19);
        for (let i = 0; i <= segments; i++) {
          const t = i / segments;
          const p = start.clone().addScaledVector(direction, length * t).addScaledVector(bend, Math.sin(t * Math.PI) * length * .13);
          p.y += species === "oak" && order === 0
            ? length * (-.115 * Math.sin(t * Math.PI) + .18 * t * t * t)
            : length * (.12 * t * t - droop * t * t * t);
          if (species === "oak") p.addScaledVector(bend, Math.sin(t * Math.PI * 2) * length * .045);
          points.push(p);
          widths.push(Math.max(.0035, radius * Math.pow(1 - t * .88, 1.05)));
        }
        tube(points, widths, radius > .11 ? (level === 0 ? 7 : 6) : 4, .09);
        if (depth === 0) {
          if (!bare) twigSpray(points, direction, species, level === 0 ? 10 : level === 1 ? 6 : 3,
            Math.max(height * (level === 0 ? .017 : .019), level < 2 ? .19 : .14));
          return;
        }
        const forks = depth > 1 && level === 0 && random() > .6 ? 3 : 2;
        for (let fork = 0; fork < forks; fork++) {
          const at = fork === 0 ? 1 : between(.59, .88);
          const index = Math.min(points.length - 2, Math.floor(at * segments));
          const origin = at === 1 ? points.at(-1).clone() : points[index].clone().lerp(points[index + 1], at * segments - index);
          const azimuth = phase + order * 2.39996 + fork * 2.17 + between(-.65, .65);
          const spread = V(Math.cos(azimuth), species === "oak" ? between(-.16, .36) : between(.1, .65), Math.sin(azimuth));
          const aim = direction.clone().multiplyScalar(.6).addScaledVector(spread, .7).add(V(0, species === "oak" ? .04 : .15, 0)).normalize();
          if (species === "birch" && depth === 1) aim.y -= between(.1, .3);
          grow(origin, aim.normalize(), length * between(.48, .70), radius * between(.44, .63), depth - 1, order + 1);
        }
      }
      const limbs = level === 0 ? (species === "oak" ? 9 : 10) : level === 1 ? 7 : 5;
      const depth = level === 0 ? (compact ? 2 : 3) : level === 1 ? 2 : 1;
      for (let i = 0; i < limbs; i++) {
        const fraction = (species === "oak" ? .18 : .37) + i / limbs * (species === "oak" ? .65 : .51);
        const index = Math.min(stations - 1, Math.floor(fraction * stations));
        const origin = trunk[index].clone().lerp(trunk[index + 1], fraction * stations - index);
        const angle = i * 2.39996 + phase + between(-.4, .4), spread = species === "oak" ? between(.29, .44) : between(.15, .25);
        const direction = V(Math.cos(angle), species === "oak" ? between(-.09, .34) : between(.28, .85), Math.sin(angle)).normalize();
        const length = height * spread * (1.15 - fraction * .45);
        grow(origin, direction, length, trunkRadius * (1 - fraction) * (species === "oak" ? between(.65, .9) : between(.46, .74)), depth, 0);
      }
      // A forked crown leader and sparse dead lateral twigs break the outline.
      grow(trunk[Math.floor(stations * .67)], V(leanX / height + .42, .67, leanZ / height - .19).normalize(), height * .31,
        trunkRadius * .39, level === 0 ? 2 : 1, 0);
      if (species === "oak" && level < 2) grow(trunk[Math.floor(stations * .49)], V(-.56, .52, .25).normalize(), height * .34,
        trunkRadius * .46, level === 0 ? 2 : 1, 0);
    }

    const earthMaterial = ink({ side: T.DoubleSide }), woodMaterial = ink(), leafMaterial = ink({ side: T.DoubleSide }), grassMaterial = ink({ side: T.DoubleSide });
    const earth = new T.PlaneGeometry(300, 220, compact ? 120 : 192, compact ? 72 : 112);
    earth.rotateX(-Math.PI / 2); earth.translate(30, 0, -85);
    const vertices = earth.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i), z = vertices.getZ(i), dist = Math.hypot(x + .62, z);
      const micro = (Math.sin(x * .49 + z * .31) + Math.sin(z * .63 - x * .17)) * .021 * clamp(dist / 5);
      vertices.setY(i, groundHeight(x, z) + micro);
    }
    earth.computeBoundingSphere();
    const ground = journey.mesh(earth, earthMaterial, journey.terrain); ground.name = "organic-black-earth";
    stats.triangles += earth.index.count / 3; stats.meshes++;

    // Irregular clearings, rather than an evenly spaced wall of identical crowns.
    [[10, 7, 16.4, "oak"], [26, 5, 18, "birch"], [43, 8, 17.1, "oak"], [61, 6, 18.3, "birch"], [80, 7, 16.7, "oak"]]
      .forEach((spec, i) => tree(...spec, 0, i === 2));
    const middleCount = compact ? 11 : 16;
    for (let i = 0; i < middleCount; i++) {
      const x = -24 + i * (116 / middleCount) + between(-3, 3);
      if (x > 32 && x < 43 && i % 2 === 0) continue;
      tree(x, between(-23, -11), between(10, 17), i % 3 === 0 ? "birch" : "oak", 1, i % 6 === 0);
    }
    const distantCount = compact ? 28 : 44;
    for (let i = 0; i < distantCount; i++) tree(-48 + i / distantCount * 184 + between(-2, 2), between(-60, -34),
      between(8, 16), i % 3 === 0 ? "birch" : "oak", 2, i % 9 === 0);
    // A patchy low understory sits on the bank, breaking the old ruler-straight
    // earth edge with real branches/leaf sprays instead of a decorative outline.
    const shrubs = compact ? 10 : 19;
    for (let i = 0; i < shrubs; i++) {
      const x = -22 + i / shrubs * 126 + between(-2, 2);
      if (x > 30 && x < 39) continue;
      tree(x, between(-27, -14), between(2.1, 4.3), "oak", 1, false);
    }

    function grassBlade(base, angle, height, width, lean) {
      const side = V(Math.cos(angle), 0, Math.sin(angle)), bend = V(-Math.sin(angle), 0, Math.cos(angle));
      const first = meadow.positions.length / 3;
      for (let i = 0; i <= 3; i++) {
        const t = i / 3, center = base.clone().add(V(0, height * t, 0)).addScaledVector(bend, lean * t * t);
        const radius = width * Math.pow(1 - t, .8);
        const a = center.clone().addScaledVector(side, -radius), b = center.clone().addScaledVector(side, radius);
        meadow.positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
        if (i < 3) { const v = first + i * 2; meadow.indices.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); }
      }
    }
    const tufts = compact ? 370 : 900;
    for (let i = 0; i < tufts; i++) {
      const x = between(-30, 112), z = between(-27, 13);
      // Swathes and open patches resemble sedges/forbs below an oak canopy.
      if (Math.sin(x * .19 + z * .13) + Math.cos(z * .37) > 1.12) continue;
      const center = V(x, groundHeight(x, z), z), count = compact ? 5 : 8;
      stats.tufts++;
      const height = between(.22, .95) * (random() > .88 ? 1.6 : 1);
      for (let j = 0; j < count; j++) {
        const base = center.clone().add(V(between(-.15, .15), 0, between(-.15, .15)));
        grassBlade(base, between(0, Math.PI * 2), height * between(.5, 1.25), between(.012, .045), between(-.3, .3));
      }
      if (i % 9 === 0) {
        const stem = [center, center.clone().add(V(.03, height * .6, -.02)), center.clone().add(V(.07, height * 1.4, .01))];
        tube(stem, [.014, .009, .004], 4, .05);
        twigSpray(stem, V(.05, 1, 0), "birch", 4, between(.12, .24));
      }
    }
    // Taller sedges on the bank crest are visible against the white sky. Their
    // base follows the same terrain surface, with no light strips or grey fill.
    for (let i = 0; i < (compact ? 190 : 420); i++) {
      const x = between(-28, 112), z = between(-24, -12), height = between(.55, 1.35);
      const center = V(x, groundHeight(x, z) - .04, z);
      stats.tufts++;
      for (let j = 0; j < (compact ? 4 : 6); j++) grassBlade(center.clone().add(V(between(-.1, .1), 0, between(-.1, .1))),
        between(0, Math.PI * 2), height * between(.5, 1.2), between(.014, .035), between(-.35, .35));
    }
    // Fern fronds have paired tapered pinnae, never a solid triangle fan crown.
    const ferns = compact ? 28 : 62;
    for (let i = 0; i < ferns; i++) {
      const x = between(-20, 102), z = between(-18, 10), base = V(x, groundHeight(x, z), z);
      if (Math.hypot(x + .62, z) < 2) continue;
      stats.ferns++;
      const fronds = compact ? 4 : 6;
      for (let f = 0; f < fronds; f++) {
        const angle = f / fronds * Math.PI * 2 + between(-.3, .3), length = between(.6, 1.25);
        const outward = V(Math.cos(angle), 0, Math.sin(angle)), side = V(-Math.sin(angle), 0, Math.cos(angle));
        const stem = [];
        for (let j = 0; j <= 5; j++) {
          const t = j / 5;
          stem.push(base.clone().addScaledVector(outward, length * t * .8).add(V(0, Math.sin(t * Math.PI * .72) * length * .8, 0)));
        }
        tube(stem, [.012, .011, .009, .007, .005, .002], 4, .03);
        for (let j = 1; j < 5; j++) {
          const t = j / 5, span = Math.sin(t * Math.PI) * length * .25;
          for (const sign of [-1, 1]) leaf(stem[j], side.clone().multiplyScalar(sign).addScaledVector(outward, .35), span, span * .12, "birch");
        }
      }
    }
    // Fallen limbs and rough angular rocks are part of the same wood draw call.
    for (let i = 0; i < (compact ? 11 : 22); i++) {
      const x = between(-22, 105), z = between(-18, 8), length = between(1, 3.4), angle = between(0, Math.PI * 2);
      const a = V(x, groundHeight(x, z) + .09, z), b = a.clone().add(V(Math.cos(angle) * length, .08, Math.sin(angle) * length));
      b.y = groundHeight(b.x, b.z) + .1;
      const middle = a.clone().lerp(b, .5).add(V(.05, .06, -.04));
      tube([a, middle, b], [.08, .065, .025], 7, .2);
      const fork = middle.clone().add(V(length * .17, .14, length * -.2));
      tube([middle, fork], [.035, .006], 5, .13);
    }
    for (let i = 0; i < (compact ? 48 : 110); i++) {
      const x = between(-28, 110), z = between(-20, 12), y = groundHeight(x, z), radius = between(.08, .42), first = wood.positions.length / 3;
      const points = [V(x - radius, y - .025, z), V(x - radius * .4, y + radius * .5, z - radius * .35), V(x + radius * .45, y + radius * .32, z - radius * .5), V(x + radius, y, z + radius * .05), V(x + radius * .2, y + radius * .25, z + radius * .65)];
      append(wood, points);
      wood.indices.push(first, first + 1, first + 4, first + 1, first + 2, first + 4, first + 2, first + 3, first + 4);
    }
    mesh(wood, woodMaterial, "organic-trunks-roots-and-branches");
    mesh(leaves, leafMaterial, "individual-leaves-and-fern-pinnae");
    mesh(meadow, grassMaterial, "curved-meadow-grasses-and-sedges");
    journey.groveStats = stats;
    return stats;
  }
  window.FateGrove = { build, groundHeight };
})();
