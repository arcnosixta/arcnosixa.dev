/* Original art plates in perspective space. The blade, fog, ash and light are
   procedural. All narrative transforms are pure functions of scroll progress. */
(() => {
  "use strict";
  const T = window.THREE;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;
  function randomSource(seed) {
    return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  }
  const noiseGLSL = `
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
    float noise(vec2 p) {
      vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
    }
    float fbm(vec2 p) { return noise(p)*.57+noise(p*2.03)*.28+noise(p*4.07)*.15; }
  `;
  const planeVertex = `varying vec2 vUv;
    void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;

  class FateScene {
    constructor(canvas, onFailure) {
      this.canvas = canvas;
      this.onFailure = onFailure;
      this.disposed = false;
      this.progress = 0;
      this.time = 0;
      this.quality = matchMedia("(max-width: 700px)").matches || (navigator.deviceMemory || 8) <= 4 ? .6 : 1;
      this.resources = new Set();
      this.textures = new Set();
      const options = { alpha: false, antialias: false, powerPreference: "high-performance" };
      const context = canvas.getContext("webgl2", options) || canvas.getContext("webgl", options);
      if (!context) throw new Error("WebGL unavailable; use the illustrated story");
      this.renderer = new T.WebGLRenderer({ canvas, context, ...options });
      this.renderer.setClearColor(0x000000, 1);
      this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.quality < 1 ? 1.25 : 1.65));
      this.renderer.outputEncoding = T.sRGBEncoding;
      this.scene = new T.Scene();
      this.camera = new T.PerspectiveCamera(42, 1, .1, 100);
      this.target = new T.Vector3(0, 0, 0);
      this.assets = {};
      this.resolution = new T.Vector2(1, 1);
      this.makeAtmosphere();
      this.makeBlade();
      this.makeAsh();
      this.resize();
      this.onContextLost = (event) => { event.preventDefault(); this.onFailure(); };
      canvas.addEventListener("webglcontextlost", this.onContextLost);
      this.frames = 0;
      this.slowFrames = 0;
    }
    own(resource) { this.resources.add(resource); return resource; }
    material(options) { return this.own(new T.ShaderMaterial(options)); }
    async loadArt() {
      const loader = new T.TextureLoader();
      const load = (name) => new Promise((resolve, reject) => {
        loader.load(new URL(`../assets/fate/${name}.png`, document.baseURI).href, (texture) => {
          if (this.disposed) { texture.dispose(); resolve(null); return; }
          texture.minFilter = T.LinearMipmapLinearFilter;
          texture.magFilter = T.LinearFilter;
          texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
          this.textures.add(texture);
          resolve(texture);
        }, undefined, reject);
      });
      const [child, hands, sea] = await Promise.all([load("child"), load("hands-atlas"), load("congregation")]);
      if (this.disposed) return;
      this.makeChild(child);
      this.makeHands(hands);
      this.makeCongregation(sea);
      this.ready = true;
    }
    makeAtmosphere() {
      this.fog = this.material({
        uniforms: { uTime: { value: 0 }, uLight: { value: 0 }, uAspect: { value: 1 } },
        vertexShader: planeVertex,
        fragmentShader: `varying vec2 vUv; uniform float uTime,uLight,uAspect; ${noiseGLSL}
          void main(){
            vec2 p=vUv; p.x=(p.x-.5)*uAspect+.5;
            float n=fbm(vec2(p.x*6.,p.y*7.+uTime*.028));
            float veil=fbm(vec2(p.x*3.-uTime*.016,p.y*5.));
            float width=.025+(1.-vUv.y)*.3;
            float shaft=exp(-pow(abs(p.x-.5)/width,1.3))*pow(vUv.y,1.1);
            float rays=pow(.5+.5*sin((p.x-.5)/(1.3-vUv.y)*55.+n*.6),10.);
            float intensity=(shaft*(.25+n*.5+rays*.18)+veil*.027)*uLight;
            gl_FragColor=vec4(vec3(.78,.82,.92)*intensity,1.);
          }`, depthWrite: false, depthTest: false
      });
      const fogPlane = new T.Mesh(this.own(new T.PlaneGeometry(180, 120)), this.fog);
      fogPlane.position.set(0, 0, -45);
      fogPlane.renderOrder = -20;
      this.scene.add(fogPlane);
    }
    bladeGeometry(halo = false) {
      const positions = [], uvs = [], indices = [];
      const point = new T.Vector3(), tangent = new T.Vector3();
      for (let i = 0; i <= 240; i++) {
        const t = i / 240;
        this.bladeCurve.getPoint(t, point);
        this.bladeCurve.getTangent(t, tangent);
        const width = Math.pow(Math.sin(Math.PI * t), 1.45) * (halo ? 1.65 : .37) + .003;
        const normal = new T.Vector3(-tangent.y, tangent.x, 0).normalize();
        for (const side of [-1, 1]) {
          const p = point.clone().addScaledVector(normal, width * side * (side < 0 ? .66 : 1));
          positions.push(p.x, p.y, p.z);
          uvs.push(t, side < 0 ? 0 : 1);
        }
        if (i < 240) { const k = i * 2; indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
      const g = this.own(new T.BufferGeometry());
      g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
      g.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
      g.setIndex(indices);
      return g;
    }
    makeBlade() {
      this.bladeCurve = new T.CubicBezierCurve3(new T.Vector3(2.7, 5.8, 0), new T.Vector3(-6.7, 4.3, 0), new T.Vector3(-5.8, -5.1, 0), new T.Vector3(3.3, -4.8, 0));
      this.bladeUniforms = { uTime: { value: 0 }, uReveal: { value: 0 }, uAlpha: { value: 0 }, uPower: { value: 1 } };
      this.blade = new T.Group();
      this.scene.add(this.blade);
      for (const halo of [true, false]) {
        const mat = this.material({
          uniforms: this.bladeUniforms, vertexShader: planeVertex,
          fragmentShader: `varying vec2 vUv; uniform float uTime,uReveal,uAlpha,uPower; ${noiseGLSL}
            void main(){
              float reveal=1.-smoothstep(uReveal-.008,uReveal+.003,vUv.x);
              float edge=abs(vUv.y-.5)*2.;
              float tear=noise(vec2(vUv.x*270.,uTime*.3))*.17;
              float alpha=${halo ? "pow(max(0.,1.-edge),3.)*.28" : "1.-smoothstep(.73-tear,1.-tear,edge)"};
              float tip=exp(-abs(vUv.x-uReveal)*170.)*.8;
              vec3 color=mix(vec3(.65,.72,.86),vec3(1.),${halo ? ".5" : ".94"});
              gl_FragColor=vec4(color*(uPower+tip),alpha*reveal*uAlpha);
            }`, transparent: true, blending: T.AdditiveBlending, side: T.DoubleSide, depthWrite: false
        });
        this.blade.add(new T.Mesh(this.bladeGeometry(halo), mat));
      }
      this.moon = this.blade.clone();
      this.moonUniforms = { uTime: { value: 0 }, uReveal: { value: 1.02 }, uAlpha: { value: 0 }, uPower: { value: .6 } };
      this.moon.children.forEach((mesh) => {
        mesh.material = this.own(mesh.material.clone());
        mesh.material.uniforms = this.moonUniforms;
      });
      this.moon.rotation.z = -Math.PI / 2 - .13;
      this.moon.scale.setScalar(.48);
      this.scene.add(this.moon);

      const random = randomSource(137);
      const positions = [], along = [], velocity = [], size = [];
      for (let i = 0; i < 360; i++) {
        const t = random();
        const p = this.bladeCurve.getPoint(t);
        positions.push(p.x, p.y, 0);
        along.push(t);
        velocity.push((random() - .5) * 5, (random() - .5) * 5, (random() - .5) * 3);
        size.push(.3 + random() * 1.5);
      }
      const g = this.own(new T.BufferGeometry());
      g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
      g.setAttribute("aAlong", new T.Float32BufferAttribute(along, 1));
      g.setAttribute("aVelocity", new T.Float32BufferAttribute(velocity, 3));
      g.setAttribute("aSize", new T.Float32BufferAttribute(size, 1));
      this.sparkUniforms = { uReveal: { value: 0 }, uAlpha: { value: 0 }, uPixel: { value: 1 } };
      const material = this.material({
        uniforms: this.sparkUniforms,
        vertexShader: `attribute float aAlong,aSize; attribute vec3 aVelocity; uniform float uReveal,uPixel; varying float vAlpha;
          void main(){ float age=uReveal-aAlong; vAlpha=step(0.,age)*(1.-smoothstep(.02,.32,age));
          vec3 p=position+aVelocity*max(0.,age)*2.; p.y-=max(0.,age)*max(0.,age)*6.;
          vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=clamp(aSize*uPixel*24./-mv.z,1.,6.); }`,
        fragmentShader: `uniform float uAlpha; varying float vAlpha;
          void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(.83,.87,1.,(1.-smoothstep(.05,.5,d))*vAlpha*uAlpha);}`,
        transparent: true, blending: T.AdditiveBlending, depthWrite: false
      });
      this.blade.add(new T.Points(g, material));
    }
    makeAsh() {
      const random = randomSource(69), positions = [], seeds = [];
      this.ashCount = this.quality < 1 ? 220 : 600;
      for (let i = 0; i < this.ashCount; i++) {
        positions.push((random() - .5) * 42, (random() - .5) * 32, (random() - .5) * 22);
        seeds.push(random(), random(), random());
      }
      const g = this.own(new T.BufferGeometry());
      g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
      g.setAttribute("aSeed", new T.Float32BufferAttribute(seeds, 3));
      this.ashUniforms = { uTime: { value: 0 }, uRise: { value: 0 }, uAlpha: { value: .02 }, uPixel: { value: 1 }, uSplit: { value: 0 } };
      const m = this.material({
        uniforms: this.ashUniforms,
        vertexShader: `attribute vec3 aSeed; uniform float uTime,uRise,uPixel,uSplit; varying float vAlpha;
          void main(){ vec3 p=position; p.y=mod(p.y+16.+uTime*(.08+aSeed.x*.12)+uRise*9.,32.)-16.;
          p.x+=sin(uTime*.1+aSeed.z*30.)*.18+sign(p.x)*uSplit; vec4 mv=modelViewMatrix*vec4(p,1.);
          gl_Position=projectionMatrix*mv; gl_PointSize=clamp((.7+aSeed.y*2.7)*uPixel*14./-mv.z,.7,5.);
          vAlpha=(.12+aSeed.x*.6)*smoothstep(3.,10.,-mv.z); }`,
        fragmentShader: `uniform float uAlpha; varying float vAlpha;
          void main(){float a=1.-smoothstep(.05,.5,length(gl_PointCoord-.5));gl_FragColor=vec4(.77,.8,.9,a*vAlpha*uAlpha);}`,
        transparent: true, blending: T.AdditiveBlending, depthWrite: false
      });
      this.ash = new T.Points(g, m);
      this.scene.add(this.ash);
    }
    makeChild(texture) {
      this.childUniforms = { uMap: { value: texture }, uTime: { value: 0 }, uAlpha: { value: 0 }, uLight: { value: 0 } };
      const material = this.material({
        uniforms: this.childUniforms,
        vertexShader: `varying vec2 vUv; uniform float uTime;
          void main(){vUv=uv;vec3 p=position; p.x+=sin(uv.y*8.+uTime*.55)*.012*(1.-uv.y);p.y+=sin(uTime*.9)*.009;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
        fragmentShader: `varying vec2 vUv; uniform sampler2D uMap; uniform float uAlpha,uLight;
          void main(){ vec4 c=texture2D(uMap,vUv);float l=dot(c.rgb,vec3(.299,.587,.114));
          vec3 rgb=mix(vec3(l)*.8,vec3(.97,.97,1.),uLight);
          gl_FragColor=vec4(rgb,c.a*uAlpha); }`,
        transparent: true, depthWrite: false, side: T.DoubleSide
      });
      this.child = new T.Mesh(this.own(new T.PlaneGeometry(1.8, 2.7, 8, 16)), material);
      this.child.renderOrder = 3;
      this.scene.add(this.child);
    }
    makeCongregation(texture) {
      this.seaUniforms = { uMap: { value: texture }, uAlpha: { value: 0 }, uTime: { value: 0 } };
      const material = this.material({
        uniforms: this.seaUniforms,
        vertexShader: `varying vec2 vUv; uniform float uTime;
          void main(){vUv=uv;vec3 p=position;p.y+=sin(uv.x*8.+uTime*.2)*.06;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
        fragmentShader: `varying vec2 vUv; uniform sampler2D uMap; uniform float uAlpha;
          void main(){vec3 c=texture2D(uMap,vUv).rgb;float l=dot(c,vec3(.299,.587,.114));
          float edge=smoothstep(0.,.12,vUv.x)*smoothstep(0.,.12,1.-vUv.x)*smoothstep(0.,.1,vUv.y);
          gl_FragColor=vec4(vec3(l*.89,l*.91,l*.97),uAlpha*edge);}`,
        transparent: true, blending: T.AdditiveBlending, depthWrite: false
      });
      this.sea = new T.Mesh(this.own(new T.PlaneGeometry(27, 15.2, 30, 16)), material);
      this.sea.position.z = -5;
      this.sea.renderOrder = 0;
      this.scene.add(this.sea);
    }
    makeHands(texture) {
      const random = randomSource(1407);
      const count = this.quality < 1 ? 72 : 192;
      const plane = this.own(new T.PlaneGeometry(1, 1, 1, 8));
      const geometry = this.own(new T.InstancedBufferGeometry());
      geometry.index = plane.index;
      geometry.attributes.position = plane.attributes.position;
      geometry.attributes.uv = plane.attributes.uv;
      const data = [];
      for (let i = 0; i < count; i++) {
        const support = i < 3;
        const x = support ? [0, -.52, .55][i] : (random() - .5) * 24;
        const z = support ? [.1, .5, .3][i] : -6 + random() * 9;
        const height = support ? 3.2 : 2.1 + random() * 3.7;
        data.push({ x, z, height, tip: support ? .67 : -.4 - Math.abs(x) * .23 - random() * 1.8,
          rotation: support ? [0, -.14, .16][i] : -x * .025 + (random() - .5) * .28,
          variant: support ? [1, 1, 3][i] : Math.floor(random() * 4),
          delay: i === 0 ? .425 : i < 3 ? .478 : i < 10 ? .515 + i * .002 : .54 + Math.pow((i - 10) / (count - 10), .65) * .105,
          seed: random(), shade: support ? .79 : .25 + random() * .37 });
      }
      // Back-to-front alpha blending; the birth time remains attached to its hand.
      data.sort((a, b) => a.z - b.z);
      const offset = [], form = [], fate = [];
      data.forEach((d) => {
        offset.push(d.x, d.tip - d.height, d.z);
        form.push(d.height, d.rotation, d.variant, d.seed);
        fate.push(d.delay, d.shade);
      });
      geometry.setAttribute("aOffset", new T.InstancedBufferAttribute(new Float32Array(offset), 3));
      geometry.setAttribute("aForm", new T.InstancedBufferAttribute(new Float32Array(form), 4));
      geometry.setAttribute("aFate", new T.InstancedBufferAttribute(new Float32Array(fate), 2));
      geometry.instanceCount = count;
      this.handUniforms = { uMap: { value: texture }, uProgress: { value: 0 }, uRise: { value: 0 }, uTime: { value: 0 }, uAlpha: { value: 0 } };
      const material = this.material({
        uniforms: this.handUniforms,
        vertexShader: `attribute vec3 aOffset; attribute vec4 aForm; attribute vec2 aFate;
          uniform float uProgress,uRise,uTime; varying vec2 vUv,vLocal; varying float vAlpha,vShade;
          void main(){
            float born=smoothstep(aFate.x,aFate.x+.045,uProgress);
            float col=mod(aForm.z,2.),row=1.-floor(aForm.z/2.);
            vLocal=uv; vUv=(clamp(uv,.006,.994)+vec2(col,row))*.5;
            vec3 p=position; p.y+=.5;p.xy*=aForm.x;
            float angle=aForm.y+sin(uTime*.28+aForm.w*20.)*.012;
            p.xy=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*p.xy;
            p+=aOffset;p.y+=uRise-(1.-born)*5.;p.z+=sin(uTime*.17+aForm.w*40.)*.04;
            gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
            vAlpha=born; vShade=aFate.y*smoothstep(-10.,2.,aOffset.z)*.7+aFate.y*.3;
          }`,
        fragmentShader: `uniform sampler2D uMap;uniform float uAlpha;varying vec2 vUv,vLocal;varying float vAlpha,vShade;
          void main(){vec4 c=texture2D(uMap,vUv);float gray=dot(c.rgb,vec3(.299,.587,.114));
          float alpha=c.a*vAlpha*uAlpha*smoothstep(.015,.27,vLocal.y);if(alpha<.003)discard;
          gl_FragColor=vec4(vec3(gray)*vShade,alpha);}`,
        transparent: true, depthWrite: false, side: T.DoubleSide
      });
      this.hands = new T.Mesh(geometry, material);
      this.hands.frustumCulled = false;
      this.hands.renderOrder = 1;
      this.scene.add(this.hands);
    }
    resize() {
      if (this.disposed) return;
      const width = this.canvas.clientWidth || innerWidth;
      const height = this.canvas.clientHeight || innerHeight;
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.fov = width < 700 ? 49 : 42;
      this.camera.updateProjectionMatrix();
      this.fog.uniforms.uAspect.value = Math.min(2, width / height);
      this.ashUniforms.uPixel.value = this.renderer.getPixelRatio();
      this.sparkUniforms.uPixel.value = this.renderer.getPixelRatio();
    }
    render(progress, delta = 1 / 60) {
      if (this.disposed) return;
      this.progress = progress;
      this.time += Math.min(.05, delta);
      const p = progress, time = this.time;
      const emerge = smooth(.285, .34, p), approach = smooth(.30, .44, p);
      const rise = smooth(.54, .805, p) * 4.2;
      const ascend = smooth(.67, .815, p);
      const exit = 1 - smooth(.836, .87, p);
      let z = mix(23, 31, smooth(.265, .3, p));
      z = mix(z, 17.8, approach);
      z = mix(z, 25.8, ascend);
      this.camera.position.set(Math.sin(p * 7) * .4 * emerge, mix(0, 1.3, emerge) + rise * .79, z);
      this.target.set(0, mix(0, 1.2, emerge) + rise * .8, 0);
      this.camera.lookAt(this.target);
      this.fog.uniforms.uTime.value = time;
      this.fog.uniforms.uLight.value = (emerge * .07 + ascend * .5) * exit;
      this.bladeUniforms.uTime.value = time;
      const reveal = smooth(.105, .215, p) * 1.02;
      const portal = smooth(.24, .293, p);
      this.bladeUniforms.uReveal.value = reveal;
      this.bladeUniforms.uAlpha.value = smooth(.105, .117, p) * (1 - smooth(.278, .298, p));
      this.bladeUniforms.uPower.value = 1 + portal;
      this.blade.scale.setScalar(1 + portal * 4.5);
      this.blade.rotation.z = -.19 - portal * .16;
      this.blade.position.set(portal * 1.5, portal * -.5, portal * 4);
      this.blade.visible = p > .1 && p < .3;
      this.sparkUniforms.uReveal.value = reveal;
      this.sparkUniforms.uAlpha.value = this.bladeUniforms.uAlpha.value;
      this.moon.position.set(0, 4.8 + rise * .7, -1.8);
      this.moonUniforms.uTime.value = time;
      this.moonUniforms.uAlpha.value = emerge * exit * .72;
      this.moonUniforms.uPower.value = .5 + ascend * 1.7;
      this.moon.visible = p > .285 && p < .87;
      this.ashUniforms.uTime.value = time;
      this.ashUniforms.uRise.value = ascend;
      this.ashUniforms.uAlpha.value = (.025 + smooth(.08, .15, p) * .2 + ascend * .45) * exit;
      this.ashUniforms.uSplit.value = smooth(.16, .23, p) * (1 - emerge) * .7;
      if (this.ready) {
        this.child.position.set(0, 1.35 + rise, .65);
        this.childUniforms.uAlpha.value = emerge * exit;
        this.childUniforms.uTime.value = time;
        this.childUniforms.uLight.value = smooth(.74, .831, p) * .94;
        this.child.visible = p > .285 && p < .87;
        this.handUniforms.uTime.value = time;
        this.handUniforms.uProgress.value = p;
        this.handUniforms.uRise.value = rise;
        this.handUniforms.uAlpha.value = exit;
        this.hands.visible = p > .425 && p < .87;
        this.sea.position.y = rise - 3.8 - (1 - smooth(.54, .67, p)) * 5;
        this.seaUniforms.uAlpha.value = smooth(.55, .675, p) * exit * .9;
        this.seaUniforms.uTime.value = time;
        this.sea.visible = p > .54 && p < .87;
      }
      this.renderer.render(this.scene, this.camera);
      // A sustained slow device loses pixels/particles, not narrative information.
      if (delta < .2 && p > .32 && p < .82 && this.frames < 180) {
        this.frames++;
        if (delta > .028) this.slowFrames++;
        if (this.frames === 180 && this.slowFrames > 90) {
          this.renderer.setPixelRatio(1);
          this.ash.geometry.setDrawRange(0, Math.floor(this.ashCount * .55));
          this.resize();
        }
      }
    }
    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
      this.resources.forEach((r) => r.dispose());
      this.textures.forEach((t) => t.dispose());
      this.resources.clear();
      this.textures.clear();
      this.scene.clear();
      this.renderer.dispose();
      const context = this.renderer.getContext();
      if (!context.isContextLost()) context.getExtension("WEBGL_lose_context")?.loseContext();
    }
  }
  window.FateScene = FateScene;
})();
