/**
 * Hero 3D: процедурные модели на three.js.
 *
 * Скрипт грузится синхронно, но сама библиотека подтягивается лениво уже после
 * первого рендера — если WebGL недоступен или пользователь просил меньше
 * движения, страница остаётся ровно такой же, как без этого файла.
 */
(function () {
  "use strict";

  const canvas = document.getElementById("hero-canvas");
  const hero = document.getElementById("home");
  if (!canvas || !hero) return;

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(pointer: fine)");
  const LIB = "vendor/three.min.js";

  const COMPACT = 940;

  /* Сцена рисуется поверх страницы с прозрачным фоном, поэтому палитра зависит
     от темы: в светлой аддитивное смешение и белые точки гаснут, а тёмное ядро
     превращается в тёмное пятно. Роли материалов перекрашиваются на лету. */
  const PALETTE = {
    dark: {
      solid: 0x1a211c,
      solidEmissive: 0x1d2a12,
      solidEmissiveIntensity: 1,
      edges: 0xd8f26c,
      edgesOpacity: 0.85,
      shell: 0xa8c9ff,
      shellOpacity: 0.26,
      ringA: 0xd8f26c,
      ringB: 0xa8c9ff,
      sat: [0xd8f26c, 0xefeee7, 0xa8c9ff],
      satEmissive: 0.18,
      dust: 0xefeee7,
      dustOpacity: 0.5,
      ambient: 0x2b3527,
      ambientIntensity: 1.6,
      key: 0xd8f26c,
      keyIntensity: 1.5,
      fill: 0xa8c9ff,
      fillIntensity: 0.9,
    },
    light: {
      solid: 0xe9ebe0,
      solidEmissive: 0x6f8a1c,
      solidEmissiveIntensity: 0.16,
      edges: 0x5c7410,
      edgesOpacity: 0.9,
      shell: 0x2b5ba8,
      shellOpacity: 0.3,
      ringA: 0x6d8a15,
      ringB: 0x2b5ba8,
      sat: [0x5c7410, 0x2a2d24, 0x2b5ba8],
      satEmissive: 0.08,
      dust: 0x4f554b,
      dustOpacity: 0.38,
      ambient: 0xf4f6ec,
      ambientIntensity: 2.2,
      key: 0xfff6dd,
      keyIntensity: 1.9,
      fill: 0xd3e2ff,
      fillIntensity: 1.1,
    },
  };

  let reduced = motionQuery.matches;
  let THREE = null;
  let lights = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let rig = null;
  let core = null;
  let shell = null;
  let dust = null;
  let satellites = [];
  let clock = null;
  let frameId = 0;
  let running = false;
  let inView = true;
  let scrollP = 0;

  const look = { x: 0, y: 0, tx: 0, ty: 0 };
  const spin = { vx: 0, vy: 0, dragging: false, px: 0, py: 0 };
  const interactive = "a, button, input, textarea, select, [role='button']";

  function degrade() {
    document.documentElement.classList.add("no-gl");
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function loadLib() {
    if (reduced || !window.WebGLRenderingContext) {
      degrade();
      return;
    }
    const script = document.createElement("script");
    script.src = LIB;
    script.async = true;
    script.addEventListener("load", () => {
      if (window.THREE) build();
      else degrade();
    });
    script.addEventListener("error", degrade);
    document.head.appendChild(script);
  }

  function makeCore(THREE) {
    const group = new THREE.Group();
    const geometry = new THREE.IcosahedronGeometry(1.2, 1);

    const solid = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        flatShading: true,
        metalness: 0.72,
        roughness: 0.34,
      }),
    );
    solid.material.userData.role = "solid";
    group.add(solid);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 1),
      new THREE.LineBasicMaterial({ transparent: true }),
    );
    edges.material.userData.role = "edges";
    group.add(edges);
    group.userData.edges = edges;

    return group;
  }

  function makeShell(THREE) {
    const shell = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.78, 1), 1),
      new THREE.LineBasicMaterial({ transparent: true }),
    );
    shell.material.userData.role = "shell";
    return shell;
  }

  function makeRings(THREE) {
    const group = new THREE.Group();
    const specs = [
      { radius: 2.16, tube: 0.007, opacity: 0.55, tilt: 1.24, spin: 0.22 },
      { radius: 2.62, tube: 0.005, opacity: 0.34, tilt: -0.72, spin: -0.15 },
    ];
    specs.forEach((spec, index) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(spec.radius, spec.tube, 6, 160),
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: spec.opacity,
          depthWrite: false,
        }),
      );
      ring.material.userData.role = `ring${index}`;
      ring.rotation.x = spec.tilt;
      ring.userData.spin = spec.spin;
      group.add(ring);
    });
    return group;
  }

  function makeSatellites(THREE) {
    const geometry = new THREE.OctahedronGeometry(0.1, 0);
    const specs = [
      { radius: 1.62, speed: 0.55, phase: 0.4, y: 0.42 },
      { radius: 2.34, speed: -0.34, phase: 2.6, y: -0.58 },
      { radius: 2.86, speed: 0.22, phase: 4.4, y: 0.24 },
    ];
    return specs.map((spec, index) => {
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          flatShading: true,
          metalness: 0.4,
          roughness: 0.3,
        }),
      );
      mesh.material.userData.role = `sat${index}`;
      mesh.userData = spec;
      return mesh;
    });
  }

  function makeDust(THREE) {
    const count = window.innerWidth < COMPACT ? 420 : 900;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const radius = 3.1 + Math.random() * 4.4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.55;
      positions[i * 3 + 2] = radius * Math.cos(phi);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: 0.032,
        sizeAttenuation: true,
        transparent: true,
        depthWrite: false,
      }),
    );
  }

  function sceneTheme() {
    return document.documentElement.dataset.theme === "light" ? "light" : "dark";
  }

  /** Перекрашивает все материалы сцены под текущую тему. */
  function paint() {
    if (!THREE || !rig) return;
    const pal = PALETTE[sceneTheme()];

    rig.traverse((node) => {
      const material = node.material;
      if (!material) return;
      const role = material.userData && material.userData.role;
      switch (role) {
        case "solid":
          material.color.setHex(pal.solid);
          material.emissive.setHex(pal.solidEmissive);
          material.emissiveIntensity = pal.solidEmissiveIntensity;
          break;
        case "edges":
          material.color.setHex(pal.edges);
          material.opacity = pal.edgesOpacity;
          break;
        case "shell":
          material.color.setHex(pal.shell);
          material.opacity = pal.shellOpacity;
          break;
        case "ring0":
          material.color.setHex(pal.ringA);
          break;
        case "ring1":
          material.color.setHex(pal.ringB);
          break;
        case "sat0":
        case "sat1":
        case "sat2": {
          const index = Number(role.slice(3));
          material.color.setHex(pal.sat[index]);
          material.emissive.setHex(pal.sat[index]);
          material.emissiveIntensity = pal.satEmissive;
          break;
        }
        default:
          break;
      }
      material.needsUpdate = true;
    });

    if (dust) {
      const material = dust.material;
      material.color.setHex(pal.dust);
      material.opacity = pal.dustOpacity;
      // Аддитивное смешение на светлом фоне выбеливает точки в ноль.
      material.blending =
        sceneTheme() === "light" ? THREE.NormalBlending : THREE.AdditiveBlending;
      material.needsUpdate = true;
    }

    if (lights) {
      lights.ambient.color.setHex(pal.ambient);
      lights.ambient.intensity = pal.ambientIntensity;
      lights.key.color.setHex(pal.key);
      lights.key.intensity = pal.keyIntensity;
      lights.fill.color.setHex(pal.fill);
      lights.fill.intensity = pal.fillIntensity;
    }
  }

  function build() {
    THREE = window.THREE;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch (error) {
      void error;
      degrade();
      return;
    }
    if (!renderer.getContext()) {
      degrade();
      return;
    }

    renderer.setClearAlpha(0);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.25, 6.4);
    camera.lookAt(0, 0, 0);
    clock = new THREE.Clock();

    const ambient = new THREE.AmbientLight(0xffffff, 1);
    const key = new THREE.PointLight(0xffffff, 1, 14);
    key.position.set(2.4, 2.6, 3.2);
    const fill = new THREE.PointLight(0xffffff, 1, 14);
    fill.position.set(-3, -2.2, 2.4);
    scene.add(ambient, key, fill);
    lights = { ambient, key, fill };

    rig = new THREE.Group();
    core = makeCore(THREE);
    shell = makeShell(THREE);
    const rings = makeRings(THREE);
    dust = makeDust(THREE);
    satellites = makeSatellites(THREE);

    rig.add(core, shell, rings);
    satellites.forEach((mesh) => rig.add(mesh));
    scene.add(rig, dust);

    if (reduced) shell.visible = false;

    paint();
    bind();
    layout();
    document.documentElement.classList.add("gl-ready");
    sync();
  }

  function layout() {
    if (!renderer) return;
    const width = hero.clientWidth;
    const height = hero.clientHeight;
    const compact = width < COMPACT;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.35 : 1.75));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    rig.scale.setScalar(compact ? 0.86 : 0.95);
    rig.position.set(compact ? 0.1 : Math.min(width / 820, 2.15), compact ? 1.05 : 0.32, 0);
    if (shell) shell.visible = !reduced;
  }

  function frame() {
    frameId = window.requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;

    look.x += (look.tx - look.x) * 0.055;
    look.y += (look.ty - look.y) * 0.055;

    rig.rotation.y += 0.0024 + spin.vy;
    rig.rotation.x = clamp(rig.rotation.x + spin.vx, -0.55, 0.55);
    spin.vx *= 0.93;
    spin.vy *= 0.93;

    core.rotation.y -= dt * 0.16;
    core.rotation.x += dt * 0.07;
    core.userData.edges.rotation.copy(core.rotation);

    if (shell) {
      shell.rotation.y -= dt * 0.13;
      shell.rotation.x += dt * 0.05;
    }

    rig.children.forEach((child) => {
      if (child.userData && child.userData.spin) child.rotation.z += dt * child.userData.spin;
    });

    satellites.forEach((mesh) => {
      const { radius, speed, phase, y } = mesh.userData;
      const angle = time * speed + phase;
      mesh.position.set(Math.cos(angle) * radius, y + Math.sin(angle * 1.7) * 0.12, Math.sin(angle) * radius * 0.72);
      mesh.rotation.x += dt * 0.6;
      mesh.rotation.y += dt * 0.8;
    });

    dust.rotation.y += dt * 0.014;

    camera.position.x = look.x * 0.55;
    camera.position.y = 0.25 - look.y * 0.4;
    camera.position.z = 6.4 + scrollP * 1.5;
    camera.lookAt(rig.position.x * 0.55, 0, 0);

    renderer.render(scene, camera);
  }

  function sync() {
    const should = !reduced && inView && !document.hidden;
    if (should && !running) {
      running = true;
      clock.getDelta();
      frame();
    } else if (!should && running) {
      running = false;
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    }
  }

  function onPointerMove(event) {
    if (event.pointerType && event.pointerType !== "mouse") return;
    look.tx = (event.clientX / window.innerWidth - 0.5) * 2;
    look.ty = (event.clientY / window.innerHeight - 0.5) * 2;

    if (!spin.dragging) return;
    const dx = event.clientX - spin.px;
    const dy = event.clientY - spin.py;
    spin.px = event.clientX;
    spin.py = event.clientY;
    spin.vy = clamp(spin.vy + dx * 0.0045, -0.09, 0.09);
    spin.vx = clamp(spin.vx + dy * 0.0032, -0.06, 0.06);
  }

  function onPointerDown(event) {
    if (reduced || event.target.closest(interactive)) return;
    spin.dragging = true;
    spin.px = event.clientX;
    spin.py = event.clientY;
    hero.classList.add("is-grabbing");
  }

  function onPointerUp() {
    spin.dragging = false;
    hero.classList.remove("is-grabbing");
  }

  function onScroll() {
    if (!hero) return;
    const span = hero.offsetHeight || 1;
    scrollP = clamp(window.scrollY / span, 0, 1);
  }

  function bind() {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    hero.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", layout);
    window.addEventListener("themechange", paint);
    document.addEventListener("visibilitychange", sync);

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        (entries) => {
          inView = entries[0].isIntersecting;
          sync();
        },
        { threshold: 0 },
      ).observe(hero);
    }

    const onMotionChange = () => {
      reduced = motionQuery.matches;
      if (shell) shell.visible = !reduced;
      sync();
    };
    if (typeof motionQuery.addEventListener === "function") {
      motionQuery.addEventListener("change", onMotionChange);
    }

    finePointer.addEventListener?.("change", () => {
      look.tx = 0;
      look.ty = 0;
    });

    onScroll();
  }

  function start() {
    const begin = () => loadLib();
    if (document.readyState === "complete") begin();
    else window.addEventListener("load", begin, { once: true });
  }

  start();
})();
