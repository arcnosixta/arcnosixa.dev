/* Local visual QA fixture, excluded from the build. It operates the same source
   document and exposes repeatable scroll positions through ordinary controls. */
(() => {
  const frame = document.getElementById("preview");
  const mode = document.getElementById("mode");
  const metrics = document.getElementById("metrics");
  const report = document.getElementById("report");
  let interval;
  window.qaError = (message) => { report.textContent += `${message}\n`; };
  async function load() {
    clearInterval(interval);
    report.textContent = "";
    metrics.textContent = "Loading…";
    const response = await fetch("../fate/");
    let html = await response.text();
    const setup = `<base href="${new URL("../fate/", location.href).href}"><script>
      try{localStorage.removeItem('fate-still')}catch{}
      window.addEventListener('error',e=>parent.qaError(e.message));
      window.addEventListener('unhandledrejection',e=>parent.qaError(String(e.reason)));
      const err=console.error;console.error=(...args)=>{parent.qaError(args.join(' '));err(...args)};
      const audio=window.Audio;window.Audio=function(...args){const a=new audio(...args);window.qaAudio=a;return a};
      window.qaFPS=0;let start=performance.now(),n=0;function sample(t){n++;if(t-start>1800){window.qaFPS=Math.round(n*1000/(t-start));start=t;n=0}requestAnimationFrame(sample)}requestAnimationFrame(sample);
      ${mode.value === "reduced" ? "const mm=window.matchMedia;window.matchMedia=(q)=>q.includes('prefers-reduced-motion')?{matches:true,media:q,addEventListener(){},removeEventListener(){}}:mm.call(window,q);" : ""}
      ${mode.value === "no-webgl" ? "const gc=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return t.includes('webgl')?null:gc.call(this,t,...a)};" : ""}
      <\/script>`;
    html = html.replace("<head>", `<head>${setup}`);
    if (mode.value === "no-gsap") html = html.replace(/<script src="\.\.\/vendor\/(?:gsap|ScrollTrigger)\.min\.js"><\/script>/g, "");
    frame.srcdoc = html;
    frame.onload = () => {
      interval = setInterval(() => {
        const w = frame.contentWindow, d = frame.contentDocument;
        const audio = w.qaAudio;
        metrics.textContent = `${d.documentElement.className || 'static'} | ${w.innerWidth}×${w.innerHeight} | ${d.querySelector('.story-progress span')?.style.transform || '0'} | y${Math.round(w.scrollY)} / ${d.documentElement.scrollHeight} | ${w.qaFPS || '…'}fps | ${audio?.paused === false ? 'playing' : 'silent'} ${Math.round(audio?.currentTime || 0)}s`;
      }, 300);
    };
  }
  document.getElementById("load").addEventListener("click", load);
  document.querySelectorAll("[data-progress]").forEach(button => button.addEventListener("click", () => {
    const w = frame.contentWindow;
    w.scrollTo({ top: (frame.contentDocument.documentElement.scrollHeight - w.innerHeight) * Number(button.dataset.progress), behavior: "instant" });
  }));
  document.getElementById("lose-context").addEventListener("click", () => {
    const canvas = frame.contentDocument.querySelector("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  });
  load();
})();
