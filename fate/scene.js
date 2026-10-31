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
  // Use only the newborn plate's silhouette. Its RGB (skin, face and cloth)
  // never enters the character shader, including during transfiguration.
  const infantMaskGLSL = `
    float infantMask(vec2 uv){
      if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.) return 0.;
      return smoothstep(.55,.93,texture2D(uMap,uv).a);
    }
  `;
  const infantVertex = `varying vec2 vUv; uniform float uTime;
    void main(){vUv=uv;vec3 p=position;p.y+=sin(uTime*.9)*.009;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;

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
      this.makeAuraPass();
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
      const [child, hands, sea] = await Promise.all([load("newborn"), load("hands-atlas"), load("congregation")]);
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
        const width = Math.pow(Math.sin(Math.PI * t), 1.35) * (halo ? 2.15 : .78) + .003;
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
      // A 340-degree circular sweep, open at the left. Width tapers independently
      // of the circular centreline: this is a crescent, not an elliptical arch.
      this.bladeCurve = {
        getPoint(t, out = new T.Vector3()) {
          const angle = Math.PI * 17 / 18 - t * Math.PI * 17 / 9;
          return out.set(Math.cos(angle) * 4.25, Math.sin(angle) * 4.25, 0);
        },
        getTangent(t, out = new T.Vector3()) {
          const angle = Math.PI * 17 / 18 - t * Math.PI * 17 / 9;
          return out.set(Math.sin(angle), -Math.cos(angle), 0);
        }
      };
      this.bladeUniforms = { uTime: { value: 0 }, uReveal: { value: 0 }, uAlpha: { value: 0 }, uPower: { value: 1 }, uInk: { value: 0 } };
      this.blade = new T.Group();
      this.scene.add(this.blade);
      const corona = this.material({
        uniforms: this.bladeUniforms, vertexShader: planeVertex,
        fragmentShader: `varying vec2 vUv; uniform float uTime,uReveal,uAlpha,uPower,uInk; ${noiseGLSL}
          void main(){
            vec2 p=(vUv-.5)*14.; float radius=length(p), angle=atan(p.y,p.x);
            float along=mod(2.96705973-angle+6.28318531,6.28318531)/5.93411946;
            float sweep=(1.-smoothstep(uReveal-.04,uReveal+.02,along));
            float tips=smoothstep(0.,.03,along)*(1.-smoothstep(.97,1.,along));
            float n=fbm(p*.93+vec2(uTime*.055,-uTime*.08));
            float curl=fbm(p*2.1+vec2(-uTime*.11,uTime*.06));
            float d=abs(radius-4.25+(n-.5)*.9);
            float ring=exp(-d*2.9)*(.6+n*.7);
            float smoke=exp(-pow((radius-4.45)/1.65,2.))*smoothstep(.24,.76,n)*(.3+curl);
            float inside=exp(-radius*radius/12.)*.1*smoothstep(.5,.95,uReveal);
            float boundary=1.-smoothstep(5.7,6.85,radius);
            float light=((ring*.6+smoke*.85)*sweep*tips+inside)*(1.+uInk*.35)*boundary;
            gl_FragColor=vec4(vec3(.79,.85,.95)*light*sqrt(uPower),uAlpha);
          }`, transparent: true, blending: T.AdditiveBlending, depthWrite: false
      });
      const aura = new T.Mesh(this.own(new T.PlaneGeometry(14, 14)), corona);
      aura.position.z = -.03;
      aura.renderOrder = -5;
      this.blade.add(aura);
      for (const halo of [true, false]) {
        const mat = this.material({
          uniforms: this.bladeUniforms, vertexShader: planeVertex,
          fragmentShader: `varying vec2 vUv; uniform float uTime,uReveal,uAlpha,uPower,uInk; ${noiseGLSL}
            void main(){
              float reveal=1.-smoothstep(uReveal-.008,uReveal+.003,vUv.x);
              float edge=abs(vUv.y-.5)*2.;
              float tear=noise(vec2(vUv.x*270.,uTime*.3))*.17;
              float alpha=${halo ? "pow(max(0.,1.-edge),3.)*.28" : "1.-smoothstep(.73-tear,1.-tear,edge)"};
              float tip=exp(-abs(vUv.x-uReveal)*170.)*.8;
              vec3 color=mix(vec3(.65,.72,.86),vec3(1.),${halo ? ".5" : ".94"});
              ${halo ? "" : "float rim=smoothstep(.70,.91,edge);color=mix(color,mix(vec3(.012,.016,.022),vec3(.75,.81,.93),rim),uInk);"}
              gl_FragColor=vec4(color*(uPower+tip),alpha*reveal*uAlpha);
            }`, transparent: true, blending: halo ? T.AdditiveBlending : T.NormalBlending, side: T.DoubleSide, depthWrite: false
        });
        this.blade.add(new T.Mesh(this.bladeGeometry(halo), mat));
      }
      this.moon = this.blade.clone();
      this.moonUniforms = { uTime: { value: 0 }, uReveal: { value: 1.02 }, uAlpha: { value: 0 }, uPower: { value: 1 }, uInk: { value: 1 } };
      this.moon.children.forEach((mesh) => {
        mesh.material = this.own(mesh.material.clone());
        mesh.material.uniforms = this.moonUniforms;
      });
      this.moon.rotation.z = -.18;
      this.moon.scale.setScalar(.37);
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
    makeAuraPass() {
      // A small separable bloom pass follows the actual luminous silhouettes,
      // including the individual hands. UI and captions never enter this pass.
      const options = { minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: false, stencilBuffer: false };
      this.sceneTarget = this.own(new T.WebGLRenderTarget(1, 1, options));
      this.glowA = this.own(new T.WebGLRenderTarget(1, 1, options));
      this.glowB = this.own(new T.WebGLRenderTarget(1, 1, options));
      const vertexShader = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
      this.blur = this.material({
        uniforms: { uMap: { value: null }, uStep: { value: new T.Vector2() }, uExtract: { value: 1 } },
        vertexShader,
        fragmentShader: `varying vec2 vUv;uniform sampler2D uMap;uniform vec2 uStep;uniform float uExtract;
          vec3 sampleLight(vec2 uv){vec3 c=texture2D(uMap,uv).rgb;float l=max(c.r,max(c.g,c.b));return c*mix(1.,smoothstep(.09,.38,l),uExtract);}
          void main(){vec3 c=sampleLight(vUv)*.227027;
            c+=(sampleLight(vUv+uStep*1.384615)+sampleLight(vUv-uStep*1.384615))*.316216;
            c+=(sampleLight(vUv+uStep*3.230769)+sampleLight(vUv-uStep*3.230769))*.070270;
            gl_FragColor=vec4(c,1.);}`,
        depthTest: false, depthWrite: false
      });
      this.composite = this.material({
        uniforms: { uScene: { value: this.sceneTarget.texture }, uGlow: { value: this.glowB.texture }, uTime: { value: 0 }, uAura: { value: 0 } },
        vertexShader,
        fragmentShader: `varying vec2 vUv;uniform sampler2D uScene,uGlow;uniform float uTime,uAura;${noiseGLSL}
          void main(){vec3 base=texture2D(uScene,vUv).rgb;
            float mist=fbm(vUv*vec2(19.,12.)+vec2(uTime*.025,-uTime*.035));
            vec2 drift=vec2(mist-.5,noise(vUv*25.+uTime*.02)-.5)*.006;
            vec3 glow=texture2D(uGlow,vUv+drift).rgb;
            gl_FragColor=vec4(base+glow*vec3(.84,.9,1.)*uAura*(.75+mist*.55),1.);}`,
        depthTest: false, depthWrite: false
      });
      this.postScene = new T.Scene();
      this.postCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.postQuad = new T.Mesh(this.own(new T.PlaneGeometry(2, 2)), this.blur);
      this.postQuad.frustumCulled = false;
      this.postScene.add(this.postQuad);
    }
    makeChild(texture) {
      this.childUniforms = { uMap: { value: texture }, uTime: { value: 0 }, uAlpha: { value: 0 }, uLight: { value: 0 } };
      const material = this.material({
        uniforms: this.childUniforms,
        vertexShader: infantVertex,
        fragmentShader: `varying vec2 vUv; uniform sampler2D uMap; uniform float uTime,uAlpha,uLight;
          ${infantMaskGLSL}
          float aperture(vec2 p,vec2 center,vec2 radius,float angle){
            vec2 d=p-center;float c=cos(angle),s=sin(angle);
            vec2 q=vec2(c*d.x+s*d.y,-s*d.x+c*d.y)/radius;
            float r=length(q);
            return (1.-smoothstep(.65,1.12,r))+exp(-r*r*.55)*.38;
          }
          void main(){
            float shape=infantMask(vUv);
            vec2 p=vec2(vUv.x,1.-vUv.y)*vec2(1536.,1024.);
            // Eye and mouth apertures follow the three-quarter infant pose.
            float eyes=aperture(p,vec2(401.,350.),vec2(34.,13.),-.82)
                      +aperture(p,vec2(495.,263.),vec2(26.,11.),-.61);
            float mouth=aperture(p,vec2(549.,380.),vec2(19.,26.),.58);
            float breath=.94+.06*sin(uTime*.9);
            vec3 rgb=vec3(.97,.985,1.)*uLight;
            rgb+=vec3(.86,.92,1.)*(eyes+mouth)*breath*(1.-uLight);
            gl_FragColor=vec4(rgb,shape*uAlpha);
          }`,
        transparent: true, depthWrite: false, side: T.DoubleSide
      });
      const auraMaterial = this.material({
        uniforms: this.childUniforms, vertexShader: infantVertex,
        fragmentShader: `varying vec2 vUv;uniform sampler2D uMap;uniform float uTime,uAlpha,uLight;
          ${noiseGLSL} ${infantMaskGLSL}
          void main(){
            vec2 uv=(vUv-.5)*1.8+.5;
            float smoke=fbm(uv*vec2(13.,9.)+vec2(uTime*.06,-uTime*.13));
            vec2 drift=vec2(smoke-.5,noise(uv*11.-uTime*.07)-.5)*.025;
            float nearGlow=0.,farGlow=0.;
            for(int i=0;i<12;i++){
              float angle=float(i)*.52359878;
              vec2 direction=vec2(cos(angle),sin(angle))*vec2(1.,1.5);
              nearGlow+=infantMask(uv+direction*.027+drift*.3);
              farGlow+=infantMask(uv+direction*(.065+smoke*.055)+drift);
            }
            nearGlow/=12.;farGlow/=12.;
            float outside=1.-infantMask(uv);
            float breath=.94+.06*sin(uTime*.9);
            float light=(nearGlow*.85+farGlow*(.32+smoke*.8))*outside*breath;
            vec3 color=mix(vec3(.32,.39,.53),vec3(.86,.93,1.),uLight);
            gl_FragColor=vec4(color,light*uAlpha*(.8+uLight*1.9));
          }`,
        transparent: true, blending: T.AdditiveBlending, depthWrite: false
      });
      const body = new T.Mesh(this.own(new T.PlaneGeometry(3.05, 2.033)), material);
      body.renderOrder = 3;
      const aura = new T.Mesh(this.own(new T.PlaneGeometry(3.05 * 1.8, 2.033 * 1.8)), auraMaterial);
      aura.position.z = -.025;
      aura.renderOrder = 2;
      this.child = new T.Group();
      this.child.add(aura, body);
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
        const x = support ? [-.53, .12, .68][i] : (random() - .5) * 24;
        const z = support ? [.1, .5, .3][i] : -6 + random() * 9;
        const height = support ? 3.2 : 2.1 + random() * 3.7;
        data.push({ x, z, height, tip: support ? 1.06 : -.4 - Math.abs(x) * .23 - random() * 1.8,
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
      this.renderer.getDrawingBufferSize(this.resolution);
      this.sceneTarget.setSize(this.resolution.x, this.resolution.y);
      const glowScale = this.quality < 1 ? .25 : .35;
      this.glowA.setSize(Math.max(1, Math.round(width * glowScale)), Math.max(1, Math.round(height * glowScale)));
      this.glowB.setSize(this.glowA.width, this.glowA.height);
      this.mobile = width < 700;
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
      this.blade.scale.setScalar((this.mobile ? .81 : 1) * (1 + portal * 4.5));
      this.blade.rotation.z = -.19 - portal * .16;
      this.blade.position.set((this.mobile ? -.05 : -1.8) + portal * 1.5, portal * -.5, portal * 4);
      this.blade.visible = p > .1 && p < .3;
      this.sparkUniforms.uReveal.value = reveal;
      this.sparkUniforms.uAlpha.value = this.bladeUniforms.uAlpha.value;
      this.moon.position.set(0, 5.3 + rise * .7, -1.8);
      this.moonUniforms.uTime.value = time;
      this.moonUniforms.uAlpha.value = emerge * exit;
      this.moonUniforms.uPower.value = .85 + ascend * 1.4;
      this.moon.visible = p > .285 && p < .87;
      this.ashUniforms.uTime.value = time;
      this.ashUniforms.uRise.value = ascend;
      this.ashUniforms.uAlpha.value = (.025 + smooth(.08, .15, p) * .2 + ascend * .45) * exit;
      this.ashUniforms.uSplit.value = smooth(.16, .23, p) * (1 - emerge) * .7;
      if (this.ready) {
        this.child.position.set(0, 1.05 + rise, .65);
        this.childUniforms.uAlpha.value = emerge * exit;
        this.childUniforms.uTime.value = time;
        this.childUniforms.uLight.value = smooth(.715, .795, p);
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
      this.renderer.setRenderTarget(this.sceneTarget);
      this.renderer.render(this.scene, this.camera);
      this.postQuad.material = this.blur;
      this.blur.uniforms.uMap.value = this.sceneTarget.texture;
      this.blur.uniforms.uExtract.value = 1;
      this.blur.uniforms.uStep.value.set(2.6 / this.glowA.width, 0);
      this.renderer.setRenderTarget(this.glowA);
      this.renderer.render(this.postScene, this.postCamera);
      this.blur.uniforms.uMap.value = this.glowA.texture;
      this.blur.uniforms.uExtract.value = 0;
      this.blur.uniforms.uStep.value.set(0, 2.6 / this.glowB.height);
      this.renderer.setRenderTarget(this.glowB);
      this.renderer.render(this.postScene, this.postCamera);
      this.composite.uniforms.uTime.value = time;
      this.composite.uniforms.uAura.value = smooth(.1, .16, p) * exit * (.7 + ascend * .8);
      this.postQuad.material = this.composite;
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.postScene, this.postCamera);
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
      this.postScene.clear();
      this.renderer.dispose();
      const context = this.renderer.getContext();
      if (!context.isContextLost()) context.getExtension("WEBGL_lose_context")?.loseContext();
    }
  }
  window.FateScene = FateScene;
})();
