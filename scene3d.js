/**
 * Hero 3D: процедурные модели на three.js.
 *
 * Скрипт грузится синхронно, но сама библиотека подтягивается лениво уже после
 * первого рендера — если WebGL недоступен или пользователь просил меньше
 * движения, страница остаётся ровно такой же, как без этого файла.
 *
 * Всё движение считается в единицах «в секунду» и домножается на реальный dt,
 * поэтому сцена одинаково плавная на 30, 60 и 144 Гц. Качество рендера
 * подстраивается под реальную стоимость кадра: если кадр не укладывается в
 * бюджет, буфер уменьшается, а не рвётся анимация.
 */
(function () {
  "use strict";

  const canvas = document.getElementById("hero-canvas");
  const hero = document.getElementById("home");
  if (!canvas || !hero) return;

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(pointer: fine)");
  const LIB = "vendor/three.min.js";

  const LIME = 0xd8f26c;
  const BLUE = 0xa8c9ff;
  const PAPER = 0xefeee7;
  const COMPACT = 940;

  // Скорости в секунду, а не в кадр.
  const RIG_SPIN = 0.144; // рад/с — как было 0.0024 за кадр на 60 Гц
  const CORE_Y = -0.16;
  const CORE_X = 0.07;
  const SHELL_Y = -0.13;
  const SHELL_X = 0.05;
  const DUST_Y = 0.014;
  const LOOK_RATE = 3.4; // скорость догоняющая за курсором
  const SPIN_DAMP = 4.3; // затухание инерции вращения
  const SCALE_LADDER = [1, 0.85, 0.7, 0.55, 0.45, 0.35];

  let reduced = motionQuery.matches;
  let renderer = null;
  let scene = null;
  let camera = null;
  let rig = null;
  let core = null;
  let shell = null;
  let dust = null;
  let satellites = [];
  let frameId = 0;
  let running = false;
  let inView = true;
  let lost = false;
  let last = 0;
  let elapsed = 0;

  // Геометрия берётся из кеша один раз, а не перечитывается на каждом кадре.
  let boxW = 0;
  let boxH = 0;
  let span = 1;
  let layoutQueued = 0;

  // Адаптивное качество. Меряем реальный интервал кадров, а не время вызова
  // render(): GPU считает асинхронно, поэтому вокруг render() всегда быстро.
  // floor — лучший интервал за сессию, то есть частота самого экрана.
  let floor = 0;
  let avg = 0;
  let rung = 0;
  let cooldownMs = 0;
  let warmMs = 0;
  let warmFrames = 0;

  const look = { x: 0, y: 0, tx: 0, ty: 0 };
  const spin = { vx: 0, vy: 0, dragging: false, px: 0, py: 0, dx: 0, dy: 0 };
  const interactive = "a, button, input, textarea, select, [role='button']";
  let scratch = null;

  function degrade() {
    document.documentElement.classList.add("no-gl");
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  /** Кадронезависимое сглаживание: одинаково быстро на любом FPS. */
  function approach(current, target, rate, dt) {
    return current + (target - current) * (1 - Math.exp(-rate * dt));
  }

  function loadLib() {
    if (!window.WebGLRenderingContext) {
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
        color: 0x1a211c,
        flatShading: true,
        metalness: 0.72,
        roughness: 0.34,
        emissive: 0x1d2a12,
        emissiveIntensity: 1,
      }),
    );
    group.add(solid);

    // Рёбра — ребёнок группы, собственного вращения не имеют: каркас обязан
    // совпадать с гранями тела, иначе он «едет» по поверхности.
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 1),
      new THREE.LineBasicMaterial({
        color: LIME,
        transparent: true,
        opacity: 0.85,
      }),
    );
    group.add(edges);

    return group;
  }

  function makeShell(THREE) {
    return new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.78, 1), 1),
      new THREE.LineBasicMaterial({
        color: BLUE,
        transparent: true,
        opacity: 0.26,
      }),
    );
  }

  function makeRings(THREE) {
    const group = new THREE.Group();
    const specs = [
      { radius: 2.16, tube: 0.007, color: LIME, opacity: 0.55, tilt: 1.24, spin: 0.22 },
      { radius: 2.62, tube: 0.005, color: BLUE, opacity: 0.34, tilt: -0.72, spin: -0.15 },
    ];
    specs.forEach((spec) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(spec.radius, spec.tube, 6, 160),
        new THREE.MeshBasicMaterial({
          color: spec.color,
          transparent: true,
          opacity: spec.opacity,
          depthWrite: false,
        }),
      );
      ring.rotation.x = spec.tilt;
      ring.userData.spin = spec.spin;
      group.add(ring);
    });
    return group;
  }

  function makeSatellites(THREE) {
    const geometry = new THREE.OctahedronGeometry(0.1, 0);
    const specs = [
      { radius: 1.62, speed: 0.55, phase: 0.4, y: 0.42, color: LIME },
      { radius: 2.34, speed: -0.34, phase: 2.6, y: -0.58, color: PAPER },
      { radius: 2.86, speed: 0.22, phase: 4.4, y: 0.24, color: BLUE },
    ];
    return specs.map((spec) => {
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color: spec.color,
          flatShading: true,
          metalness: 0.4,
          roughness: 0.3,
          emissive: spec.color,
          emissiveIntensity: 0.18,
        }),
      );
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
        color: PAPER,
        size: 0.032,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
  }

  function build() {
    const THREE = window.THREE;
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

    scratch = new THREE.Vector3();
    renderer.setClearAlpha(0);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.25, 6.4);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0x2b3527, 1.6));
    const key = new THREE.PointLight(LIME, 1.5, 14);
    key.position.set(2.4, 2.6, 3.2);
    scene.add(key);
    const fill = new THREE.PointLight(BLUE, 0.9, 14);
    fill.position.set(-3, -2.2, 2.4);
    scene.add(fill);

    rig = new THREE.Group();
    core = makeCore(THREE);
    shell = makeShell(THREE);
    const rings = makeRings(THREE);
    dust = makeDust(THREE);
    satellites = makeSatellites(THREE);

    rig.add(core, shell, rings);
    satellites.forEach((mesh) => rig.add(mesh));
    scene.add(rig, dust);

    bind();
    measure();
    applyLayout();
    document.documentElement.classList.add("gl-ready");
    sync();
  }

  /** Единственное место, где читается геометрия hero. */
  function measure() {
    boxW = hero.clientWidth;
    boxH = hero.clientHeight;
    span = boxH || 1;
  }

  /** Буфер по качеству: чем дороже кадр, тем меньше пикселей. */
  function applyResolution() {
    if (!renderer) return;
    const cap = boxW < COMPACT ? 1.35 : 1.75;
    const ratio = clamp((window.devicePixelRatio || 1) * SCALE_LADDER[rung], 0.55, cap);
    renderer.setPixelRatio(ratio);
    renderer.setSize(boxW, boxH, false);
  }

  /** Пересчёт на resize: не чаще одного кадра и только при реальной смене размера. */
  function applyLayout() {
    layoutQueued = 0;
    measure();
    applyResolution();
    if (!boxW || !boxH) return;
    const compact = boxW < COMPACT;
    camera.aspect = boxW / boxH;
    camera.updateProjectionMatrix();
    rig.scale.setScalar(compact ? 0.86 : 0.95);
    rig.position.set(compact ? 0.1 : Math.min(boxW / 820, 2.15), compact ? 1.05 : 0.32, 0);
    if (shell) shell.visible = !reduced;
  }

  function layout() {
    if (layoutQueued) return;
    layoutQueued = window.requestAnimationFrame(applyLayout);
  }

  /** Подстройка качества под реальные пропуски кадров. */
  function adapt(ms) {
    /* Мусорные интервалы (вкладка была свёрнута, первый кадр) в оценку частоты
       не идут. */
    if (!(ms > 0) || ms > 2000) return;
    if (!avg) avg = ms;
    else avg += (ms - avg) * 0.08;
    /* Порог 3 мс отсекает 300+ Гц: floor должен отражать частоту экрана, а не
       удвоенный вызов rAF. */
    if (ms > 3 && (!floor || ms < floor)) floor = ms;
    /* Первые кадры ничего не знают о стоимости рендера: компиляция шейдеров и
       первая отрисовка всегда дороже. Ждём 600 мс, а не N кадров: на слабой
       машине 30 кадров — это полторы минуты впустую, а 600 мс — всегда меньше
       секунды независимо от частоты. */
    warmMs += ms;
    warmFrames += 1;
    if (warmMs < 600 || warmFrames < 6) return;
    if (cooldownMs > 0) {
      cooldownMs -= ms;
      return;
    }
    if (!floor) return;

    const last = SCALE_LADDER.length - 1;
    /* Понижать разрешение, а не пропускать кадры: пропуск глаз видит сразу,
       мягкая картинка — нет. */
    const slow = avg > floor * 1.55 || avg > 40;
    const fast = avg < floor * 1.18 && avg < 26;

    /* Пауза между ступенями тоже по времени: 45 кадров на слабой машине — это
       минуты, за которые лестница не успевает помочь. */
    if (slow && rung < last) {
      rung += 1;
      cooldownMs = 700; // вниз быстро: тяжёлый кадр виден сразу
    } else if (fast && rung > 0) {
      rung -= 1;
      cooldownMs = 2000; // вверх осторожно: лучше мягкая картинка, чем лаги
    } else {
      return;
    }
    applyResolution();
  }

  function frame(now) {
    frameId = window.requestAnimationFrame(frame);
    /* raw — настоящий интервал кадра, dt — обрезанный для физики. Оценке
       стоимости рендера нужен raw: обрезанный dt не отличит 50 мс от 500 мс и
       на тяжёлой сцене лестница решит, что кадры «нормальные». */
    const raw = last ? now - last : 16.7;
    const dt = last ? clamp((now - last) / 1000, 0, 0.05) : 0.016;
    last = now;
    elapsed += dt;

    look.x = approach(look.x, look.tx, LOOK_RATE, dt);
    look.y = approach(look.y, look.ty, LOOK_RATE, dt);

    // Инерция мыши: события копятся, скорость гасится за секунду, а не за кадр.
    if (spin.dx || spin.dy) {
      spin.vy = clamp(spin.vy + spin.dx * 0.0045, -0.09, 0.09);
      spin.vx = clamp(spin.vx + spin.dy * 0.0032, -0.06, 0.06);
      spin.dx = 0;
      spin.dy = 0;
    }
    const damp = Math.exp(-SPIN_DAMP * dt);
    spin.vx *= damp;
    spin.vy *= damp;

    rig.rotation.y += (RIG_SPIN + spin.vy) * dt;
    rig.rotation.x = clamp(rig.rotation.x + spin.vx * dt, -0.55, 0.55);

    core.rotation.y += CORE_Y * dt;
    core.rotation.x += CORE_X * dt;

    if (shell) {
      shell.rotation.y += SHELL_Y * dt;
      shell.rotation.x += SHELL_X * dt;
    }

    for (let i = 0; i < 3; i += 1) {
      const mesh = satellites[i];
      const spec = mesh.userData;
      const angle = elapsed * spec.speed + spec.phase;
      mesh.position.set(
        Math.cos(angle) * spec.radius,
        spec.y + Math.sin(angle * 1.7) * 0.12,
        Math.sin(angle) * spec.radius * 0.72,
      );
      mesh.rotation.x += 0.6 * dt;
      mesh.rotation.y += 0.8 * dt;
    }

    for (let i = 0; i < rig.children.length; i += 1) {
      const child = rig.children[i];
      if (child.userData && child.userData.spin) child.rotation.z += child.userData.spin * dt;
    }

    dust.rotation.y += DUST_Y * dt;

    const p = clamp(window.scrollY / span, 0, 1);
    camera.position.x = look.x * 0.55;
    camera.position.y = 0.25 - look.y * 0.4;
    camera.position.z = 6.4 + p * 1.5;
    camera.lookAt(scratch.set(rig.position.x * 0.55, 0, 0));

    renderer.render(scene, camera);
    adapt(raw);
  }

  function sync() {
    const should = !reduced && inView && !document.hidden && !lost;
    // Пока сцена жива, верхняя панель не должна пересчитывать backdrop-blur
    // поверх перерисовываемого канваса — это съедает кадр.
    document.documentElement.classList.toggle("gl-live", should);
    if (should && !running) {
      running = true;
      last = 0;
      avg = 0;
      floor = 0;
      warmMs = 0;
      warmFrames = 0;
      frameId = window.requestAnimationFrame(frame);
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
    spin.dx += event.clientX - spin.px;
    spin.dy += event.clientY - spin.py;
    spin.px = event.clientX;
    spin.py = event.clientY;
  }

  function onPointerDown(event) {
    if (reduced || event.target.closest(interactive)) return;
    spin.dragging = true;
    spin.px = event.clientX;
    spin.py = event.clientY;
    spin.dx = 0;
    spin.dy = 0;
    hero.classList.add("is-grabbing");
  }

  function onPointerUp() {
    spin.dragging = false;
    spin.dx = 0;
    spin.dy = 0;
    hero.classList.remove("is-grabbing");
  }

  function onContextLost(event) {
    event.preventDefault();
    lost = true;
    sync();
  }

  function onContextRestored() {
    lost = false;
    layout();
    sync();
  }

  function bind() {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    hero.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    window.addEventListener("resize", layout);
    window.addEventListener("orientationchange", layout);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pagehide", sync);
    canvas.addEventListener("webglcontextlost", onContextLost, false);
    canvas.addEventListener("webglcontextrestored", onContextRestored, false);

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
  }

  function start() {
    const begin = () => loadLib();
    if (document.readyState === "complete") begin();
    else window.addEventListener("load", begin, { once: true });
  }

  /* Проба для проверок — только по ?pcdebug, на обычной странице её нет.
     Углы в радианах: ry держится в пределах ±pi/2, поэтому сравнивать надо
     именно его, а не ryPerSec. */
  if (new URLSearchParams(window.location.search).has("pcdebug")) {
    window.__heroPC = {
      motion: () => ({
        ry: rig ? rig.rotation.y : 0,
        rx: rig ? rig.rotation.x : 0,
        core: core ? core.rotation.y : 0,
        look: [look.x, look.y],
        vy: spin.vy,
        vx: spin.vx,
        dragging: spin.dragging,
        dpr: renderer ? renderer.getPixelRatio() : 0,
        running,
        rung,
        avg: +avg.toFixed(2),
        floor: +floor.toFixed(2),
      }),
    };
  }

  start();
})();
