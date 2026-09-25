/**
 * Core: объект в средней части секции проектов. Состояние задаётся колесом
 * мыши — прокрутка вверх заряжает ядро (сжатие, частицы летят к центру), вниз
 * разряжает (расширение, частицы расходятся).
 *
 * Декоративно: без JS и без 2D-контекста блок остаётся пустой полосой, а при
 * prefers-reduced-motion рисуется один статичный кадр.
 */
(function () {
  "use strict";

  const LIME = [216, 242, 108];
  const ORANGE = [244, 154, 112];
  const NEUTRAL = [139, 147, 167];
  const DUST = 64;
  const HOLD = 620;
  const STEP = 0.34;
  const SIDES = 8;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rgba = (rgb, a) => `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

  let live = null;

  function attach(host) {
    if (live) live.destroy();

    const band = document.createElement("div");
    band.className = "core";
    band.setAttribute("aria-hidden", "true");

    const canvas = document.createElement("canvas");
    canvas.className = "core-canvas";
    const meta = document.createElement("div");
    meta.className = "core-meta mono";
    meta.innerHTML =
      '<i class="core-dot"></i><b class="core-state">idle</b><span class="core-hint">wheel ↑ charge · ↓ release</span>';
    band.appendChild(canvas, meta);

    const ctx = canvas.getContext && canvas.getContext("2d");
    if (!ctx) return band;

    const stateNode = meta.querySelector(".core-state");
    const abort = new AbortController();
    const scope = host.closest("section") || host;

    let w = 1;
    let h = 1;
    let energy = 0;
    let target = 0;
    let hold = 0;
    let rings = 0;
    let core = 0;
    let sweep = 0;
    let raf = 0;
    let last = 0;
    let touchY = null;

    const dust = Array.from({ length: DUST }, () => ({
      a: Math.random() * Math.PI * 2,
      orbit: 0.24 + Math.random() * 0.76,
      spin: Math.random() < 0.5 ? -1 : 1,
      size: 0.5 + Math.random() * 1.1,
      wob: (Math.random() - 0.5) * 0.06,
    }));

    function state() {
      if (Math.abs(energy) < 0.06) return "idle";
      return energy < 0 ? "charge" : "release";
    }

    function resize() {
      const rect = band.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint();
    }

    function paint() {
      const name = state();
      if (stateNode.textContent !== name) stateNode.textContent = name;
      if (band.dataset.state !== name) band.dataset.state = name;

      const mag = Math.min(1, Math.abs(energy));
      const tone = mix(NEUTRAL, energy < 0 ? LIME : ORANGE, mag);
      const cx = w / 2;
      const cy = h / 2 - 10;
      const R = Math.min(w * 0.26, h * 0.4);
      if (R < 8) return;

      ctx.clearRect(0, 0, w, h);
      const spread = 0.78 + energy * 0.42;
      const scale = 0.98 + energy * 0.26;

      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.6);
      glow.addColorStop(0, rgba(tone, 0.14 + 0.18 * mag));
      glow.addColorStop(0.4, rgba(tone, 0.05 + 0.05 * mag));
      glow.addColorStop(1, rgba(tone, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      ctx.lineWidth = 1;
      [0.48, 0.68].forEach((k, i) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(i ? -rings * 0.7 : rings);
        ctx.setLineDash([5 + 12 * mag, 6 + 20 * mag]);
        ctx.strokeStyle = rgba(tone, 0.2 + 0.24 * mag);
        ctx.beginPath();
        ctx.arc(0, 0, R * k * spread, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });
      ctx.setLineDash([]);

      ctx.save();
      ctx.translate(cx, cy);
      for (let i = 0; i < dust.length; i += 1) {
        const p = dust[i];
        const r = R * p.orbit * spread + p.wob * R;
        ctx.fillStyle = rgba(tone, 0.18 + 0.5 * (1 - p.orbit) * (0.6 + 0.4 * mag));
        ctx.beginPath();
        ctx.arc(Math.cos(p.a) * r, Math.sin(p.a) * r * 0.7, p.size * (0.8 + 0.7 * mag), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(sweep);
      const tail = ctx.createLinearGradient(0, 0, R * 1.1, 0);
      tail.addColorStop(0, rgba(tone, 0.45 + 0.35 * mag));
      tail.addColorStop(1, rgba(tone, 0));
      ctx.strokeStyle = tail;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(R * 1.05, 0);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(core);
      ctx.beginPath();
      for (let i = 0; i < SIDES; i += 1) {
        const a = (i / SIDES) * Math.PI * 2;
        const x = Math.cos(a) * R * 0.3 * scale;
        const y = Math.sin(a) * R * 0.3 * scale;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = rgba(tone, 0.06 + 0.12 * mag);
      ctx.fill();
      ctx.strokeStyle = rgba(tone, 0.7 + 0.2 * mag);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();

      const axis = Math.round(h - 16) + 0.5;
      ctx.strokeStyle = "rgba(239, 238, 231, 0.09)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, axis);
      ctx.lineTo(w, axis);
      ctx.stroke();
      ctx.beginPath();
      for (let x = 12; x < w; x += 26) {
        ctx.moveTo(x, axis - 2);
        ctx.lineTo(x, axis + 2);
      }
      ctx.stroke();

      const mx = Math.max(6, Math.min(w - 6, cx + (energy * w) / 2.8));
      ctx.fillStyle = rgba(tone, 0.9);
      ctx.beginPath();
      ctx.moveTo(mx, axis - 5);
      ctx.lineTo(mx + 4, axis);
      ctx.lineTo(mx, axis + 5);
      ctx.lineTo(mx - 4, axis);
      ctx.closePath();
      ctx.fill();
    }

    function frame(now) {
      const dt = Math.min(48, now - last) || 16;
      last = now;
      if (hold > 0) hold -= dt;
      else target *= Math.pow(0.86, dt / 16);
      energy += (target - energy) * (1 - Math.pow(0.82, dt / 16));
      const mag = Math.min(1, Math.abs(energy));
      rings += (0.004 + 0.02 * mag) * (energy < 0 ? -1 : 1) * (dt / 16);
      core += (0.006 + 0.03 * mag) * (energy < 0 ? 1 : -1) * (dt / 16);
      sweep += (0.012 + 0.05 * mag) * (dt / 16);
      for (let i = 0; i < dust.length; i += 1) {
        const p = dust[i];
        p.a += p.spin * (0.0016 + 0.008 * mag) * (energy < 0 ? 1 : -1) * (dt / 16);
      }
      paint();
      raf = requestAnimationFrame(frame);
    }

    function nudge(delta) {
      const step = Math.sign(delta) || 1;
      hold = HOLD;
      target = Math.max(-1, Math.min(1, target + step * STEP));
      if (reduced) {
        energy = target;
        paint();
      }
    }

    const onWheel = (event) => nudge(event.deltaY);
    const onDown = (event) => {
      touchY = event.touches[0].clientY;
    };
    const onMove = (event) => {
      const y = event.touches[0].clientY;
      if (touchY !== null) nudge(y - touchY);
      touchY = y;
    };
    const onUp = () => {
      touchY = null;
    };

    scope.addEventListener("wheel", onWheel, { passive: true, signal: abort.signal });
    scope.addEventListener("touchstart", onDown, { passive: true, signal: abort.signal });
    scope.addEventListener("touchmove", onMove, { passive: true, signal: abort.signal });
    scope.addEventListener("touchend", onUp, { passive: true, signal: abort.signal });

    const ro = new ResizeObserver(resize);
    ro.observe(band);

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          if (!reduced && !raf) {
            last = performance.now();
            raf = requestAnimationFrame(frame);
          }
        } else if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { rootMargin: "140px" },
    );
    io.observe(band);

    const instance = {
      destroy() {
        abort.abort();
        ro.disconnect();
        io.disconnect();
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        if (live === instance) live = null;
      },
    };
    live = instance;

    requestAnimationFrame(resize);
    return band;
  }

  window.CoreBand = { attach };
})();
