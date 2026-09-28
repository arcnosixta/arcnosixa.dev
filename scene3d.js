/**
 * Hero 3D: процедурная сборка компьютера на three.js.
 *
 * Библиотека подтягивается лениво уже после первого рендера. Если WebGL
 * недоступен или пользователь просил меньше движения, страница остаётся ровно
 * такой же, как без этого файла.
 *
 * Геометрия строится в миллиметрах по реальным размерам комплектующих, и уже
 * готовая сборка масштабируется в единицы сцены:
 *
 *   материнка ATX   305 x 244 x 1.6 мм, окно I/O 158.75 x 44.45 мм,
 *                   шаг слотов расширения 20.32 мм, 7 отсеков
 *   БП ATX         140 x 86 x 150 мм, вентилятор 120 мм, разъёмный модуль
 *   кулер NH-D15   башни 45 мм, 6 теплотрубок, 24 ребра,
 *                   вентиляторы 140 мм спереди и 120 мм между башнями
 *   память         DIMM 133.35 x 31.25 x 1.27 мм, 4 модуля
 *   видеокарта     304 x 137 x 61 мм, 3 слота, 2 осевых вентилятора
 *   корпус         450 x 460 x 214 мм, 3 x 120 мм спереди, 1 x 120 мм сзади
 *
 * Механика: секция 01 вдвое выше экрана, внутри липкая сцена. Прогресс прокрутки
 * по «лишней» высоте сцены собирает систему по порядку (корпус → БП → плата →
 * процессор → кулер → память → видеокарта → вентиляторы → провода → панели), а
 * прокрутка вверх разбирает её тем же путём назад.
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
  const interactive = "a, button, input, textarea, select, [role='button']";
  const COMPACT = 940;

  const MM = 0.0024;

  const CASE = { d: 450, h: 460, w: 214 };
  const MID_X = -225;
  const FRONT_X = 225;
  const MID_Z = CASE.w / 2;
  const BOARD_Z = 7.2;

  const SURFACES = {
    shell:  { dark: [0x17191d, 0.40, 0.55], light: [0xeceef0, 0.42, 0.30] },
    frame:  { dark: [0x101216, 0.52, 0.72], light: [0xdbdde1, 0.50, 0.60] },
    steel:  { dark: [0x8d939a, 0.30, 1.00], light: [0xbcc1c6, 0.28, 1.00] },
    alu:    { dark: [0x767c84, 0.34, 1.00], light: [0xa9afb6, 0.32, 1.00] },
    copper: { dark: [0xc07a46, 0.26, 1.00], light: [0xc07a46, 0.26, 1.00] },
    gold:   { dark: [0xd6b052, 0.30, 1.00], light: [0xd6b052, 0.30, 1.00] },
    plastic:{ dark: [0x1a1d21, 0.46, 0.05], light: [0xf1f2f4, 0.44, 0.05] },
    black:  { dark: [0x0c0e11, 0.54, 0.10], light: [0x191b1f, 0.54, 0.10] },
    rubber: { dark: [0x0a0b0c, 0.92, 0.00], light: [0x0a0b0c, 0.92, 0.00] },
    ram:    { dark: [0x23272e, 0.40, 0.55], light: [0x2a2e36, 0.40, 0.55] },
    pcb:    { dark: [0x0a1a13, 0.56, 0.10], light: [0x0a1a13, 0.56, 0.10] },
    slot:   { dark: [0x0d1014, 0.62, 0.05], light: [0x0d1014, 0.62, 0.05] },
    glass:  { dark: [0x9fc4e2, 0.06, 0.00], light: [0xcadfee, 0.06, 0.00] },
  };

  const GLOWS = {
    led: { dark: 0xd8f26c, light: 0x8fb01c },
    rgb: { dark: 0x7fd0ff, light: 0x4f9ad4 },
  };

  const LIGHTS = {
    dark: {
      key: [0xf4f7ff, 2.6, -420, 520, 700],
      rim: [0x8fd4ff, 2.4, 620, 240, -420],
      fill: [0xd8f26c, 1.0, 300, -360, 420],
      inner: [0xd8f26c, 1.6, -40, 250, 150],
      env: 0.55,
      exposure: 1.0,
      dust: [0xefeede, 0.34],
    },
    light: {
      key: [0xfff8ec, 2.7, -420, 560, 700],
      rim: [0xd6e6ff, 1.7, 620, 260, -380],
      fill: [0xffffff, 0.9, 300, -300, 460],
      inner: [0x9ec22a, 0.7, -40, 250, 150],
      env: 0.95,
      exposure: 1.05,
      dust: [0x6a7060, 0.2],
    },
  };

  const SEATS = [
    ["case", 0.0, 0.1], ["psu", 0.08, 0.11], ["board", 0.17, 0.12],
    ["cpu", 0.26, 0.09], ["cooler", 0.31, 0.15], ["ram", 0.42, 0.13],
    ["gpu", 0.52, 0.14], ["fanFront", 0.62, 0.12], ["fanBack", 0.7, 0.1],
    ["fanTop", 0.74, 0.1], ["cables", 0.78, 0.1], ["panels", 0.85, 0.15],
  ];

  const OUT = {
    case: [0, 330, 0],
    psu: [0, -330, 0],
    board: [-420, 70, 0],
    cpu: [0, 330, 70],
    cooler: [0, 440, 0],
    ram: [330, 0, 150],
    gpu: [470, -90, 0],
    fanFront: [370, 0, 0],
    fanBack: [-370, 0, 0],
    fanTop: [0, 370, 0],
    cables: [0, 0, 330],
    panels: [0, 0, 450],
  };

  const C1 = 1.70158;

  /* Движение в секунду, а не в кадр. Иначе на 30 Гц риг проворачивает вдвое
     меньший угол, чем на 60 Гц, слои расходятся по скорости и картинка
     дёргается. Сглаживание — тоже по времени: 1 - exp(-rate * dt). */
  const RIG_SPIN = 0.09; // рад/с, было 0.0015 за кадр на 60 Гц
  const LOOK_RATE = 3.4; // скорость догоняющая за курсором
  const SPIN_DAMP = 4.3; // затухание инерции вращения
  const SCALE_LADDER = [1, 0.85, 0.7, 0.55, 0.45, 0.35];

  let reduced = motionQuery.matches;
  let THREE = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let rig = null;
  let world = null;
  let dust = null;
  let envRT = null;
  let lights = null;
  let mats = {};
  let fans = [];
  let parts = [];
  let leds = [];
  let spin = { vx: 0, vy: 0, drag: false, px: 0, py: 0, dx: 0, dy: 0 };
  let look = { x: 0, y: 0, tx: 0, ty: 0 };
  let scrollP = 0;
  let inView = true;
  let running = false;
  let lastT = 0;
  let raf = 0;

  /* Геометрия hero кешируется: раньше offsetHeight и getBoundingClientRect()
     читались на каждом событии прокрутки и каждом движении мыши, то есть
     браузер пересчитывал раскладку десятки раз в секунду. */
  let stageW = 0;
  let stageH = 0;
  let stageRect = { left: 0, top: 0 };
  let heroTop = 0;
  let span = 1;
  let layoutQueued = 0;
  let scrollDirty = false;

  /* Адаптивное качество. Смотрим на реальные интервалы кадров, а не на время
     вызова render(): GPU считает асинхронно, и вокруг render() всегда быстро.
     floor — лучший интервал за сессию, то есть частота самого экрана. */
  let floor = 0;
  let avg = 0;
  let rung = 0;
  let cooldownMs = 0;
  let warmMs = 0;
  let warmFrames = 0;

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  function easeOutBack(t) {
    const c = t - 1;
    return 1 + c * c * c + c * c * C1;
  }

  function rng(seed) {
    let s = seed;
    return function next() {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  function themeName() {
    return document.documentElement.dataset.theme === "light" ? "light" : "dark";
  }

  function pcbMap() {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 512;
    const g = c.getContext("2d");
    const rand = rng(20260927);

    g.fillStyle = "#0b1b14";
    g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 220; i += 1) {
      g.fillStyle = "rgba(255,255,255," + (rand() * 0.012).toFixed(3) + ")";
      g.fillRect(rand() * c.width, rand() * c.height, 30, 30);
    }

    g.lineCap = "square";
    g.lineJoin = "miter";
    for (let i = 0; i < 150; i += 1) {
      const wide = rand() < 0.12;
      g.lineWidth = wide ? 3.2 : 1.4;
      g.strokeStyle = wide ? "rgba(126,208,150,0.34)" : "rgba(112,186,136,0.2)";
      let x = rand() * c.width;
      let y = rand() * c.height;
      g.beginPath();
      g.moveTo(x, y);
      const steps = 2 + Math.floor(rand() * 4);
      for (let s = 0; s < steps; s += 1) {
        const len = 12 + rand() * 90;
        const turn = rand();
        if (turn < 0.4) x += len;
        else if (turn < 0.8) y += len;
        else {
          x += len * 0.7;
          y += len * 0.7;
        }
        g.lineTo(x, y);
      }
      g.stroke();
    }

    for (let i = 0; i < 320; i += 1) {
      g.fillStyle = "rgba(190,222,150,0.3)";
      g.beginPath();
      g.arc(rand() * c.width, rand() * c.height, rand() * 1.6 + 0.7, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 26; i += 1) {
      const x = rand() * c.width;
      const y = rand() * c.height;
      g.strokeStyle = "rgba(196,226,158,0.34)";
      g.lineWidth = 1.1;
      g.strokeRect(x, y, 5 + rand() * 16, 4 + rand() * 4);
    }

    g.fillStyle = "rgba(232,240,232,0.4)";
    for (let i = 0; i < 70; i += 1) {
      g.fillRect(rand() * c.width, rand() * c.height, 8 + rand() * 26, 1.6);
    }
    for (let i = 0; i < 12; i += 1) {
      g.font = "9px monospace";
      g.fillStyle = "rgba(232,240,232,0.3)";
      g.fillText("C" + (100 + Math.floor(rand() * 800)), rand() * c.width, rand() * c.height);
    }

    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  }

  function perfMap(cell) {
    const c = document.createElement("canvas");
    c.width = cell * 8;
    c.height = cell * 8;
    const g = c.getContext("2d");
    g.fillStyle = "#000";
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = "#fff";
    const step = cell * 2;
    for (let y = step / 2; y < c.height + step; y += step) {
      for (let x = step / 2; x < c.width + step; x += step) {
        const off = (Math.round(y / step) % 2) * step * 0.5;
        g.beginPath();
        g.arc(x + off, y, cell * 0.85, 0, Math.PI * 2);
        g.fill();
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  function labelMap() {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "#101216";
    g.fillRect(0, 0, 512, 256);
    g.strokeStyle = "#c9a227";
    g.lineWidth = 6;
    g.strokeRect(12, 12, 488, 232);
    g.fillStyle = "#e8e4d6";
    g.font = "bold 58px monospace";
    g.fillText("850W", 36, 92);
    g.font = "bold 40px monospace";
    g.fillText("GOLD", 36, 150);
    g.font = "22px monospace";
    g.fillStyle = "#9aa0a6";
    g.fillText("80+ PLUS", 36, 200);
    g.fillText("DC 12V 70A", 300, 200);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  function makeEnv() {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 64;
    const g = c.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, "#20242c");
    grad.addColorStop(0.45, "#4a515c");
    grad.addColorStop(0.62, "#8e97a3");
    grad.addColorStop(1, "#0c0e11");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 64);
    g.fillStyle = "rgba(255,255,255,0.85)";
    g.beginPath();
    g.ellipse(30, 16, 22, 11, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(200,220,255,0.5)";
    g.beginPath();
    g.ellipse(96, 20, 18, 9, 0, 0, Math.PI * 2);
    g.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.encoding = THREE.sRGBEncoding;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const rt = pmrem.fromEquirectangular(tex);
    pmrem.dispose();
    tex.dispose();
    return rt;
  }

  function normalizeUV(geo, w, h) {
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i += 1) {
      uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
    }
    uv.needsUpdate = true;
  }

  function shapeOf(w, h, r) {
    const shape = new THREE.Shape();
    const x = -w / 2;
    const y = -h / 2;
    const rr = Math.min(r === undefined ? 3 : r, w / 2, h / 2);
    shape.moveTo(x + rr, y);
    shape.lineTo(x + w - rr, y);
    shape.quadraticCurveTo(x + w, y, x + w, y + rr);
    shape.lineTo(x + w, y + h - rr);
    shape.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    shape.lineTo(x + rr, y + h);
    shape.quadraticCurveTo(x, y + h, x, y + h - rr);
    shape.lineTo(x, y + rr);
    shape.quadraticCurveTo(x, y, x + rr, y);
    return shape;
  }

  function extrude(shape, d, opt) {
    const o = opt || {};
    const bev = o.bevel === undefined ? 0.5 : o.bevel;
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: d,
      bevelEnabled: bev > 0,
      bevelSize: bev,
      bevelThickness: bev,
      bevelSegments: 1,
      curveSegments: o.seg || 6,
    });
    geo.translate(0, 0, -d / 2);
    if (o.uv) normalizeUV(geo, o.w, o.h);
    return geo;
  }

  /* X = w, Y = h, толщина по Z. */
  function plate(w, h, t, mat, opt) {
    const o = opt || {};
    const geo = extrude(shapeOf(w, h, o.r), t, {
      bevel: o.bevel,
      seg: o.seg,
      uv: o.uv,
      w: w,
      h: h,
    });
    return new THREE.Mesh(geo, mat);
  }

  /* Нормаль по X: Z = depth, Y = height, толщина по X. */
  function plateSide(depth, height, t, mat, opt) {
    const m = plate(depth, height, t, mat, opt);
    m.rotation.y = Math.PI / 2;
    return m;
  }

  /* Нормаль по Y: X = len, Z = width, толщина по Y. */
  function plateFlat(len, width, t, mat, opt) {
    const m = plate(len, width, t, mat, opt);
    m.rotation.x = -Math.PI / 2;
    return m;
  }

  function plateHoles(w, h, t, holes, mat, opt) {
    const o = opt || {};
    const shape = shapeOf(w, h, o.r === undefined ? 8 : o.r);
    holes.forEach((hl) => {
      const path = new THREE.Path();
      path.absarc(hl[0], hl[1], hl[2], 0, Math.PI * 2, true);
      shape.holes.push(path);
    });
    const geo = extrude(shape, t, {
      bevel: o.bevel,
      seg: 22,
      uv: o.uv,
      w: w,
      h: h,
    });
    return new THREE.Mesh(geo, mat);
  }

  function box(w, h, d, mat) {
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  }

  function cyl(r, h, mat, seg) {
    return new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg || 20), mat);
  }

  function cylAxis(r, len, mat, axis, seg) {
    const m = cyl(r, len, mat, seg);
    if (axis === "x") m.rotation.z = Math.PI / 2;
    else if (axis === "z") m.rotation.x = Math.PI / 2;
    return m;
  }

  function tube(pts, r, mat) {
    const curve = new THREE.CatmullRomCurve3(
      pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]))
    );
    return new THREE.Mesh(
      new THREE.TubeGeometry(curve, Math.max(28, pts.length * 12), r, 8, false),
      mat
    );
  }

  function makeGroup(name) {
    const seat = SEATS.find((s) => s[0] === name);
    const g = new THREE.Group();
    g.name = name;
    g.userData = {
      name: name,
      home: new THREE.Vector3(0, 0, 0),
      out: new THREE.Vector3().fromArray(OUT[name]),
      seat: seat[1],
      span: seat[2],
      seated: 0,
    };
    return g;
  }

  /* Габариты детали в миллиметрах в её собственной системе координат.
     Мировая AABB искажается поворотом сцены, поэтому матрица меша
     приводится к системе координат самой группы. */
  function partBox(mesh) {
    const b = new THREE.Box3();
    mesh.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
    const m = new THREE.Matrix4();
    mesh.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.computeBoundingBox();
      b.union(o.geometry.boundingBox.clone().applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld)));
    });
    return b;
  }

  /* Кадрирование: во что на экране попадает готовая сборка. NDC-бокс должен
     лежать в -1..1 по обеим осям, иначе модель обрезается краем кадра. */
  function frameBounds() {
    const b = new THREE.Box3().setFromObject(rig);
    const pts = [];
    for (let i = 0; i < 8; i += 1) {
      pts.push(new THREE.Vector3(
        i & 1 ? b.max.x : b.min.x,
        i & 2 ? b.max.y : b.min.y,
        i & 4 ? b.max.z : b.min.z
      ));
    }
    let x0 = 9, y0 = 9, x1 = -9, y1 = -9;
    pts.forEach((p) => {
      const q = p.clone().project(camera);
      x0 = Math.min(x0, q.x);
      x1 = Math.max(x1, q.x);
      y0 = Math.min(y0, q.y);
      y1 = Math.max(y1, q.y);
    });
    return {
      ndc: [x0, y0, x1, y1].map((v) => +v.toFixed(3)),
      canvas: [canvas.width, canvas.height],
      css: [canvas.clientWidth, canvas.clientHeight],
      stage: [stage.clientWidth, stage.clientHeight],
      camZ: +camera.position.z.toFixed(3),
      rig: rig.position.toArray().map((v) => +v.toFixed(3)),
      dpr: renderer.getPixelRatio(),
    };
  }

  function buildMaterials() {
    const name = themeName();
    mats = {};
    Object.keys(SURFACES).forEach((key) => {
      const p = SURFACES[key][name];
      const m = new THREE.MeshStandardMaterial({
        color: new THREE.Color(p[0]),
        roughness: p[1],
        metalness: p[2],
        envMapIntensity: LIGHTS[name].env,
      });
      if (key === "glass") {
        m.transparent = true;
        m.opacity = 0.15;
        m.depthWrite = false;
        m.side = THREE.DoubleSide;
      }
      mats[key] = m;
    });

    const perf = perfMap(9);
    perf.repeat.set(6, 6);
    mats.mesh = new THREE.MeshStandardMaterial({
      color: 0x14161a,
      roughness: 0.62,
      metalness: 0.45,
      alphaMap: perf,
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    });

    mats.pcbFace = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: pcbMap(),
      roughness: 0.58,
      metalness: 0.08,
    });

    mats.label = new THREE.MeshStandardMaterial({
      map: labelMap(),
      roughness: 0.72,
      metalness: 0,
    });

    mats.rgb = new THREE.MeshStandardMaterial({
      color: 0x101216,
      emissive: new THREE.Color(GLOWS.rgb[name]),
      emissiveIntensity: 1.8,
      roughness: 0.4,
      metalness: 0,
    });

    mats.led = new THREE.MeshBasicMaterial({ color: GLOWS.led[name] });
  }

  function paint() {
    if (!renderer) return;
    const name = themeName();
    const l = LIGHTS[name];
    const env = l.env;

    Object.keys(SURFACES).forEach((key) => {
      const p = SURFACES[key][name];
      const m = mats[key];
      if (!m) return;
      m.color.setHex(p[0]);
      m.roughness = p[1];
      m.metalness = p[2];
      m.envMapIntensity = env;
      m.needsUpdate = true;
    });
    if (mats.mesh) mats.mesh.envMapIntensity = env;
    if (mats.rgb) {
      mats.rgb.emissive.setHex(GLOWS.rgb[name]);
      mats.rgb.emissiveIntensity = 0.15 + clamp((scrollP - 0.84) / 0.14, 0, 1) * 2.4;
    }
    if (mats.led) mats.led.color.setHex(GLOWS.led[name]);

    if (lights) {
      lights.key.color.setHex(l.key[0]);
      lights.key.intensity = l.key[1];
      lights.key.position.set(l.key[2] * MM, l.key[3] * MM, l.key[4] * MM);
      lights.rim.color.setHex(l.rim[0]);
      lights.rim.intensity = l.rim[1];
      lights.rim.position.set(l.rim[2] * MM, l.rim[3] * MM, l.rim[4] * MM);
      lights.fill.color.setHex(l.fill[0]);
      lights.fill.intensity = l.fill[1];
      lights.fill.position.set(l.fill[2] * MM, l.fill[3] * MM, l.fill[4] * MM);
      lights.inner.color.setHex(l.inner[0]);
      lights.inner.intensity = l.inner[1] * 0.0016;
      lights.inner.position.set(l.inner[2] * MM, l.inner[3] * MM, l.inner[4] * MM);
    }
    if (dust) {
      dust.material.color.setHex(l.dust[0]);
      dust.material.opacity = l.dust[1];
    }
    renderer.toneMappingExposure = l.exposure;
  }

  function fanMesh(size, dir) {
    const g = new THREE.Group();
    const r = size / 2;
    const thick = 25;
    const bore = size * 0.44;

    const frame = plateHoles(size, size, thick, [[0, 0, bore]], mats.black, {
      r: 7,
      bevel: 0.8,
    });
    g.add(frame);

    const cr = size * 0.43;
    for (let i = 0; i < 4; i += 1) {
      const s = cyl(2.6, thick + 1, mats.rubber, 10);
      s.rotation.x = Math.PI / 2;
      s.position.set(i < 2 ? -cr : cr, i % 2 ? -cr : cr, 0);
      g.add(s);
    }

    const blades = new THREE.Group();
    const bs = new THREE.Shape();
    const r0 = r * 0.2;
    const r1 = r * 0.62;
    const r2 = bore;
    bs.moveTo(r0, -r * 0.1);
    bs.quadraticCurveTo(r1, -r * 0.34, r2, -r * 0.2);
    bs.quadraticCurveTo(r2 * 1.02, r * 0.05, r2 * 0.86, r * 0.16);
    bs.quadraticCurveTo(r1, r * 0.3, r0, r * 0.16);
    bs.lineTo(r0, -r * 0.1);
    const bladeGeo = new THREE.ExtrudeGeometry(bs, {
      depth: 1.4,
      bevelEnabled: false,
      curveSegments: 6,
    });
    const count = 7;
    for (let i = 0; i < count; i += 1) {
      const b = new THREE.Mesh(bladeGeo, mats.plastic);
      b.rotation.x = 0.42 + (i % 2) * 0.05;
      b.position.z = -thick * 0.2;
      const holder = new THREE.Group();
      holder.add(b);
      holder.rotation.z = (i / count) * Math.PI * 2 * (dir >= 0 ? 1 : -1);
      blades.add(holder);
    }
    const hub = cyl(r * 0.34, thick * 0.6, mats.plastic, 20);
    hub.rotation.x = Math.PI / 2;
    g.add(hub);
    const cap = cyl(r * 0.28, 1.2, mats.black, 20);
    cap.rotation.x = Math.PI / 2;
    cap.position.z = thick * 0.28;
    g.add(cap);
    g.add(blades);
    blades.userData = { dir: dir >= 0 ? 1 : -1, power: 0 };

    const ring = new THREE.Mesh(new THREE.TorusGeometry(bore + 4, 2.6, 6, 40), mats.rgb);
    ring.position.z = thick * 0.42;
    g.add(ring);

    fans.push(blades);
    return g;
  }

  function buildCase() {
    const g = makeGroup("case");

    const floor = plateFlat(CASE.d, CASE.w, 2, mats.frame, { r: 4 });
    floor.position.set(0, 1, MID_Z);
    g.add(floor);

    const shape = shapeOf(CASE.w, CASE.h, 4);
    const io = new THREE.Path();
    io.moveTo(-79.4, 28);
    io.lineTo(79.4, 28);
    io.lineTo(79.4, 72);
    io.lineTo(-79.4, 72);
    io.closePath();
    shape.holes.push(io);
    const backGeo = extrude(shape, 2, { bevel: 0 });
    const back = new THREE.Mesh(backGeo, mats.frame);
    back.rotation.y = Math.PI / 2;
    back.position.set(MID_X + 1, CASE.h / 2, MID_Z);
    g.add(back);

    for (let i = 0; i < 7; i += 1) {
      const cover = plateSide(112, 18, 1.4, mats.frame, { r: 1.2, bevel: 0.3 });
      cover.position.set(MID_X - 0.6, 86 + i * 20.32, MID_Z);
      g.add(cover);
    }

    /* Крепёжная площадка под материнскую плату: плата вертикальная, значит и
       площадка вертикальная — плоскость X-Y, нормаль по Z. */
    const tray = plate(CASE.d - 6, CASE.h - 6, 1.6, mats.frame, { r: 3 });
    tray.position.set(0, CASE.h / 2, 3);
    g.add(tray);
    [150, 250, 350].forEach((y) => {
      const grom = plate(92, 26, 3, mats.rubber, { r: 12, bevel: 0.4 });
      grom.position.set(96, y, 3.2);
      g.add(grom);
    });

    const shroudTop = plateFlat(238, 150, 2, mats.shell, { r: 3 });
    shroudTop.position.set(-106, 100, MID_Z);
    g.add(shroudTop);
    const shroudFace = plateSide(150, 100, 2, mats.shell, { r: 3 });
    shroudFace.position.set(14, 50, MID_Z);
    g.add(shroudFace);
    const shroudVent = plateFlat(150, 92, 1.2, mats.mesh, { r: 2, uv: true });
    shroudVent.position.set(-106, 99, MID_Z);
    g.add(shroudVent);

    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach((p) => {
      const foot = cyl(11, 7, mats.rubber, 14);
      foot.position.set(p[0] * (CASE.d / 2 - 40), -3, MID_Z + p[1] * 60);
      g.add(foot);
    });

    return g;
  }

  function buildPsu() {
    const g = makeGroup("psu");
    const x0 = MID_X + 3;
    const y0 = 12;
    const cy = y0 + 43;
    const cz = MID_Z;

    const body = plate(140, 86, 150, mats.black, { r: 4, bevel: 1 });
    body.position.set(x0 + 70, cy, cz);
    g.add(body);

    const f = fanMesh(120, 1);
    f.rotation.x = -Math.PI / 2;
    f.position.set(x0 + 72, y0 + 43, cz);
    g.add(f);
    const grill = plateFlat(112, 112, 1.2, mats.mesh, { r: 3, uv: true });
    grill.position.set(x0 + 72, y0 + 0.4, cz);
    g.add(grill);

    const back = plateSide(140, 86, 1.6, mats.black, { r: 2, bevel: 0.3 });
    back.position.set(x0 + 0.8, cy, cz);
    g.add(back);
    const iec = plateSide(20, 24, 3, mats.rubber, { r: 2, bevel: 0.3 });
    iec.position.set(x0 - 1, cy + 20, cz - 50);
    g.add(iec);
    const sw = box(3, 11, 7, mats.plastic);
    sw.position.set(x0 - 1.6, cy + 20, cz - 26);
    g.add(sw);
    const backVent = plateSide(56, 56, 1.2, mats.mesh, { r: 2, uv: true });
    backVent.position.set(x0 + 0.2, cy - 16, cz + 24);
    g.add(backVent);

    const panel = plateSide(140, 64, 1.4, mats.alu, { r: 2, bevel: 0.3 });
    panel.position.set(x0 + 140, cy, cz);
    g.add(panel);
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 5; c += 1) {
        const sock = box(3.4, 11, 7.5, mats.rubber);
        sock.position.set(x0 + 141, cy - 22 + r * 22, cz - 52 + c * 26);
        g.add(sock);
      }
    }

    const sticker = new THREE.Mesh(new THREE.PlaneGeometry(96, 48), mats.label);
    sticker.position.set(x0 + 70, cy + 8, cz + 75.4);
    g.add(sticker);

    return g;
  }

  function buildBoard() {
    const g = makeGroup("board");
    const W = 305;
    const H = 244;
    const cx = MID_X + W / 2;
    const cy = 62 + H / 2;
    const z = BOARD_Z;

    const pcb = plate(W, H, 1.6, mats.pcbFace, { r: 3, bevel: 0.3, uv: true });
    pcb.position.set(cx, cy, z);
    g.add(pcb);

    const holes = [
      [-13.5, -112], [-13.5, 112], [-8, 6], [70, 112], [70, -112],
      [140, 112], [140, -20], [140, -112], [208, 84],
    ];
    holes.forEach((h) => {
      const post = cyl(3.4, 6, mats.gold, 10);
      post.rotation.x = Math.PI / 2;
      post.position.set(cx + h[0], cy + h[1], 3.6);
      g.add(post);
    });

    const shield = plateSide(158, 44, 2, mats.steel, { r: 1, bevel: 0.3 });
    shield.position.set(MID_X - 3, 280, MID_Z);
    g.add(shield);
    for (let i = 0; i < 4; i += 1) {
      const usb = plateSide(12, 14, 2.4, mats.black, { r: 0.6, bevel: 0.2 });
      usb.position.set(MID_X - 2, 268, 34 + i * 16);
      g.add(usb);
    }
    const rj45 = plateSide(16, 16, 2.4, mats.alu, { r: 0.8, bevel: 0.2 });
    rj45.position.set(MID_X - 2, 274, 100);
    g.add(rj45);
    const hdmi = plateSide(15, 6, 2.4, mats.black, { r: 0.6, bevel: 0.2 });
    hdmi.position.set(MID_X - 2, 266, 122);
    g.add(hdmi);
    for (let i = 0; i < 2; i += 1) {
      const jack = cylAxis(3, 4, mats.black, "x", 10);
      jack.position.set(MID_X - 2, 292, 132 + i * 12);
      g.add(jack);
    }

    const vrm = plate(150, 26, 14, mats.alu, { r: 2, bevel: 0.6 });
    vrm.position.set(cx - 40, cy + 94, z + 8);
    g.add(vrm);
    for (let i = 0; i < 14; i += 1) {
      const fin = box(2.6, 20, 15, mats.steel);
      fin.position.set(cx - 108 + i * 10.4, cy + 94, z + 8);
      g.add(fin);
    }
    const vrm2 = plate(54, 22, 12, mats.alu, { r: 2, bevel: 0.6 });
    vrm2.position.set(cx - 116, cy + 84, z + 7);
    g.add(vrm2);
    const vrm3 = plate(46, 20, 11, mats.alu, { r: 2, bevel: 0.6 });
    vrm3.position.set(cx - 118, cy - 64, z + 6.5);
    g.add(vrm3);

    const chipset = plate(46, 46, 6, mats.steel, { r: 4, bevel: 0.8 });
    chipset.position.set(cx + 14, cy - 32, z + 4);
    g.add(chipset);

    const socket = plate(51, 45, 2.5, mats.slot, { r: 1.5, bevel: 0.3 });
    socket.position.set(-107, 202, z + 1.6);
    g.add(socket);

    const m2 = plate(80, 22, 3.4, mats.alu, { r: 2, bevel: 0.4 });
    m2.position.set(cx - 56, cy - 98, z + 2.6);
    g.add(m2);

    [188, 197.5, 207, 216.5].forEach((y) => {
      const slot = plate(133, 8, 7, mats.slot, { r: 0.8, bevel: 0.2 });
      slot.position.set(-8, y, z + 4);
      g.add(slot);
    });

    [72, 51.7, 31.4].forEach((y, i) => {
      const slot = plate(89, 7, 11, mats.slot, { r: 0.8, bevel: 0.2 });
      slot.position.set(-172, y, z + 6);
      g.add(slot);
      if (i === 0) {
        const shroud = plate(89, 11, 3, mats.steel, { r: 0.8, bevel: 0.2 });
        shroud.position.set(-172, y + 2, z + 12);
        g.add(shroud);
      }
    });

    const atx24 = plate(13, 52, 12, mats.slot, { r: 1, bevel: 0.3 });
    atx24.position.set(72, 152, z + 6);
    g.add(atx24);
    const eps = plate(26, 14, 12, mats.slot, { r: 1, bevel: 0.3 });
    eps.position.set(-170, 296, z + 6);
    g.add(eps);

    const rand = rng(77);
    for (let i = 0; i < 22; i += 1) {
      const cap = cyl(4.5, 11, i % 3 ? mats.black : mats.alu, 12);
      cap.rotation.x = Math.PI / 2;
      cap.position.set(
        cx - 126 + (i % 2) * 12 + Math.floor(rand() * 6) * 14,
        cy - 6 + Math.floor(i / 2) * 13,
        z + 6
      );
      g.add(cap);
    }

    for (let i = 0; i < 18; i += 1) {
      const chip = box(6 + rand() * 8, 5 + rand() * 4, 2, mats.black);
      chip.position.set(cx - 138 + rand() * 250, cy - 108 + rand() * 86, z + 2);
      g.add(chip);
    }

    const led = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), mats.led);
    led.position.set(64, 232, z + 3);
    g.add(led);
    leds.push(led);

    const strip = plate(240, 3, 1.6, mats.rgb, { r: 1, bevel: 0.2 });
    strip.position.set(cx - 6, cy + 116, z + 1.6);
    g.add(strip);

    return g;
  }

  function buildCpu() {
    const g = makeGroup("cpu");
    const z = BOARD_Z + 4;

    const frame = plate(45, 40, 3, mats.alu, { r: 1, bevel: 0.3 });
    frame.position.set(-107, 202, z + 1.5);
    g.add(frame);
    const ihs = plate(37, 33, 2.4, mats.steel, { r: 1, bevel: 0.4 });
    ihs.position.set(-107, 202, z + 4);
    g.add(ihs);
    const corner = box(5, 2, 0.6, mats.black);
    corner.position.set(-104, 186, z + 5.2);
    g.add(corner);
    const mark = box(2, 2, 0.4, mats.black);
    mark.position.set(-118, 190, z + 5.2);
    g.add(mark);

    return g;
  }

  function buildCooler() {
    const g = makeGroup("cooler");
    const bx = -107;
    const by = 202;
    const z0 = BOARD_Z + 8;
    const stackW = 50;
    const stackD = 132;
    const baseY = by + 26;
    const finPitch = 6.2;
    const fins = 24;
    const finZ = z0 + stackD / 2;

    const base = plate(48, 42, 7, mats.copper, { r: 1.5, bevel: 0.5 });
    base.rotation.x = -Math.PI / 2;
    base.position.set(bx, by + 27, z0 + 6);
    g.add(base);

    const topY = baseY + 12 + fins * finPitch;
    const pipes = [
      [-58, -40], [-62, -14], [-58, 14], [58, -40], [62, -14], [58, 14],
    ];
    /* Трубки идут от основания вверх и расходятся между башнями по X;
       по Z они почти не отклоняются, иначе уходят сквозь плату. */
    pipes.forEach((p) => {
      g.add(tube([
        [bx, by + 27, z0 + 6],
        [bx + p[0] * 0.4, by + 60, z0 + 6 + p[1] * 0.1],
        [bx + p[0] * 0.85, topY - 30, z0 + 6 + p[1] * 0.08],
        [bx + p[0], topY, z0 + 6 + p[1] * 0.06],
      ], 3, mats.copper));
    });

    [[bx - 47, -1], [bx + 37, 1]].forEach((s) => {
      for (let i = 0; i < fins; i += 1) {
        const fin = box(stackW, 0.6, stackD, mats.steel);
        fin.position.set(s[0], baseY + 12 + i * finPitch, finZ);
        g.add(fin);
      }
      [-1, 1].forEach((sd) => {
        const side = box(1.6, fins * finPitch, stackD, mats.alu);
        side.position.set(s[0] + sd * (stackW / 2), baseY + 12 + fins * finPitch / 2, finZ);
        g.add(side);
      });
      const cap = box(stackW, 3, stackD, mats.alu);
      cap.position.set(s[0], topY + 2, finZ);
      g.add(cap);
    });

    const centreY = baseY + 12 + fins * finPitch / 2;
    const centre = fanMesh(120, 1);
    centre.rotation.y = Math.PI / 2;
    centre.position.set(bx - 12, centreY, finZ);
    g.add(centre);
    const front = fanMesh(140, 1);
    front.rotation.y = Math.PI / 2;
    front.position.set(bx - 84, centreY, finZ);
    g.add(front);

    /* Крестины растяжки вентиляторов лежат в плоскости Y-Z самого вентилятора,
       поэтому смещение идёт по Z, а не по X. */
    [bx - 12, bx - 84].forEach((x) => {
      [-1, 1].forEach((sd) => {
        const clip = box(3, 96, 3, mats.steel);
        clip.position.set(x, centreY, finZ + sd * 66);
        g.add(clip);
      });
    });

    return g;
  }

  function buildRam() {
    const g = makeGroup("ram");
    const h = 42;

    [188, 197.5, 207, 216.5].forEach((y) => {
      const mod = new THREE.Group();
      mod.add(plateFlat(133.35, 31.25, 1.27, mats.pcb, { r: 1, bevel: 0.2 }));
      [-1, 1].forEach((sd) => {
        const spreader = plateFlat(133, 30, 2.2, mats.ram, { r: 2, bevel: 0.4 });
        spreader.position.set(0, sd * 1.7, 0);
        mod.add(spreader);
      });
      /* Гребень и подсветка стоят у верхнего края модуля, а не за ним:
         локальная Z модуля — это его высота, край на h/2. */
      const cap = plateFlat(133, 2.6, 3, mats.ram, { r: 1.5, bevel: 0.4 });
      cap.position.set(0, 0, h / 2 - 1.5);
      mod.add(cap);
      const bar = plateFlat(118, 2, 1.6, mats.rgb, { r: 1, bevel: 0.2 });
      bar.position.set(0, 0, h / 2 - 4.4);
      mod.add(bar);
      const fingers = plateFlat(126, 3, 6, mats.gold, { r: 0.4, bevel: 0.2 });
      fingers.position.set(0, 0, -h / 2 + 2.6);
      mod.add(fingers);
      mod.position.set(-8, y, BOARD_Z + 17);
      g.add(mod);
    });

    return g;
  }

  function buildGpu() {
    const g = makeGroup("gpu");
    const L = 304;
    const H = 137;
    const W = 61;
    const x0 = MID_X + 7;
    const cx = x0 + L / 2;
    const yBot = 70;
    const yMid = yBot + H / 2;
    const z0 = BOARD_Z + 6;
    const zFace = z0 + W - 3;

    const pcb = plate(L - 8, 104, 1.6, mats.pcbFace, { r: 2, bevel: 0.3, uv: true });
    pcb.position.set(cx, yBot + 52, z0 + 2);
    g.add(pcb);

    const fingers = plate(90, 6, 2, mats.gold, { r: 0.5, bevel: 0.2 });
    fingers.position.set(-173, yBot + 2, z0 + 2);
    g.add(fingers);

    for (let i = 0; i < 26; i += 1) {
      const fin = box(1.6, 96, 46, mats.steel);
      fin.position.set(x0 + 22 + i * 9.4, yBot + 60, z0 + 26);
      g.add(fin);
    }

    /* Бэкплейт лежит в плоскости карты (X-Y), как PCB и shroud, а не плашмя. */
    const backplate = plate(L - 6, 128, 2.4, mats.black, { r: 4, bevel: 0.4 });
    backplate.position.set(cx, yMid, z0 - 1.6);
    g.add(backplate);

    const holes = [[-68, 0, 52], [62, 0, 52]];
    const shroud = plateHoles(L - 6, H + 4, 5, holes, mats.plastic, { r: 8, bevel: 1 });
    shroud.position.set(cx, yMid, zFace);
    g.add(shroud);

    [-68, 62].forEach((dx, i) => {
      const f = fanMesh(104, i ? 1 : -1);
      f.position.set(cx + dx, yMid, zFace - 12);
      g.add(f);
    });

    const endcap = plateSide(40, 118, 6, mats.black, { r: 2, bevel: 0.4 });
    endcap.position.set(x0 + L - 3, yBot + 62, z0 + 24);
    g.add(endcap);
    const endVent = plateSide(26, 70, 4, mats.mesh, { r: 2, uv: true });
    endVent.position.set(x0 + L - 1, yBot + 62, z0 + 24);
    g.add(endVent);

    const bracket = plateSide(44, 120, 2.4, mats.steel, { r: 2, bevel: 0.4 });
    bracket.position.set(x0 - 5, yBot + 70, z0 + 24);
    g.add(bracket);
    [[-22, 2], [2, 2], [26, 2]].forEach((o) => {
      const port = plateSide(14, 9, 3, mats.rubber, { r: 0.8, bevel: 0.2 });
      port.position.set(x0 - 7, yBot + 70 + o[1], z0 + 24 + o[0]);
      g.add(port);
    });

    const power = box(26, 9, 16, mats.black);
    power.position.set(x0 + 54, yBot + H + 3, z0 + 20);
    g.add(power);

    const logo = plate(150, 5, 1.6, mats.rgb, { r: 1, bevel: 0.2 });
    logo.position.set(cx + 10, yBot + H - 10, zFace + 3);
    g.add(logo);

    return g;
  }

  function buildFans() {
    const front = makeGroup("fanFront");
    [104, 240, 376].forEach((y) => {
      const f = fanMesh(120, 1);
      f.rotation.y = Math.PI / 2;
      f.position.set(FRONT_X - 34, y, MID_Z);
      front.add(f);
    });
    const rear = makeGroup("fanBack");
    const rf = fanMesh(120, -1);
    rf.rotation.y = Math.PI / 2;
    rf.position.set(MID_X + 26, 350, MID_Z);
    rear.add(rf);
    const top = makeGroup("fanTop");
    const tf = fanMesh(120, 1);
    tf.rotation.x = -Math.PI / 2;
    tf.position.set(10, CASE.h - 32, MID_Z);
    top.add(tf);
    return [front, rear, top];
  }

  function buildCables() {
    const g = makeGroup("cables");
    const x0 = MID_X + 3;

    g.add(tube([
      [x0 + 130, 34, 92], [-30, 26, 140], [40, 36, 70],
      [104, 120, 10], [96, 150, 5], [86, 152, 8],
    ], 5.5, mats.rubber));
    g.add(tube([
      [x0 + 130, 34, 54], [-90, 40, 30], [-160, 120, 24],
      [-170, 250, 22], [-170, 294, 22],
    ], 4.5, mats.rubber));
    g.add(tube([
      [x0 + 130, 34, 36], [-140, 60, 60], [-196, 130, 42],
      [-176, 186, 32], [-164, 206, 28],
    ], 5, mats.rubber));
    g.add(tube([
      [x0 + 130, 30, 116], [-20, 22, 130], [30, 24, 110], [46, 28, 82],
    ], 4, mats.rubber));
    g.add(tube([
      [x0 + 118, 30, 108], [-40, 24, 140], [20, 22, 120], [46, 30, 96],
    ], 4, mats.rubber));

    [150, 250, 350].forEach((y) => {
      const tie = plate(88, 24, 2.4, mats.black, { r: 11, bevel: 0.3 });
      tie.position.set(96, y, 5);
      g.add(tie);
    });

    return g;
  }

  function buildPanels() {
    const g = makeGroup("panels");

    const roof = plateFlat(CASE.d, CASE.w, 2, mats.shell, { r: 4 });
    roof.position.set(0, CASE.h - 1, MID_Z);
    g.add(roof);

    const front = plateSide(CASE.w, CASE.h - 8, 3, mats.shell, { r: 5 });
    front.position.set(FRONT_X - 1.5, CASE.h / 2, MID_Z);
    g.add(front);
    const frontMesh = plateSide(CASE.w - 30, CASE.h - 70, 1.4, mats.mesh, {
      r: 4,
      uv: true,
    });
    frontMesh.position.set(FRONT_X - 4, CASE.h / 2 + 6, MID_Z);
    frontMesh.renderOrder = 2;
    g.add(frontMesh);
    [-1, 1].forEach((sd) => {
      const port = plateSide(12, 8, 5, mats.black, { r: 1, bevel: 0.3 });
      port.position.set(FRONT_X + 0.5, CASE.h - 22, MID_Z + sd * 26);
      g.add(port);
    });
    const jack = cylAxis(3, 5, mats.black, "x", 10);
    jack.position.set(FRONT_X + 0.5, CASE.h - 34, MID_Z);
    g.add(jack);

    /* Боковое стекло стоит вертикально в плоскости X-Y: без поворота пластина
       уже смотрит нормалью по Z, то есть наружу боковой панели. */
    const glass = plate(CASE.d - 6, CASE.h - 6, 4, mats.glass, { r: 6, bevel: 0.8 });
    glass.position.set(0, CASE.h / 2, CASE.w - 2);
    glass.renderOrder = 1;
    g.add(glass);
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach((p) => {
      const screw = cyl(4, 12, mats.alu, 12);
      screw.position.set(
        p[0] * (CASE.d / 2 - 16),
        p[1] * (CASE.h / 2 - 16) + CASE.h / 2,
        CASE.w - 4
      );
      g.add(screw);
    });

    return g;
  }

  function buildDust() {
    const count = 420;
    const pos = new Float32Array(count * 3);
    const rand = rng(4242);
    for (let i = 0; i < count; i += 1) {
      pos[i * 3] = (rand() - 0.5) * 900;
      pos[i * 3 + 1] = (rand() - 0.5) * 900;
      pos[i * 3 + 2] = (rand() - 0.5) * 620;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({
      color: 0xefeede,
      /* Размер точки шейдер считает в мировых единицах, а не в миллиметрах:
         2.5 давали бы пятно радиусом в треть экрана на каждой частице. */
      size: 6 * MM,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return new THREE.Points(geo, m);
  }

  function build() {
    scene = new THREE.Scene();

    world = new THREE.Group();
    world.scale.setScalar(MM);
    /* Позиция группы задаётся в единицах сцены, а её scale на неё не
       действует, поэтому центрируем корпус явно в миллиметрах. */
    world.position.set(0, -CASE.h / 2 * MM, -MID_Z * MM);
    scene.add(world);

    rig = new THREE.Group();
    world.add(rig);

    parts = [];

    /* Материалы и окружение готовятся до геометрии: builders берут материалы
       из mats, иначе meshes получили бы дефолтный белый MeshBasicMaterial
       и тема перестала бы на них действовать. */
    envRT = makeEnv();
    scene.environment = envRT.texture;
    buildMaterials();

    parts.push(buildCase(), buildPsu(), buildBoard(), buildCpu(), buildCooler());
    parts.push(buildRam(), buildGpu());
    parts.push.apply(parts, buildFans());
    parts.push(buildCables(), buildPanels());
    parts.forEach((p) => rig.add(p));

    lights = {
      key: new THREE.DirectionalLight(0xffffff, 2.6),
      rim: new THREE.DirectionalLight(0xffffff, 2.4),
      fill: new THREE.DirectionalLight(0xffffff, 1),
      inner: new THREE.PointLight(0xffffff, 1, 1.7, 2),
    };
    scene.add(lights.key, lights.rim, lights.fill, lights.inner);

    dust = buildDust();
    world.add(dust);

    paint();
  }

  const BANDS = [
    [0.34, 0.5, "cooler"], [0.55, 0.68, "gpu"],
    [0.7, 0.82, "fanFront"], [0.9, 1.01, "panels"],
  ];

  /* Акцент на собранной детали. Вес — чистая функция прокрутки, поэтому при
     прокрутке вверх деталь возвращается ровно туда же, откуда пришла. */
  function focusTarget(p) {
    for (let i = 0; i < BANDS.length; i += 1) {
      const b = BANDS[i];
      if (p >= b[0] && p < b[1]) {
        const part = parts.filter((m) => m.userData.name === b[2])[0];
        if (part) {
          return {
            part: part,
            w: clamp((p - b[0]) / 0.05, 0, 1) * clamp((b[1] - p) / 0.05, 0, 1),
          };
        }
      }
    }
    return null;
  }

  function applyAssembly(p) {
    const band = focusTarget(p);
    parts.forEach((mesh) => {
      const d = mesh.userData;
      const t = clamp((p - d.seat) / d.span, 0, 1);
      d.seated = t;
      const e = t <= 0 ? 0 : t >= 1 ? 1 : easeOutBack(t);
      const bx = d.home.x + d.out.x * (1 - e);
      const by = d.home.y + d.out.y * (1 - e);
      const bz = d.home.z + d.out.z * (1 - e);
      const k = band && mesh === band.part ? band.w : 0;
      mesh.position.set(
        bx + (d.home.x - bx) * k,
        by + (d.home.y + 6 - by) * k,
        bz + (d.home.z + 24 - bz) * k
      );
      mesh.rotation.set(
        (1 - e) * 0.2 * d.out.z * (1 - k),
        (1 - e) * 0.2 * d.out.x * (1 - k),
        (1 - e) * 0.12 * d.out.y * (1 - k) + k * 0.12
      );
    });
  }

  function readScroll() {
    /* Только window.scrollY: геометрия героя лежит в кеше, раскладку не трогаем. */
    const p = clamp((heroTop - window.scrollY) / span, 0, 1);
    if (p === scrollP) return;
    scrollP = p;
    applyAssembly(scrollP);
    const power = clamp((scrollP - 0.72) / 0.26, 0, 1);
    fans.forEach((b) => {
      b.userData.power = power;
    });
    const glow = clamp((scrollP - 0.84) / 0.14, 0, 1);
    if (mats.rgb) mats.rgb.emissiveIntensity = 0.15 + glow * 2.4;
    leds.forEach((l) => {
      l.scale.setScalar(0.6 + glow * 0.6);
    });
  }

  /** Единственное место, где читается геометрия hero. */
  function measure() {
    stageW = stage.clientWidth;
    stageH = stage.clientHeight;
    span = Math.max(hero.offsetHeight - stageH, 1);
    const rect = hero.getBoundingClientRect();
    heroTop = rect.top + window.scrollY;
    stageRect = stage.getBoundingClientRect();
  }

  /** Буфер по качеству: чем дороже кадр, тем меньше пикселей. */
  function applyResolution() {
    if (!renderer) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * SCALE_LADDER[rung];
    renderer.setPixelRatio(clamp(dpr, 0.5, 2));
    renderer.setSize(stageW, stageH, false);
  }

  /** Пересчёт на resize: не чаще одного кадра и только при реальной смене размера. */
  function applyLayout() {
    layoutQueued = 0;
    if (!renderer) return;
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    /* Сравниваем с прошлым размером до measure(): он перезаписывает кеш, и
       после этого размер всегда «тот же самый». */
    const sizeChanged = w !== stageW || h !== stageH;
    measure();
    if (!sizeChanged) return; // размер не изменился — буфер не трогаем
    applyResolution();

    const compact = w <= COMPACT;
    const fov = compact ? 40 : 32;
    const tan = Math.tan((fov * Math.PI) / 360);
    /* Габарит занимает долю кадра: дистанция = половина размера / (доля * tan),
       иначе модель выходит за края. */
    const fillH = compact ? 0.66 : 0.78;
    const fillW = compact ? 0.84 : 0.62;
    const needH = (CASE.h * MM * 0.5) / (fillH * tan);
    const needW = (CASE.d * MM * 0.5) / (fillW * tan);
    const dist = Math.max(2.2, Math.max(needH, needW) * 1.1);

    camera.fov = fov;
    camera.position.set(0.36, 0.14, dist);
    camera.lookAt(0, 0, 0);

    const visH = 2 * dist * tan;
    const visW = visH * (w / h);
    rig.position.set(compact ? 0 : visW * 0.13, compact ? -visH * 0.17 : -visH * 0.015, 0);
    camera.updateProjectionMatrix();
  }

  function layout() {
    if (layoutQueued) return;
    layoutQueued = requestAnimationFrame(applyLayout);
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

  function frame(t) {
    raf = 0;
    const raw = t - lastT;
    /* Метка первого кадра после запуска бывает раньше lastT: IntersectionObserver
       срабатывает в конце кадра, а rAF — в начале следующего. Отрицательный dt
       уводил бы сцену назад, а adapt() принимал его за 0 Гц. */
    const dt = raw > 0 ? Math.min(raw / 1000, 0.05) : 0.016;
    lastT = t;

    /* Сборка едет за прокруткой, но пересчитывается раз в кадр, а не на
       каждое событие колеса. */
    if (scrollDirty) {
      scrollDirty = false;
      readScroll();
    }

    look.x += (look.tx - look.x) * (1 - Math.exp(-LOOK_RATE * dt));
    look.y += (look.ty - look.y) * (1 - Math.exp(-LOOK_RATE * dt));

    /* Инерция мыши: события копятся, скорость гасится за секунду, а не за кадр. */
    if (spin.dx || spin.dy) {
      spin.vy = clamp(spin.vy + spin.dx * 0.00034 * 60, -3.6, 3.6);
      spin.vx = clamp(spin.vx + spin.dy * 0.00034 * 60, -3.6, 3.6);
      spin.dx = 0;
      spin.dy = 0;
    }
    const damp = Math.exp(-SPIN_DAMP * dt);
    spin.vx *= damp;
    spin.vy *= damp;

    rig.rotation.y = clamp(rig.rotation.y + (RIG_SPIN + spin.vy) * dt, -0.6, 0.6);
    rig.rotation.x = clamp(rig.rotation.x + spin.vx * dt, -0.22, 0.22);

    fans.forEach((b) => {
      b.rotation.z += dt * (0.15 + b.userData.power * 26) * b.userData.dir;
    });

    dust.rotation.y += dt * 0.012;

    camera.position.x = 0.36 + look.x * 0.16;
    camera.position.y = 0.14 - look.y * 0.11;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    /* На лестницу идёт настоящий интервал кадра, а не зажатый dt: если кадр
       реально занял 200 мс, это и надо компенсировать разрешением. */
    adapt(raw);
    raf = requestAnimationFrame(frame);
  }

  function sync() {
    const should = !reduced && inView && !document.hidden;
    /* Пока сцена жива, у залипшей верхней панели не должно быть
       backdrop-filter: размытие подложки под перерисовываемым канвасом
       считается каждый кадр. */
    document.documentElement.classList.toggle("gl-live", should);
    if (should && !running) {
      running = true;
      lastT = performance.now();
      avg = 0;
      floor = 0;
      warmMs = 0;
      warmFrames = 0;
      cooldownMs = 0;
      raf = requestAnimationFrame(frame);
    } else if (!should && running) {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function onPointerMove(event) {
    if (spin.drag) return;
    /* Прямоугольник сцены из кеша: getBoundingClientRect() на каждом движении
       мыши заставлял браузер пересчитывать раскладку. */
    if (!stageW || !stageH) return;
    look.tx = clamp(((event.clientX - stageRect.left) / stageW - 0.5) * 2, -1, 1);
    look.ty = clamp(((event.clientY - stageRect.top) / stageH - 0.5) * 2, -1, 1);
  }

  function onPointerDown(event) {
    if (reduced || event.target.closest(interactive)) return;
    spin.drag = true;
    spin.px = event.clientX;
    spin.py = event.clientY;
    spin.dx = 0;
    spin.dy = 0;
    stage.classList.add("is-grabbing");
  }

  function onPointerMoveDrag(event) {
    if (!spin.drag) return;
    /* Копим смещение и трактуем его в кадре, а не в событии: иначе скорость
       зависит от частоты pointermove. */
    spin.dx += event.clientX - spin.px;
    spin.dy += event.clientY - spin.py;
    spin.px = event.clientX;
    spin.py = event.clientY;
  }

  function onPointerUp() {
    if (!spin.drag) return;
    spin.drag = false;
    spin.dx = 0;
    spin.dy = 0;
    stage.classList.remove("is-grabbing");
  }

  function onMotionChange() {
    reduced = motionQuery.matches;
    if (reduced) {
      onPointerUp();
      sync();
    } else {
      readScroll();
      sync();
    }
  }

  function degrade() {
    document.documentElement.classList.add("no-gl");
  }

  function exposeProbe() {
    if (!new URLSearchParams(window.location.search).has("pcdebug")) return;
    window.__heroPC = {
      progress: () => scrollP,
      /* Углы движения в радианах: контракт сцены — за секунду реального времени
         риг поворачивается на одну и ту же величину при 30, 60 и 144 Гц. */
      motion: () => ({
        ry: rig.rotation.y,
        rx: rig.rotation.x,
        look: [look.x, look.y],
        fan: fans.length ? fans[0].rotation.z : 0,
        dpr: renderer.getPixelRatio(),
      }),
      /* Скрыть или показать группу детали: так видно, кто именно заливает кадр. */
      hide: (name, off) => {
        const part = parts.find((m) => m.userData.name === name);
        if (!part) return false;
        part.visible = !off;
        return true;
      },
      /* Какие меши закрывают кадр: сортировка по площади в NDC. Помогает найти
         плиту или панель, которая заливает собой всю сцену. */
      largestOnScreen: (limit) => {
        const out = [];
        const v = new THREE.Vector3();
        scene.updateMatrixWorld(true);
        camera.updateMatrixWorld(true);
        scene.traverse((o) => {
          if (!o.isMesh && !o.isPoints) return;
          const b = new THREE.Box3().setFromObject(o);
          if (b.isEmpty()) return;
          let minx = 9e9;
          let miny = 9e9;
          let maxx = -9e9;
          let maxy = -9e9;
          for (let i = 0; i < 8; i += 1) {
            v.set(
              i & 1 ? b.max.x : b.min.x,
              i & 2 ? b.max.y : b.min.y,
              i & 4 ? b.max.z : b.min.z,
            );
            v.project(camera);
            minx = Math.min(minx, v.x);
            maxx = Math.max(maxx, v.x);
            miny = Math.min(miny, v.y);
            maxy = Math.max(maxy, v.y);
          }
          out.push({
            type: o.type,
            geo: o.geometry ? o.geometry.type : "?",
            part: o.parent && o.parent.userData ? o.parent.userData.name : "",
            area: +((maxx - minx) * (maxy - miny)).toFixed(3),
            ndc: [
              +minx.toFixed(2), +miny.toFixed(2), +maxx.toFixed(2), +maxy.toFixed(2),
            ],
            color: o.material && o.material.color
              ? "#" + o.material.color.getHexString() : "",
            mm: b.getSize(new THREE.Vector3())
              .toArray().map((q) => Math.round(q)),
          });
        });
        out.sort((a, b2) => b2.area - a.area);
        return out.slice(0, limit || 10);
      },
      snapshot: () =>
        new Promise((resolve) => {
          requestAnimationFrame(() => {
            renderer.render(scene, camera);
            resolve(renderer.domElement.toDataURL("image/png"));
          });
        }),
      parts: () =>
        parts.map((mesh) => ({
          name: mesh.userData.name,
          seated: +mesh.userData.seated.toFixed(3),
          pos: mesh.position.toArray().map((v) => +v.toFixed(2)),
        })),
      /* Габариты детали в миллиметрах мирового пространства: размер, центр,
         а также список мешей — чтобы проверки видели, что геометрия не пустая. */
      bounds: () =>
        parts.map((mesh) => {
          const b = partBox(mesh);
          const s = b.getSize(new THREE.Vector3());
          const c = b.getCenter(new THREE.Vector3());
          let meshes = 0;
          let tris = 0;
          mesh.traverse((o) => {
            if (o.isMesh) {
              meshes += 1;
              const g = o.geometry;
              if (g && g.index) tris += g.index.count / 3;
              else if (g && g.attributes.position) tris += g.attributes.position.count / 3;
            }
          });
          return {
            name: mesh.userData.name,
            size: s.toArray().map((v) => Math.round(v * 10) / 10),
            center: c.toArray().map((v) => Math.round(v * 10) / 10),
            meshes: meshes,
            tris: Math.round(tris),
          };
        }),
      frame: frameBounds,

      /* Крупнейшие меши сцены в миллиметрах: по ним видно, какая деталь
         раздувает габариты или съедает время рендера. */
      /* Крупнейшие меши детали в миллиметрах её системы координат: по ним
         видно, какой именно объект вылезает за габариты. */
      heavy: (partName, n) => {
        const part = partName
          ? parts.filter((m) => m.userData.name === partName)[0]
          : null;
        if (!part) return [];
        part.updateWorldMatrix(true, true);
        const inv = new THREE.Matrix4().copy(part.matrixWorld).invert();
        const m = new THREE.Matrix4();
        const rows = [];
        part.traverse((o) => {
          if (!o.isMesh) return;
          o.geometry.computeBoundingBox();
          const s = o.geometry.boundingBox
            .clone()
            .applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld))
            .getSize(new THREE.Vector3());
          const c = o.geometry.boundingBox
            .clone()
            .applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld))
            .getCenter(new THREE.Vector3());
          rows.push({
            geo: o.geometry.type,
            size: s.toArray().map((v) => Math.round(v * 10) / 10),
            center: c.toArray().map((v) => Math.round(v * 10) / 10),
            vol: s.x * s.y * s.z,
          });
        });
        rows.sort((a, b) => b.vol - a.vol);
        return rows.slice(0, n || 10);
      },
    };
  }

  function start() {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;

    camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
    build();
    /* Первый расчёт — сразу, иначе канвас кадр рисуется в размере 300x150. */
    applyLayout();
    document.documentElement.classList.add("gl-ready");
    exposeProbe();

    if (reduced) {
      degrade();
      return;
    }

    if (typeof motionQuery.addEventListener === "function") {
      motionQuery.addEventListener("change", onMotionChange);
    }
    if (finePointer.matches) {
      stage.addEventListener("pointermove", onPointerMove);
      stage.addEventListener("pointermove", onPointerMoveDrag);
      stage.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", layout);
    window.addEventListener("themechange", paint);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function onEntries(entries) {
        inView = entries[0].isIntersecting;
        sync();
      }, { threshold: 0 }).observe(hero);
    }
    readScroll();
    sync();
  }

  function onScroll() {
    if (reduced) return;
    /* Пока цикл идёт, пересчёт отложим до кадра: событий прокрутки за секунду
       бывает больше, чем кадров. Если сцена не рисуется — считаем сразу. */
    if (running) {
      scrollDirty = true;
      return;
    }
    readScroll();
  }

  function loadLib() {
    if (reduced || !window.WebGLRenderingContext) {
      degrade();
      return;
    }
    const script = document.createElement("script");
    script.src = LIB;
    script.onload = function onload() {
      THREE = window.THREE;
      if (!THREE || !THREE.WebGLRenderer) {
        degrade();
        return;
      }
      try {
        start();
      } catch (err) {
        if (window.console) console.error("scene3d:", err);
        degrade();
      }
    };
    script.onerror = degrade;
    document.head.appendChild(script);
  }

  const begin = function begin() {
    loadLib();
  };
  if (document.readyState === "complete") begin();
  else window.addEventListener("load", begin, { once: true });
})();
