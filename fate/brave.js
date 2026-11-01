/* The approved still illustration in one fixed clearing. The existing blade
   passage leads into this camera path; no video, orbit model or scroll capture. */
(() => {
  'use strict';
  const clamp = x => Math.max(0, Math.min(1, x));
  const ease = x => { x = clamp(x); return x*x*x*(x*(x*6-15)+10); };
  class FateBrave {
    constructor(journey) {
      this.journey = journey;
      this.T = journey.T;
      this.resources = [];
      this.ready = false;
      const T = this.T, own = resource => (this.resources.push(resource), resource);
      this.ground = window.makeBraveFootprint(T, journey.terrain, journey.quality < 1);
      journey.groundHeight = this.ground.surfaceHeight;
      journey.terrainMaterials.push(this.ground.relief.material);
      const sky = new T.HemisphereLight(0xbdc7dc, 0x111523, .70);
      const light = new T.DirectionalLight(0xe4ebff, 1.25);
      light.position.set(-90, 110, 45);
      light.castShadow = true;
      light.shadow.mapSize.set(1024, 1024);
      Object.assign(light.shadow.camera, {left:-130, right:130, top:160, bottom:-100, near:1, far:600});
      light.shadow.bias = -.0001;
      light.shadow.normalBias = .015;
      this.lights = [sky, light];
      journey.scene.add(...this.lights);
      journey.katana.traverse(object => { if (object.isMesh) object.castShadow = true; });
      this.fog = new T.Fog(0xd9dee7, 180, 520);
      this.white = new T.Color(0xffffff);
      this.cold = new T.Color(0xd9dee7);
      this.night = new T.Color(0x171b24);
      this.position = new T.Vector3();
      this.rotation = new T.Quaternion();
      this.euler = new T.Euler(0, 0, 0, 'YXZ');
      this.direction = new T.Vector3();
      const height = 148/(1440/1536), bottom = -(1536-1470)/1536*height;
      this.boy = new T.Mesh(own(new T.BufferGeometry()), own(new T.MeshBasicMaterial()));
      this.boy.name = 'approved-static-boy';
      this.boy.position.set(0, bottom+height/2, window.BRAVE_WORLD.boy[2]);
      this.boy.visible = false;
      journey.scene.add(this.boy);
      const shadowCanvas = document.createElement('canvas');
      shadowCanvas.width = shadowCanvas.height = 128;
      const ctx = shadowCanvas.getContext('2d'), gradient = ctx.createRadialGradient(64,64,5,64,64,64);
      gradient.addColorStop(0, 'rgba(30,28,35,.24)'); gradient.addColorStop(1, 'rgba(30,28,35,0)');
      ctx.fillStyle = gradient; ctx.fillRect(0,0,128,128);
      this.shadow = new T.Mesh(own(new T.PlaneGeometry(65,18)), own(new T.MeshBasicMaterial({map:own(new T.CanvasTexture(shadowCanvas)), transparent:true, depthWrite:false})));
      this.shadow.rotation.x = -Math.PI/2; this.shadow.position.set(0,.013,-88);
      this.shadow.name = 'boy-ground-contact'; journey.scene.add(this.shadow);
    }
    async load(url) {
      const texture = await new this.T.TextureLoader().loadAsync(url);
      if (this.disposed) { texture.dispose(); return; }
      try {
        this.ink = window.FateBraveInk.create(this.T, texture.image, resource => (this.resources.push(resource), resource));
        this.material = this.boy.material = this.ink.material;
        this.boy.geometry = this.ink.geometry;
      } finally { texture.dispose(); }
      this.ready = true;
    }
    update(score, time = 0) {
      const j = this.journey, T = this.T;
      const arrival = ease((score-194)/24), progress = clamp((score-218)/112);
      const pose = window.braveCameraPose(progress, j.camera.aspect, j.camera.fov);
      j.scene.background.copy(this.white).lerp(this.cold, arrival);
      const dusk = ease((progress-.44)/.11);
      j.scene.background.lerp(this.night, dusk);
      this.lights[0].intensity = .70-.42*dusk;
      this.lights[1].intensity = 1.25-.60*dusk;
      this.fog.color.copy(j.scene.background);
      j.scene.fog = this.fog;
      // Keep the distant illustration out of the blade's reading passage.
      // It enters the render set at an offscreen point, before the footprint;
      // its world position, scale and opacity never change during the journey.
      this.boy.visible = this.ready && score >= 218;
      this.needsAnimation = this.ready && progress >= .44;
      if (this.ink) this.ink.uniforms.uTime.value = time;
      this.shadow.visible = score >= 218;
      if (score >= 194) {
        this.position.fromArray(pose.camera);
        this.rotation.setFromEuler(this.euler.set(pose.pitch, pose.yaw, 0, 'YXZ'));
        j.camera.position.lerp(this.position, arrival);
        j.camera.quaternion.slerp(this.rotation, arrival);
        j.camera.updateMatrixWorld();
        j.camera.getWorldDirection(this.direction);
        j.target.copy(j.camera.position).addScaledVector(this.direction, 50);
      }
      this.progress = progress;
      this.phase = score < 194 ? 'blade' : score < 218 ? 'clearing-arrival' : pose.phase;
      this.slot = score >= 218 ? pose.slot : null;
      j.phase = this.phase;
      // Reserve actual empty composition space; no story copy or controls.
      const slot = document.getElementById('brave-text-space');
      const slotKey = this.slot ? this.slot.side+this.slot.rect.join(',') : '';
      if (slot && this.slotKey !== slotKey) {
        this.slotKey = slotKey;
        slot.hidden = !this.slot;
        if (this.slot) {
          const [x,y,w,h] = this.slot.rect;
          Object.assign(slot.style, {left:x*100+'%', top:y*100+'%', width:w*100+'%', height:h*100+'%'});
          slot.dataset.side = this.slot.side;
        }
      }
    }
    dispose() {
      this.disposed = true;
      this.ground.dispose();
      this.resources.forEach(resource => resource.dispose());
      this.resources.length = 0;
      this.lights.forEach(light => { light.shadow?.map?.dispose(); light.removeFromParent(); });
      this.boy.removeFromParent(); this.shadow.removeFromParent();
    }
  }
  window.FateBrave = FateBrave;
})();
