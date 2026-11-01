/* A CC0 skinned VRoid character, adapted to a child's proportions.
   The source face, hair, clothing and their alpha textures remain real 3D assets. */
(() => {
  "use strict";
  class FateWitness {
    constructor(THREE, { scene, quality = 1, x = 60, z = 4, groundY = 0, height = 6 } = {}) {
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
      this.ageProportions = { years: 10, legLength: .82, torsoLength: .86, shoulderWidth: .82, headScale: 1.12 };
      this.lights = new THREE.Group();
      this.lights.name = "witness-paper-light";
      this.lights.add(new THREE.HemisphereLight(0xffffff, 0xa2a2a2, .68));
      const key = new THREE.DirectionalLight(0xffffff, .62);
      key.position.set(x - 9, this.groundY + 16, z + 12);
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
      this.model.name = "cc0-fumiriya-child";
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
      const scale = this.height / Math.max(.001, bounds.max.y - bounds.min.y);
      this.model.scale.setScalar(scale);
      this.model.position.y = -bounds.min.y * scale;
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
      const hair = /HAIR/i.test(name), line = /Brow|Eyelash|Eyeline/i.test(name);
      const skin = /SKIN/i.test(name), cloth = /CLOTH/i.test(name), shoe = /Shoes/i.test(name);
      const cutout = hair || line || source.alphaTest > 0;
      const material = this.own(new T.MeshToonMaterial({
        name: "witness-" + name,
        color: hair ? 0x151515 : line ? 0x111111 : shoe ? 0x484848 : cloth ? 0x242424 : 0xffffff,
        map: source.map || null, gradientMap: gradient,
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
          diffuseColor.rgb = vec3(${skin ? "pow(clamp(inkLuma, 0.0, 1.0), .65)" : shoe ? ".006 + inkLuma" : "inkLuma"});
        `);
      };
      material.customProgramCacheKey = () => "fate-witness-gray-" + (skin ? "skin" : shoe ? "shoe" : "ink");
      return material;
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
      this.root.visible = !this.disposed && this.ready && cue >= 116;
    }
    headPosition(out = new this.T.Vector3()) {
      this.root.updateMatrixWorld(true);
      return this.bones.head ? this.bones.head.getWorldPosition(out) : out.copy(this.root.position).add(new this.T.Vector3(0, this.height * .9, 0));
    }
    facePosition(out = new this.T.Vector3()) {
      this.root.updateMatrixWorld(true);
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
