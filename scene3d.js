/**
 * Hero 3D: процедурная сборка компьютера на three.js.
 *
 * Скрипт грузится синхронно, но сама библиотека подтягивается лениво уже после
 * первого рендера — если WebGL недоступен или пользователь просил меньше
 * движения, страница остаётся ровно такой же, как без этого файла.
 *
 * Механика: секция 01 вдвое выше экрана, внутри липкая сцена. Прогресс прокрутки
 * по «лишней» высоте сцены собирает комплектующие по порядку (корпус → плата →
 * кулер → память → БП → видеокарта → вентиляторы → панели), а прокрутка вверх
 * разбирает их тем же путём назад. Вентиляторы раскручиваются по мере сборки.
 */
(function () {
  "use strict";

  const canvas = document.getElementById("hero-canvas");
  const hero = document.getElementById("home");
  if (!canvas || !hero) return;
  const stage = hero.querySelector(".hero-stage") || hero;

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(pointer: fine)");
  const LIB = "vendor/three.min.js";

  const COMPACT = 940;

  /* Сцена рисуется поверх страницы с прозрачным фоном, поэтому палитра зависит
     от темы: в светлой аддитивное смешение и белые точки гаснут, а тёмные
     пластики превращаются в тёмные пятна. Роли материалов перекрашиваются на лету. */
  const PALETTE = {
    dark: {
      body: 0x161d18,
      bodyEmissive: 0x1d2a12,
      bodyEmissiveIntensity: 1,
      bodyEdge: 0xd8f26c,
      bodyEdgeOpacity: 0.82,
      board: 0x1e2a20,
      boardEdge: 0x8fb03c,
      chip: 0x9db8e8,
      chipEdge: 0xa8c9ff,
      chipEmissive: 0x1d3f6b,
      chipEmissiveIntensity: 0.6,
      ram: 0x22304a,
      ramEdge: 0x7ba0dd,
      psu: 0x191f1b,
      psuEdge: 0x606d5d,
      fan: 0x27322a,
      panel: 0xa8c9ff,
      panelEdge: 0xa8c9ff,
      panelEdgeOpacity: 0.3,
      panelOpacity: 0.09,
      led: 0xd8f26c,
      dust: 0xefeee7,
      dustOpacity: 0.5,
      ambient: 0x2b3527,
      ambientIntensity: 1.7,
      key: 0xd8f26c,
      keyIntensity: 1.6,
      fill: 0xa8c9ff,
      fillIntensity: 1,
    },
    light: {
      body: 0xdfe2d5,
      bodyEmissive: 0x6f8a1c,
      bodyEmissiveIntensity: 0.14,
      bodyEdge: 0x5c7410,
      bodyEdgeOpacity: 0.85,
      board: 0xcdd3bd,
      boardEdge: 0x55690c,
      chip: 0x33507f,
      chipEdge: 0x2b5ba8,
      chipEmissive: 0x2b5ba8,
      chipEmissiveIntensity: 0.16,
      ram: 0xc3ccdd,
      ramEdge: 0x2b5ba8,
      psu: 0xe3e6da,
      psuEdge: 0x6b7566,
      fan: 0xd2d7c6,
      panel: 0x2b5ba8,
      panelEdge: 0x2b5ba8,
      panelEdgeOpacity: 0.26,
      panelOpacity: 0.08,
      led: 0x6d8a15,
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

  /* Роли материалов. Ссылка вида "fill:board" красится в PALETTE[BOARD] и т.д. */
  const FILLS = {
    body: "body",
    board: "board",
    chip: "chip",
    ram: "ram",
    psu: "psu",
    fan: "fan",
  };
  const EDGES = {
    body: "bodyEdge",
    board: "boardEdge",
    chip: "chipEdge",
    ram: "ramEdge",
    psu: "psuEdge",
    fan: "bodyEdge",
  };

  const C1 = 1.70158;
  const C3 = C1 + 1;

  let reduced = motionQuery.matches;
  let THREE = null;
  let lights = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let rig = null;
  let chassis = null;
  let dust = null;
  let led = null;
  let parts = [];
  let fans = [];
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

  function mix(a, b, t) {
    return a + (b - a) * t;
  }

  /** Пружинящая кривая: деталь с лёгким перелётом и остановкой на месте. */
  function easeOutBack(t) {
    const k = t - 1;
    return 1 + C3 * k * k * k + C1 * k * k;
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

  /**
   * Плоская деталь в общем языке сцены: тонированный короб + рёбра-обводка.
   * kind — ключ роли, из него paint() берёт цвета темы.
   */
  function slab(THREE, w, h, d, kind, opts) {
    const o = opts || {};
    const group = new THREE.Group();
    const geometry = new THREE.BoxGeometry(w, h, d);

    if (!o.shell) {
      const params = {
        flatShading: true,
        metalness: o.metal === undefined ? 0.55 : o.metal,
        roughness: o.rough === undefined ? 0.44 : o.rough,
      };
      // Боковая панель — единственная полупрозрачная деталь: сквозь неё должно
      // быть видно собранное железо.
      if (kind === "panel") {
        params.transparent = true;
        params.opacity = 0.1;
        params.depthWrite = false;
        params.metalness = 0.2;
        params.roughness = 0.18;
      }
      const solid = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial(params));
      solid.material.userData.role = `fill:${kind}`;
      group.add(solid);
    }

    if (o.edges !== false) {
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ transparent: true }),
      );
      edges.material.userData.role = `edge:${kind}`;
      group.add(edges);
    }

    return group;
  }

  /** Решётка радиатора: пачка тонких рёбер, читается как кулер. */
  function heatsink(THREE, width, height, fins, depth) {
    const group = new THREE.Group();
    for (let i = 0; i < fins; i += 1) {
      const fin = slab(THREE, width, height / fins - 0.012, depth, "body", {
        edges: false,
        metal: 0.78,
        rough: 0.3,
      });
      fin.position.y = -height / 2 + (height / fins) * (i + 0.5);
      group.add(fin);
    }
    return group;
  }

  /** Вентилятор: обод, ступица и лопасти, которые крутятся при сборке.
   *  dir задаёт направление: приток и выдув в реальном корпусе вращаются вразнобой. */
  function fan(THREE, radius, dir) {
    const group = new THREE.Group();
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(radius, radius * 0.09, 6, 28),
      new THREE.MeshStandardMaterial({ flatShading: true, metalness: 0.5, roughness: 0.4 }),
    );
    rim.material.userData.role = "fill:fan";
    group.add(rim);

    const hub = slab(THREE, radius * 0.34, radius * 0.34, radius * 0.22, "fan", {
      edges: false,
    });
    group.add(hub);

    const blades = new THREE.Group();
    for (let i = 0; i < 5; i += 1) {
      const blade = slab(THREE, radius * 0.82, radius * 0.2, radius * 0.06, "fan", {
        edges: false,
        metal: 0.35,
        rough: 0.6,
      });
      const a = (i / 5) * Math.PI * 2;
      blade.position.set(Math.cos(a) * radius * 0.52, Math.sin(a) * radius * 0.52, 0);
      blade.rotation.z = a;
      blades.add(blade);
    }
    group.add(blades);
    blades.userData.dir = dir === undefined ? 1 : dir;
    group.userData.blades = blades;
    return group;
  }

  function makeChassis(THREE) {
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(2.12, 2.52, 1.82)),
      new THREE.LineBasicMaterial({ transparent: true }),
    );
    edges.material.userData.role = "edge:body";
    return edges;
  }

  function makeBoard(THREE) {
    const group = slab(THREE, 1.5, 1.52, 0.07, "board", { metal: 0.24, rough: 0.62 });

    // Слоты памяти и разъёмы PCIe — читаемые признаки платы.
    for (let i = 0; i < 4; i += 1) {
      const slot = slab(THREE, 0.028, 0.66, 0.02, "board", { edges: false, metal: 0.1 });
      slot.position.set(-0.62 + i * 0.075, 0.1, 0.05);
      group.add(slot);
    }
    const pcie = slab(THREE, 1.18, 0.05, 0.02, "board", { edges: false, metal: 0.1 });
    pcie.position.set(0.06, -0.12, 0.05);
    group.add(pcie);

    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.02, 0.02),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }),
    );
    led.material.userData.role = "led";
    led.position.set(0.1, 0.72, 0.05);
    group.add(led);
    group.userData.led = led;
    return group;
  }

  function makeCpu(THREE) {
    const group = new THREE.Group();
    const socket = slab(THREE, 0.34, 0.34, 0.08, "chip", { metal: 0.3, rough: 0.5 });
    socket.position.z = 0.04;
    group.add(socket);

    const cooler = heatsink(THREE, 0.38, 0.34, 6, 0.22);
    cooler.position.z = 0.2;
    group.add(cooler);

    // Трубка теплотвода даёт кулеру узнаваемый силуэт.
    const pipe = slab(THREE, 0.05, 0.05, 0.3, "chip", { metal: 0.8, rough: 0.24 });
    pipe.position.set(0.13, 0.13, 0.16);
    group.add(pipe);
    return group;
  }

  function makeRam(THREE) {
    const group = new THREE.Group();
    for (let i = 0; i < 4; i += 1) {
      const stick = slab(THREE, 0.045, 0.62, 0.15, "ram", { metal: 0.2, rough: 0.55 });
      stick.position.set((i - 1.5) * 0.075, 0, 0.08);
      group.add(stick);
    }
    return group;
  }

  function makeGpu(THREE) {
    const group = new THREE.Group();
    const body = slab(THREE, 1.34, 0.24, 0.5, "body", { metal: 0.5, rough: 0.4 });
    group.add(body);
    const shroud = slab(THREE, 1.1, 0.1, 0.44, "chip", { metal: 0.6, rough: 0.3 });
    shroud.position.set(-0.04, 0.12, 0.02);
    group.add(shroud);
    for (let i = 0; i < 2; i += 1) {
      const wheel = fan(THREE, 0.15, i ? 1 : -1);
      wheel.position.set(0.34 - i * 0.44, 0, 0.26);
      group.add(wheel);
    }
    return group;
  }

  function makePsu(THREE) {
    const group = slab(THREE, 0.78, 0.52, 0.66, "psu", { metal: 0.42, rough: 0.5 });
    const vent = slab(THREE, 0.5, 0.34, 0.02, "psu", { edges: false, metal: 0.1 });
    vent.position.z = 0.34;
    group.add(vent);
    return group;
  }

  function makeDust(THREE) {
    const count = window.innerWidth < COMPACT ? 380 : 820;
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

  /**
   * Описание порядка сборки. home — место детали в корпусе, out — откуда она
   * прилетает, seat/span — на каком отрезке прогресса деталь встаёт на место.
   */
  function blueprint() {
    return [
      { name: "board", build: makeBoard, home: [0, 0.04, -0.62], out: [-2.1, 0.2, -1.1], seat: 0.06, span: 0.22 },
      { name: "cpu", build: makeCpu, home: [0.08, 0.44, -0.53], out: [1.9, 1.2, 1.1], seat: 0.24, span: 0.2 },
      { name: "ram", build: makeRam, home: [-0.6, 0.06, -0.5], out: [-1.7, -1.1, 1.0], seat: 0.34, span: 0.18 },
      { name: "psu", build: makePsu, home: [-0.44, -0.94, -0.3], out: [-1.6, -1.9, -0.8], seat: 0.44, span: 0.18 },
      { name: "gpu", build: makeGpu, home: [0.04, -0.16, 0.16], out: [2.3, 0.6, 1.4], seat: 0.54, span: 0.2 },
      { name: "panel", build: (T) => slab(T, 2.02, 2.42, 0.03, "panel", { edges: false }), home: [0, 0, 0.9], out: [0.4, 0, 2.6], seat: 0.8, span: 0.18 },
    ];
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
    camera.position.set(0, 0.25, 6.9);
    camera.lookAt(0, 0, 0);
    clock = new THREE.Clock();

    const ambient = new THREE.AmbientLight(0xffffff, 1);
    const key = new THREE.PointLight(0xffffff, 1, 16);
    key.position.set(2.4, 2.6, 3.2);
    const fill = new THREE.PointLight(0xffffff, 1, 16);
    fill.position.set(-3, -2.2, 2.4);
    scene.add(ambient, key, fill);
    lights = { ambient, key, fill };

    rig = new THREE.Group();
    chassis = makeChassis(THREE);
    dust = makeDust(THREE);

    parts = blueprint().map((spec) => {
      const mesh = spec.build(THREE);
      mesh.userData = {
        name: spec.name,
        home: new THREE.Vector3().fromArray(spec.home),
        out: new THREE.Vector3().fromArray(spec.out),
        seat: spec.seat,
        span: spec.span,
        seated: 0,
      };
      mesh.traverse((node) => {
        if (node.userData && node.userData.blades) fans.push(node.userData.blades);
        if (node.userData && node.userData.led) led = node.userData.led;
      });
      rig.add(mesh);
      return mesh;
    });

    // Три вентилятора: передний приток, задний выдув, верхний обдув.
    [
      { at: [0.72, 0.74, 0.52], out: [1.5, 1.3, 1.4], dir: 1 },
      { at: [0.66, -0.42, -0.5], out: [1.4, -1.2, -1.4], dir: -1 },
      { at: [-0.2, 1.12, 0.1], out: [-0.6, 2.0, 0.8], dir: 1 },
    ].forEach((spec) => {
      const wheel = fan(THREE, 0.32, spec.dir);
      // userData дополняется, а не заменяется: в ней уже живёт blades.
      wheel.userData.name = "fan";
      wheel.userData.home = new THREE.Vector3().fromArray(spec.at);
      wheel.userData.out = new THREE.Vector3().fromArray(spec.out);
      wheel.userData.seat = 0.66;
      wheel.userData.span = 0.2;
      wheel.userData.seated = 0;
      fans.push(wheel.userData.blades);
      rig.add(wheel);
      parts.push(wheel);
    });

    scene.add(rig, dust);
    rig.add(chassis);

    paint();
    applyAssembly(0);
    bind();
    layout();
    document.documentElement.classList.add("gl-ready");
    exposeProbe();
    sync();
  }

  function sceneTheme() {
    return document.documentElement.dataset.theme === "light" ? "light" : "dark";
  }

  /** Перекрашивает все материалы сцены под текущую тему. */
  function paint() {
    if (!THREE || !rig) return;
    const pal = PALETTE[sceneTheme()];

    const walk = (root) => {
      root.traverse((node) => {
        const material = node.material;
        if (!material) return;
        const role = material.userData && material.userData.role;
        if (!role) return;

        if (role.startsWith("fill:")) {
          const kind = role.slice(5);
          if (kind === "panel") {
            material.color.setHex(pal.panel);
            material.opacity = pal.panelOpacity;
          } else {
            const key = FILLS[kind] || kind;
            if (pal[key] === undefined) return;
            material.color.setHex(pal[key]);
            if (material.emissive) {
              if (kind === "chip") {
                material.emissive.setHex(pal.chipEmissive);
                material.emissiveIntensity = pal.chipEmissiveIntensity;
              } else {
                material.emissive.setHex(pal.bodyEmissive);
                material.emissiveIntensity = pal.bodyEmissiveIntensity;
              }
            }
          }
        } else if (role.startsWith("edge:")) {
          const kind = role.slice(5);
          if (kind === "panel") {
            material.color.setHex(pal.panelEdge);
            material.opacity = pal.panelEdgeOpacity;
          } else {
            const key = EDGES[kind] || "bodyEdge";
            material.color.setHex(pal[key]);
            material.opacity = pal.bodyEdgeOpacity;
          }
        } else if (role === "led") {
          material.color.setHex(pal.led);
        }
        material.needsUpdate = true;
      });
    };

    walk(rig);
    walk(chassis);

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

  /** Ставит каждую деталь между её «п exploded» и местом в корпусе. */
  function applyAssembly(p) {
    parts.forEach((mesh) => {
      const { home, out, seat, span } = mesh.userData;
      const t = clamp((p - seat) / span, 0, 1);
      const e = easeOutBack(t);
      mesh.userData.seated = t;
      mesh.position.set(
        mix(out.x, home.x, e),
        mix(out.y, home.y, e),
        mix(out.z, home.z, e),
      );
      // Лёгкий разворот в полёте, чтобы деталь не вставала строго с места.
      mesh.rotation.set((1 - e) * 0.42, (1 - e) * -0.34, (1 - e) * 0.2);
    });

    // Корпус проявляется первым и оседает на габарит.
    const ct = easeOutBack(clamp(p / 0.16, 0, 1));
    const scale = mix(1.16, 1, ct);
    chassis.scale.setScalar(scale);
    chassis.material.opacity = clamp(ct, 0, 1) * 0.9;

    if (led) led.material.opacity = clamp((p - 0.86) / 0.14, 0, 1) * 0.85;
  }

  function layout() {
    if (!renderer) return;
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    const compact = width < COMPACT;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.35 : 1.75));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    rig.scale.setScalar(compact ? 0.82 : 0.92);
    rig.position.set(compact ? 0 : Math.min(width / 900, 2.3), compact ? 0.7 : 0.2, 0);
  }

  function frame() {
    frameId = window.requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;

    look.x += (look.tx - look.x) * 0.055;
    look.y += (look.ty - look.y) * 0.055;

    rig.rotation.y += 0.0021 + spin.vy;
    rig.rotation.x = clamp(rig.rotation.x + spin.vx, -0.5, 0.5);
    spin.vx *= 0.93;
    spin.vy *= 0.93;

    // Вентиляторы раскручиваются по мере того, как сборка приближается к концу.
    const power = clamp((scrollP - 0.7) / 0.3, 0, 1);
    fans.forEach((blades) => {
      blades.rotation.z += dt * (0.4 + power * 7.5) * (blades.userData.dir || 1);
    });

    dust.rotation.y += dt * 0.014;

    camera.position.x = look.x * 0.5;
    camera.position.y = 0.25 - look.y * 0.36;
    camera.position.z = 6.9 + scrollP * 0.5;
    camera.lookAt(rig.position.x * 0.5, 0, 0);

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
    stage.classList.add("is-grabbing");
  }

  function onPointerUp() {
    spin.dragging = false;
    stage.classList.remove("is-grabbing");
  }

  /**
   * Прогресс идёт по «лишней» высоте секции: липкая сцена неподвижна, поэтому
   * 0 — это верх героя, 1 — момент, когда сцена отлипает и уезжает вверх.
   */
  function onScroll() {
    const span = Math.max(hero.offsetHeight - stage.offsetHeight, 1);
    scrollP = clamp(-hero.getBoundingClientRect().top / span, 0, 1);
    applyAssembly(scrollP);
  }

  function bind() {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    stage.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", layout);
    window.addEventListener("themechange", paint);
    document.addEventListener("visibilitychange", sync);

    if ("IntersectionObserver" in window) {
      // Наблюдаем сцену, а не секцию: как только она отлипла, цикл можно глушить.
      new IntersectionObserver(
        (entries) => {
          inView = entries[0].isIntersecting;
          sync();
        },
        { threshold: 0 },
      ).observe(stage);
    }

    const onMotionChange = () => {
      reduced = motionQuery.matches;
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

  /** Точка входа для проверочного прогона: включается только ?pcdebug. */
  function exposeProbe() {
    if (!new URLSearchParams(window.location.search).has("pcdebug")) return;
    window.__heroPC = {
      progress: () => scrollP,
      parts: () =>
        parts.map((mesh) => ({
          name: mesh.userData.name,
          seated: +mesh.userData.seated.toFixed(3),
          pos: mesh.position.toArray().map((v) => +v.toFixed(3)),
        })),
    };
  }

  function start() {
    const begin = () => loadLib();
    if (document.readyState === "complete") begin();
    else window.addEventListener("load", begin, { once: true });
  }

  start();
})();
