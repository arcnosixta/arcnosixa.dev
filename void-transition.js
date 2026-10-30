(() => {
  "use strict";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const links = document.querySelectorAll("[data-void-enter], [data-void-return]");
  if (!links.length) return;
  const veil = document.createElement("div");
  veil.className = "void-veil";
  veil.setAttribute("aria-hidden", "true");
  document.body.append(veil);
  let navigating = false, timer;
  const get = (key) => { try { return sessionStorage.getItem(key); } catch { return null; } };
  const set = (key, value) => { try { sessionStorage.setItem(key, value); } catch { /* Navigation still works. */ } };
  const clear = (key) => { try { sessionStorage.removeItem(key); } catch { /* optional */ } };

  if (get("arc-void-arrival")) {
    clear("arc-void-arrival");
    if (!reduced.matches) {
      veil.classList.add("is-arriving");
      veil.addEventListener("animationend", () => veil.classList.remove("is-arriving"), { once: true });
    }
  }
  links.forEach((link) => {
    if (link.hasAttribute("data-void-return")) {
      const expected = new URL(link.href);
      try {
        const saved = new URL(get("arc-void-home"));
        if (saved.origin === expected.origin && [expected.pathname, `${expected.pathname}index.html`].includes(saved.pathname)) link.href = saved.href;
      } catch { /* A direct /fate/ visit returns to the default portfolio. */ }
    }
    link.addEventListener("click", (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (navigating) return;
      navigating = true;
      const returning = link.hasAttribute("data-void-return");
      if (!returning) set("arc-void-home", location.href);
      else set("arc-void-return", "1");
      window.FateAudio?.fadeOut();
      set("arc-void-arrival", "1");
      const go = () => location.assign(link.href);
      if (reduced.matches) { go(); return; }
      veil.classList.add("is-travelling");
      veil.classList.toggle("is-returning", returning);
      timer = setTimeout(go, 1190);
    });
  });
  if (matchMedia("(pointer: fine)").matches && !reduced.matches && window.gsap) {
    document.querySelectorAll(".void-entry").forEach((link) => {
      const x = gsap.quickTo(link, "x", { duration: .5, ease: "power3.out" });
      const y = gsap.quickTo(link, "y", { duration: .5, ease: "power3.out" });
      link.addEventListener("pointermove", (event) => {
        if (reduced.matches) return;
        const bounds = link.getBoundingClientRect();
        x((event.clientX - bounds.left - bounds.width / 2) * .07);
        y((event.clientY - bounds.top - bounds.height / 2) * .12);
      });
      link.addEventListener("pointerleave", () => { x(0); y(0); });
    });
  }
  window.addEventListener("pagehide", () => { clearTimeout(timer); });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) { navigating = false; veil.className = "void-veil"; clear("arc-void-arrival"); }
  });
})();
