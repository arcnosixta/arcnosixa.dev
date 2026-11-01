/* Reference-led young witness. The CC0 face/shoes are fitted to a new layered
   robe, lined cloak and sculpted hair. Everything is volumetric, never a plate. */
(() => {
  "use strict";
  class FateWitness {
    constructor(THREE, { scene, quality = 1, x = 112, z = 4, groundY = 0, height = 148 } = {}) {
      this.T = THREE;
      this.scene = scene;
      this.quality = quality;
      this.height = height;
      this.groundY = typeof groundY === "function" ? groundY(x, z) : groundY;
      this.root = this.rootGroup = new THREE.Group();
      this.root.name = "child-witness";
      this.root.position.set(x, this.groundY, z);
      this.root.rotation.y = Math.atan2(-x, -z);
      this.root.visible = false;
      scene.add(this.root);
      this.resources = new Set();
      this.bones = {};
      this.ready = false;
      this.disposed = false;
      this.score = 0;
      this.ageProportions = { years: 12, legLength: .82, torsoLength: .86, shoulderWidth: .82, headScale: 1.12 };
      this.lights = new THREE.Group();
      this.lights.name = "witness-paper-light";
      this.lights.add(new THREE.HemisphereLight(0xf6f7ff, 0x8c909d, .55));
      const key = new THREE.DirectionalLight(0xfff4e9, .72);
      key.position.set(x - height, this.groundY + height * 1.6, z + height);
      key.target.position.set(x, this.groundY + height * .65, z);
      this.lights.add(key, key.target);
      scene.add(this.lights);
    }
    own(resource) { if (resource) this.resources.add(resource); return resource; }
    async load(url) {
      if (this.disposed) return this;
      if (this.loading) return this.loading;
      this.loading = this.loadModel(url);
      return this.loading;
    }
    async loadModel(url) {
      const T = this.T;
      const loader = new T.GLTFLoader();
      // These embedded PNGs use the same HTML-image path on every browser.
      // It avoids a separate ImageBitmap decode queue during the long reveal.
      loader.register(parser => ({
        name: "FATE_HTML_IMAGE_TEXTURES",
        loadTexture(index) {
          const texture = parser.json.textures[index];
          if (texture.source === undefined) return null;
          return parser.loadTextureImage(index, texture.source, new T.TextureLoader(parser.options.manager));
        }
      }));
      const gltf = await loader.loadAsync(url);
      // Each load owns its complete GLTF result; no geometry/material is shared
      // with the meadow or sword, including the original textures we replace.
      gltf.scene.traverse(object => {
        if (object.geometry) this.own(object.geometry);
        for (const material of object.material ? [].concat(object.material) : []) {
          this.own(material);
          for (const value of Object.values(material)) if (value && value.isTexture) this.own(value);
        }
        if (object.skeleton) this.own(object.skeleton);
      });
      if (this.disposed) { this.releaseResources(); return this; }
      this.model = gltf.scene;
      this.model.name = "reference-witness-body";
      // This VRM 0 source faces -Z (the eye-set parent and toes confirm it).
      // Normalize its front to +Z so root yaw consistently faces the sword.
      this.model.rotation.y = Math.PI;
      this.root.add(this.model);
      const humanoid = gltf.parser.json.extensions?.VRM?.humanoid?.humanBones || [];
      await Promise.all(humanoid.map(async entry => {
        this.bones[entry.bone] = await gltf.parser.getDependency("node", entry.node);
      }));
      if (this.disposed) { this.model.removeFromParent(); this.bones = {}; this.releaseResources(); return this; }
      this.adaptChild();
      const gradient = this.own(new T.DataTexture(new Uint8Array([183, 183, 183, 255, 221, 221, 221, 255, 255, 255, 255, 255]), 3, 1, T.RGBAFormat));
      gradient.minFilter = gradient.magFilter = T.NearestFilter;
      gradient.generateMipmaps = false; gradient.needsUpdate = true;
      const converted = new Map();
      this.model.traverse(object => {
        if (!object.isMesh) return;
        const convert = source => {
          if (!converted.has(source)) converted.set(source, this.inkMaterial(source, gradient));
          return converted.get(source);
        };
        object.material = Array.isArray(object.material) ? object.material.map(convert) : convert(object.material);
        // Bone deformation changes the source rest bounds; avoiding stale
        // per-primitive frustum bounds also keeps hair visible during the orbit.
        object.frustumCulled = false;
      });
      this.root.updateMatrixWorld(true);
      const bounds = this.deformedBounds();
      const scale = 6 / Math.max(.001, bounds.max.y - bounds.min.y);
      this.model.scale.setScalar(scale);
      this.model.position.y = -bounds.min.y * scale;
      this.root.updateMatrixWorld(true);
      // Bake only the retained face, neck and footwear, merging the source's
      // many primitives. The old shirt, tie, trousers and hair are not rendered.
      this.bakeReferenceBody();
      this.makeWardrobe();
      this.pruneSourceResources();
      this.root.scale.setScalar(this.height / 6);
      this.root.updateMatrixWorld(true);
      this.ready = true;
      this.faceY = this.facePosition().y - this.root.position.y;
      this.update(this.score);
      return this;
    }
    adaptChild() {
      const b = this.bones;
      // Shorter long bones and torso, a larger head and a narrower shoulder
      // girdle change the actual skinned silhouette, not just overall size.
      if (b.hips) b.hips.position.y *= .82;
      for (const name of ["spine", "chest", "upperChest", "neck"]) if (b[name]) b[name].position.multiplyScalar(.86);
      for (const side of ["left", "right"]) {
        for (const part of ["LowerLeg", "Foot"]) if (b[side + part]) b[side + part].position.multiplyScalar(.82);
        for (const part of ["Shoulder", "UpperArm"]) if (b[side + part]) b[side + part].position.x *= .82;
        for (const part of ["LowerArm", "Hand"]) if (b[side + part]) b[side + part].position.multiplyScalar(.82);
        const arm = b[side + "UpperArm"], forearm = b[side + "LowerArm"];
        const sign = side === "left" ? 1 : -1;
        if (arm) arm.rotation.set(.025, 0, sign * 1.31);
        if (forearm) forearm.rotation.set(0, sign * .06, sign * .09);
        if (b[side + "Hand"]) b[side + "Hand"].rotation.x = -.08;
      }
      if (b.head) b.head.scale.setScalar(1.12);
      // A restrained, closed-mouth expression; no clock-driven blinking or
      // arrival animation changes the face as the camera scrubs backwards.
      this.model.traverse(mesh => {
        if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
        for (const [name, index] of Object.entries(mesh.morphTargetDictionary)) {
          if (/angry/i.test(name)) mesh.morphTargetInfluences[index] = .12;
        }
      });
    }
    inkMaterial(source, gradient) {
      const T = this.T, name = source.name || "";
      const hair = /HAIR/i.test(name), line = /Brow|Eyelash|Eyeline/i.test(name), iris = /EyeIris/i.test(name);
      const skin = /SKIN/i.test(name), cloth = /CLOTH/i.test(name), shoe = /Shoes/i.test(name);
      const cutout = hair || line || source.alphaTest > 0;
      const material = this.own(new (skin ? T.MeshStandardMaterial : T.MeshToonMaterial)({
        name: "witness-" + name,
        color: hair ? 0x151515 : line ? 0x111111 : shoe ? 0x262830 : cloth ? 0x242424 : 0xffffff,
        map: source.map || null, ...(skin ? { roughness: .96, metalness: 0 } : { gradientMap: gradient }),
        side: source.side, opacity: source.opacity,
        transparent: cutout ? false : source.transparent,
        alphaTest: cutout ? Math.max(source.alphaTest || 0, line ? .18 : .32) : 0,
        depthWrite: cutout ? true : source.depthWrite,
      }));
      material.color.convertSRGBToLinear();
      material.onBeforeCompile = shader => {
        shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `
          #include <map_fragment>
          float inkLuma = dot(diffuseColor.rgb, vec3(.2126, .7152, .0722));
          diffuseColor.rgb = ${iris ? "vec3(.18, .47, .68) * pow(inkLuma, .65)" : shoe ? "vec3(.007) + vec3(inkLuma) * .45" : skin ? "vec3(1.0, .92, .86) * pow(clamp(inkLuma, 0.0, 1.0), .78)" : "vec3(inkLuma)"};
        `);
      };
      material.customProgramCacheKey = () => "fate-witness-reference-" + (iris ? "blue-iris" : skin ? "skin" : shoe ? "shoe" : "ink");
      return material;
    }
    bakeReferenceBody() {
      const T = this.T, groups = new Map(), point = new T.Vector3();
      const keep = material => /Face|Eye|Shoes/.test(material.name) || /Body_00_SKIN/.test(material.name);
      this.model.traverse(object => {
        if (!object.isMesh || !keep(object.material)) return;
        const name = object.material.name, neck = /Body_00_SKIN/.test(name);
        const source = object.geometry, position = source.attributes.position, uv = source.attributes.uv;
        const indices = source.index;
        const bucket = groups.get(object.material) || { positions: [], normals: [], uvs: [], indices: [], name };
        groups.set(object.material, bucket);
        const mapped = new Map(), posed = new Map();
        object.skeleton?.update();
        const vertex = index => {
          if (posed.has(index)) return posed.get(index);
          point.fromBufferAttribute(position, index);
          const morphs = source.morphAttributes.position || [];
          morphs.forEach((attribute, i) => {
            const weight = object.morphTargetInfluences?.[i] || 0;
            if (weight) {
              const delta = new T.Vector3().fromBufferAttribute(attribute, index);
              if (!source.morphTargetsRelative) delta.sub(new T.Vector3().fromBufferAttribute(position, index));
              point.addScaledVector(delta, weight);
            }
          });
          if (object.isSkinnedMesh) object.boneTransform(index, point);
          point.applyMatrix4(object.matrixWorld); this.root.worldToLocal(point);
          if (/Shoes/.test(name)) point.x += Math.sign(point.x) * .13;
          const value = point.clone(); posed.set(index, value); return value;
        };
        const count = indices ? indices.count : position.count;
        for (let i = 0; i < count; i += 3) {
          const triangle = [0, 1, 2].map(k => indices ? indices.getX(i + k) : i + k);
          if (neck && triangle.some(index => vertex(index).y < 4.65)) continue;
          for (const index of triangle) {
            if (!mapped.has(index)) {
              mapped.set(index, bucket.positions.length / 3);
              bucket.positions.push(...vertex(index).toArray());
              // Preserve the artist's smooth facial normals after fitting the
              // skeleton. Recomputing per material creates faceted skin seams.
              const base = new T.Vector3().fromBufferAttribute(position, index);
              const end = base.clone().add(new T.Vector3().fromBufferAttribute(source.attributes.normal, index));
              if (object.isSkinnedMesh) { object.boneTransform(index, base); object.boneTransform(index, end); }
              const localMatrix = new T.Matrix4().copy(this.root.matrixWorld).invert().multiply(object.matrixWorld);
              const normal = end.sub(base).applyMatrix3(new T.Matrix3().getNormalMatrix(localMatrix)).normalize();
              bucket.normals.push(...normal.toArray());
              bucket.uvs.push(uv ? uv.getX(index) : 0, uv ? uv.getY(index) : 0);
            }
            bucket.indices.push(mapped.get(index));
          }
        }
      });
      const baked = new T.Group(); baked.name = "fitted-face-neck-and-boots";
      for (const [material, bucket] of groups) {
        if (!bucket.indices.length) continue;
        const geometry = this.own(new T.BufferGeometry());
        geometry.setAttribute("position", new T.Float32BufferAttribute(bucket.positions, 3));
        geometry.setAttribute("uv", new T.Float32BufferAttribute(bucket.uvs, 2));
        geometry.setAttribute("normal", new T.Float32BufferAttribute(bucket.normals, 3));
        geometry.setIndex(bucket.indices); geometry.computeBoundingSphere();
        const mesh = new T.Mesh(geometry, material); mesh.name = bucket.name;
        baked.add(mesh);
      }
      // Keep the fitted rig only as measured camera anchors; none of its old
      // clothing or duplicate hair primitives participate in rendering.
      this.model.visible = false;
      this.headAnchor = new T.Object3D(); this.headAnchor.name = "measured-head";
      this.headAnchor.position.copy(this.root.worldToLocal(this.bones.head.getWorldPosition(new T.Vector3())));
      this.faceAnchor = new T.Object3D(); this.faceAnchor.name = "measured-eyes";
      const eyes = this.bones.leftEye.getWorldPosition(new T.Vector3()).add(this.bones.rightEye.getWorldPosition(new T.Vector3())).multiplyScalar(.5);
      this.faceAnchor.position.copy(this.root.worldToLocal(eyes));
      this.root.add(this.headAnchor, this.faceAnchor);
      this.model.removeFromParent(); this.model.clear(); this.bones = {};
      this.root.add(baked);
      this.body = baked;
    }
    makeWardrobe() {
      const T = this.T;
      const outfit = this.outfit = new T.Group(); outfit.name = "approved-layered-cloak";
      this.root.add(outfit);
      const cloth = color => {
        const material = this.own(new T.MeshStandardMaterial({ color, roughness: .94, metalness: 0, side: T.DoubleSide }));
        material.color.convertSRGBToLinear(); return material;
      };
      const ink = cloth(0x202127), folds = cloth(0x292a32), deep = cloth(0x13151b);
      const lining = cloth(0xd7d5d0), seam = cloth(0x3a3b43);
      const mesh = (name, positions, indices, material, parent = outfit) => {
        const geometry = this.own(new T.BufferGeometry());
        geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
        geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
        const object = new T.Mesh(geometry, material); object.name = name; parent.add(object); return object;
      };
      const surface = (name, nu, nv, sample, material, parent = outfit) => {
        const positions = [], indices = [];
        for (let v = 0; v <= nv; v++) for (let u = 0; u <= nu; u++) positions.push(...sample(u / nu, v / nv));
        for (let v = 0; v < nv; v++) for (let u = 0; u < nu; u++) {
          const a = v * (nu + 1) + u, b = a + nu + 1;
          indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
        return mesh(name, positions, indices, material, parent);
      };
      const path = (name, points, radius, material) => {
        const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
        const geometry = this.own(new T.TubeGeometry(curve, Math.max(12, points.length * 3), radius, 4, false));
        const object = new T.Mesh(geometry, material); object.name = name; outfit.add(object); return object;
      };
      // Two independent, generously pleated hakama legs. The central separation
      // and the boot-sized cuffs are visible from front, side and back.
      for (const side of [-1, 1]) {
        surface("wide-pleated-hakama-" + side, 64, 24, (u, v) => {
          const theta = u * Math.PI * 2, y = .43 + v * 2.95;
          const pleat = Math.cos(theta * 9 + .12 * Math.sin(v * 3)) * (.035 + .035 * (1 - v));
          const radiusX = .35 + .06 * (1 - v) + pleat, radiusZ = .29 + .065 * (1 - v) + pleat;
          return [side * (.25 + .09 * (1 - v)) + Math.sin(theta) * radiusX, y + .025 * Math.cos(theta * 5) * (1 - v), Math.cos(theta) * radiusZ + .015];
        }, ink);
      }
      // Closed kimono body, with diagonal overlapping front panels.
      surface("closed-wrap-tunic", 64, 20, (u, v) => {
        const theta = u * Math.PI * 2, width = .43 + .10 * v;
        const fold = Math.sin(theta * 10 + v * 3) * .015;
        return [Math.sin(theta) * (width + fold), 3.28 + v * (1.34 - .42 * Math.pow(Math.max(0, Math.cos(theta)), 3)), Math.cos(theta) * (.27 + fold)];
      }, deep);
      surface("closed-high-undertunic", 48, 14, (u, v) => {
        const theta = u * Math.PI * 2;
        return [Math.sin(theta) * .32, 4.08 + v * (.78 - .16 * Math.max(0, Math.cos(theta))), Math.cos(theta) * .285];
      }, deep);
      for (const side of [-1, 1]) {
        surface("ivory-inner-collar-" + side, 8, 20, (u, v) => {
          const x = side * (.19 * (1 - v) + (u - .5) * .085);
          return [x, 4.85 - v * .67, .28 + v * .06 + .018 * Math.sin(u * Math.PI)];
        }, lining);
        surface("crossed-lapel-" + side, 10, 24, (u, v) => {
          const x = side * (.29 * (1 - v) - (side === 1 ? .32 : 0) * v + (u - .5) * .17);
          return [x, 4.76 - v * (side === 1 ? 1.39 : .58), .34 + (side === 1 ? .02 : 0) + .015 * Math.sin(u * Math.PI)];
        }, folds);
      }
      surface("broad-wrapped-waist-sash", 64, 12, (u, v) => {
        const theta = u * Math.PI * 2, ridge = .008 * Math.cos(v * Math.PI * 10 + Math.sin(theta * 2));
        return [Math.sin(theta) * (.475 + ridge), 3.26 + v * .37, Math.cos(theta) * (.32 + ridge)];
      }, folds);
      for (let i = 0; i < 3; i++) for (const side of [-1, 1]) {
        path("sash-crossing-" + i + "-" + side, [[-.43, 3.30 + i * .095, .15], [0, 3.34 + i * .07 + side * .06, .332], [.43, 3.30 + i * .095, .15]], .009, deep);
      }
      // The back is a continuous draped cloak with deep vertical folds.
      const cape = (u, v) => {
        const theta = .53 + u * (Math.PI * 2 - 1.06), fall = v * v * (3 - 2 * v);
        const crease = Math.cos(theta * 12 + v * .6) * (.02 + v * .07);
        const width = .56 + .56 * fall + crease, depth = .33 + .24 * fall + crease * .55;
        const edgeLift = Math.pow(Math.abs(u - .5) * 2, 12) * .22 * v;
        return [Math.sin(theta) * width, 4.61 - v * 4.03 + Math.cos(theta * 7) * .045 * v + edgeLift, Math.cos(theta) * depth - .06];
      };
      surface("continuous-folded-cloak-back", 120, 36, cape, ink);
      // White lining follows the exact opening with a genuine turned-back edge.
      for (const side of [-1, 1]) {
        surface("turned-ivory-cloak-facing-" + side, 10, 36, (u, v) => {
          const edge = cape(side === 1 ? 0 : 1, v);
          return [edge[0] + side * (u * .14 + Math.sin(v * 7) * .045), edge[1] - u * .025,
            edge[2] + .018 + Math.sin(u * Math.PI) * .065 + u * .035];
        }, lining);
        // Broad hanging sleeve/mantle panel; the curl exposes the inner ivory.
        const sleeve = (u, v, offset = 0) => {
          const x = side * (.48 + .70 * v + (u - .5) * (.28 + .34 * v));
          const y = 4.57 - v * 1.82 - .18 * Math.sin(u * Math.PI) * v;
          const z = -.015 + Math.cos(u * Math.PI) * (.27 + .34 * v) + .12 * Math.sin(v * 4 + u * 2);
          return [x, y + offset, z];
        };
        surface("hanging-wide-sleeve-" + side, 30, 24, (u, v) => sleeve(u, v), ink);
        surface("ivory-sleeve-return-" + side, 30, 8, (u, v) => {
          const p = sleeve(u, 1 - v * .15, -.012);
          p[0] -= side * v * .065; p[2] += .025; return p;
        }, lining);
        // Long windless outer lappets continue below each sleeve.
        surface("long-cloak-lappet-" + side, 18, 28, (u, v) => {
          const wave = Math.sin(v * 5.5 + .7);
          return [side * (.78 + .39 * v + u * .17 + .09 * wave), 3.30 - v * 2.65 + .13 * Math.sin(u * Math.PI),
            .18 + wave * .24 + u * .15];
        }, ink);
        surface("lappet-white-underfold-" + side, 8, 28, (u, v) => {
          const wave = Math.sin(v * 5.5 + .7);
          return [side * (.785 + .39 * v + u * .12 + .09 * wave), 3.28 - v * 2.65 + .08 * Math.sin(u * Math.PI),
            .197 + wave * .24 + u * .16];
        }, lining);
      }
      // Raised hood/collar forms a folded, pointed shape over the shoulders.
      surface("high-folded-hood", 72, 18, (u, v) => {
        const theta = .67 + u * (Math.PI * 2 - 1.34);
        const radius = .30 + v * .40, shoulder = Math.pow(Math.abs(Math.sin(theta)), 1.5);
        return [Math.sin(theta) * radius, 4.56 + v * (.18 + shoulder * .28) - Math.pow(1 - v, 2) * .10,
          Math.cos(theta) * (.25 + v * .22) - .035];
      }, ink);
      surface("hood-ivory-inner-rim", 72, 5, (u, v) => {
        const theta = .67 + u * (Math.PI * 2 - 1.34), rim = .72 + v * .20;
        const radius = .30 + rim * .39, shoulder = Math.pow(Math.abs(Math.sin(theta)), 1.5);
        return [Math.sin(theta) * radius, 4.572 + rim * (.18 + shoulder * .28),
          Math.cos(theta) * (.25 + rim * .22) - .027];
      }, lining);
      surface("pointed-resting-hood-back", 32, 20, (u, v) => {
        const width = .64 * Math.pow(1 - v, .65) + .018;
        return [(u * 2 - 1) * width, 4.66 - v * .78 - .10 * Math.sin(u * Math.PI) * (1 - v),
          -.39 - Math.sin(u * Math.PI) * (.12 + .10 * v) - .025 * Math.cos(v * 9)];
      }, deep);
      // Tapered curved hair locks, with solid triangular cross sections instead
      // of billboards. A swept fringe and uneven nape match all four views.
      const hair = new T.Group(); hair.name = "sculpted-tousled-black-hair"; outfit.add(hair);
      const hairInk = cloth(0x17191e), hairLight = cloth(0x22252c);
      const scalp = this.own(new T.SphereGeometry(1, 40, 28, 0, Math.PI * 2, 0, Math.PI * .72));
      scalp.scale(.47, .53, .48); scalp.translate(0, 5.46, .01);
      const scalpPoints = scalp.attributes.position;
      for (let i = 0; i < scalpPoints.count; i++) {
        const z = scalpPoints.getZ(i), y = scalpPoints.getY(i);
        // Open the fringe above the brows; the scalp must never cover the eyes.
        if (z > .12 && y < 5.68) scalpPoints.setY(i, 5.68 + (y - 5.68) * .04);
      }
      scalp.computeVertexNormals();
      const cap = new T.Mesh(scalp, hairInk); cap.name = "hair-crown"; hair.add(cap);
      surface("hair-nape", 40, 16, (u, v) => {
        const angle = Math.PI * (.5 + u), radius = .43 + .035 * Math.sin(v * Math.PI);
        return [Math.sin(angle) * radius, 4.99 + v * .76 + .045 * Math.cos(u * Math.PI * 12) * (1 - v),
          Math.cos(angle) * radius - .025];
      }, hairInk, hair);
      const lock = (name, control, width, depth, material) => {
        const curve = new T.CatmullRomCurve3(control.map(p => new T.Vector3(...p)));
        const positions = [], indices = [], segments = 10;
        for (let i = 0; i <= segments; i++) {
          const t = i / segments, center = curve.getPoint(t), tangent = curve.getTangent(t);
          let normal = center.clone().sub(new T.Vector3(0, 5.42, 0)).normalize();
          const binormal = new T.Vector3().crossVectors(tangent, normal).normalize();
          normal = new T.Vector3().crossVectors(binormal, tangent).normalize();
          const taper = Math.pow(1 - t, .62) * (.65 + .55 * Math.sin(t * Math.PI));
          for (const [x, z] of [[-1, 0], [0, 1], [1, 0], [0, -.16]]) {
            positions.push(...center.clone().addScaledVector(binormal, x * width * taper).addScaledVector(normal, z * depth * taper).toArray());
          }
          if (i < segments) for (let s = 0; s < 4; s++) {
            const a = i * 4 + s, b = i * 4 + (s + 1) % 4;
            indices.push(a, b, a + 4, b, b + 4, a + 4);
          }
        }
        mesh(name, positions, indices, material, hair);
      };
      // Layered cap locks run from the asymmetric crown to a ragged silhouette.
      for (let row = 0; row < 3; row++) for (let i = 0; i < 15; i++) {
        const angle = (i / 15) * Math.PI * 2 + row * .19;
        // Keep the face opening; the separately composed fringe fills this arc.
        if (Math.cos(angle) > .62) continue;
        const x = Math.sin(angle), z = Math.cos(angle), sweep = .12 * Math.sin(i * 4.7 + row);
        lock("layered-hair-" + row + "-" + i, [
          [x * .20 - .06, 5.91 - row * .11, z * .22],
          [x * .45, 5.75 - row * .18, z * .46],
          [x * (.53 + row * .035), 5.51 - row * .19, z * (.48 + row * .025)],
          [x * (.54 + row * .05) + sweep, 5.29 - row * .16 + .06 * Math.sin(i * 2), z * .49 + sweep]
        ], .125 - row * .008, .037, i % 4 ? hairInk : hairLight);
      }
      const fringe = [
        [[-.28,5.87,.20],[-.42,5.64,.43],[-.43,5.38,.45],[-.30,5.13,.43]],
        [[-.19,5.91,.28],[-.27,5.72,.49],[-.21,5.48,.53],[-.10,5.30,.47]],
        [[-.09,5.92,.28],[.05,5.73,.48],[.18,5.51,.52],[.28,5.24,.46]],
        [[.03,5.90,.25],[.28,5.70,.42],[.38,5.44,.44],[.48,5.20,.31]],
        [[.12,5.88,.20],[.38,5.67,.31],[.48,5.42,.29],[.57,5.30,.18]]
      ];
      fringe.forEach((points, i) => lock("swept-fringe-" + i, points, .105 + (i === 2 ? .025 : 0), .038, i % 2 ? hairLight : hairInk));
      lock("loose-crown-lock", [[-.12,5.83,-.04],[-.22,5.96,-.08],[-.02,5.99,-.14],[.13,6,-.17]], .095, .035, hairInk);
      for (let i = 0; i < 9; i++) {
        const angle = 1.0 + i / 8 * 4.25, sx = Math.sin(angle), sz = Math.cos(angle);
        lock("wind-swept-silhouette-" + i, [[sx*.26,5.86,sz*.27],[sx*.48,5.70,sz*.46],
          [sx*.59,5.51,sz*.52],[sx*(.65+.05*Math.sin(i*3)),5.57+.09*Math.cos(i*2),sz*.57]], .105, .03, hairInk);
      }
      // Subtle boot soles keep contact readable against the short meadow.
      for (const side of [-1, 1]) {
        path("cloak-front-seam-" + side, [[side*.29,4.65,.30],[side*.39,3.8,.30],[side*.55,2.8,.41]], .007, seam);
      }
      this.reference = { fullBody: "libfile_6e4bdfa88b3c819186afa7b0ab6ae2e3", version: 1, turnaround: "libfile_117931e808c88191941b3073d295da49" };
      this.mergeOutfit(outfit);
    }
    mergeOutfit(group) {
      // Merge by material once at load time; no per-frame skinning or cloth CPU
      // work is necessary for this held pose. The hair costs two draw calls.
      const T = this.T, buckets = new Map(), objects = [];
      group.updateMatrixWorld(true);
      const inverse = new T.Matrix4().copy(group.matrixWorld).invert();
      group.traverse(object => {
        if (!object.isMesh) return;
        objects.push(object);
        const bucket = buckets.get(object.material) || { p: [], n: [], indices: [], names: [] };
        buckets.set(object.material, bucket); bucket.names.push(object.name);
        const g = object.geometry, base = bucket.p.length / 3;
        const matrix = new T.Matrix4().multiplyMatrices(inverse, object.matrixWorld), normal = new T.Matrix3().getNormalMatrix(matrix);
        const point = new T.Vector3();
        for (let i = 0; i < g.attributes.position.count; i++) {
          bucket.p.push(...point.fromBufferAttribute(g.attributes.position, i).applyMatrix4(matrix).toArray());
          bucket.n.push(...point.fromBufferAttribute(g.attributes.normal, i).applyMatrix3(normal).normalize().toArray());
        }
        for (let i = 0; i < (g.index ? g.index.count : g.attributes.position.count); i++) bucket.indices.push(base + (g.index ? g.index.getX(i) : i));
      });
      objects.forEach(object => { object.removeFromParent(); this.resources.delete(object.geometry); object.geometry.dispose(); });
      for (const [material, bucket] of buckets) {
        const geometry = this.own(new T.BufferGeometry());
        geometry.setAttribute("position", new T.Float32BufferAttribute(bucket.p, 3)); geometry.setAttribute("normal", new T.Float32BufferAttribute(bucket.n, 3));
        geometry.setIndex(bucket.indices); geometry.computeBoundingSphere();
        const object = new T.Mesh(geometry, material);
        object.name = bucket.names[0]; object.userData.parts = bucket.names; group.add(object);
      }
    }
    pruneSourceResources() {
      const used = new Set();
      this.root.traverse(object => {
        if (object.geometry) used.add(object.geometry);
        for (const material of object.material ? [].concat(object.material) : []) {
          used.add(material);
          for (const value of Object.values(material)) if (value?.isTexture) used.add(value);
        }
      });
      for (const resource of this.resources) if (!used.has(resource)) {
        resource.dispose?.(); this.resources.delete(resource);
      }
    }
    deformedBounds() {
      const T = this.T, box = new T.Box3(), vertex = new T.Vector3();
      this.model.traverse(object => {
        if (!object.isMesh) return;
        if (object.skeleton) object.skeleton.update();
        const position = object.geometry.attributes.position;
        for (let i = 0; i < position.count; i++) {
          vertex.fromBufferAttribute(position, i);
          if (object.isSkinnedMesh) object.boneTransform(i, vertex);
          vertex.applyMatrix4(object.matrixWorld);
          // Convert out the scene placement; model height is measured locally.
          this.root.worldToLocal(vertex);
          box.expandByPoint(vertex);
        }
      });
      return box;
    }
    update(cue, time = 0) {
      this.score = cue;
      this.root.visible = !this.disposed && this.ready && cue >= 234;
    }
    headPosition(out = new this.T.Vector3()) {
      this.root.updateMatrixWorld(true);
      if (this.headAnchor) return this.headAnchor.getWorldPosition(out);
      return this.bones.head ? this.bones.head.getWorldPosition(out) : out.copy(this.root.position).add(new this.T.Vector3(0, this.height * .9, 0));
    }
    facePosition(out = new this.T.Vector3()) {
      this.root.updateMatrixWorld(true);
      if (this.faceAnchor) return this.faceAnchor.getWorldPosition(out);
      const left = this.bones.leftEye, right = this.bones.rightEye;
      if (left && right) return left.getWorldPosition(out).add(right.getWorldPosition(new this.T.Vector3())).multiplyScalar(.5);
      return this.headPosition(out);
    }
    footPosition(out = new this.T.Vector3()) { return out.set(this.root.position.x, this.groundY, this.root.position.z); }
    snapshot() {
      return {
        ready: this.ready, visible: this.root.visible, position: this.root.position.toArray(),
        head: this.headPosition().toArray(), face: this.facePosition().toArray(), foot: this.footPosition().toArray(),
        height: this.height, ageProportions: { ...this.ageProportions },
      };
    }
    releaseResources() {
      const images = new Set();
      for (const resource of this.resources) if (resource.isTexture && resource.image) images.add(resource.image);
      for (const resource of this.resources) resource.dispose?.();
      for (const image of images) image.close?.();
      this.resources.clear();
    }
    dispose() {
      if (this.disposed) return;
      this.disposed = true; this.ready = false;
      this.root.visible = false;
      this.root.removeFromParent(); this.lights.removeFromParent();
      this.lights.traverse(light => light.dispose?.());
      this.releaseResources();
      this.root.clear(); this.bones = {};
    }
  }
  window.FateWitness = FateWitness;
})();
