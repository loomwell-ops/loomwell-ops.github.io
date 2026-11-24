/* ==========================================================================
   LOOMWELL OPS — SPATIAL GLASS & WEBGL CAUSTIC ENGINE (Zero Dependencies)
   ========================================================================== */
(function () {
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hoverCapable = window.matchMedia && window.matchMedia("(hover: hover)").matches;
  var pulseLevel = 0;

  function triggerPulse(amount) {
    pulseLevel = Math.min(1.6, pulseLevel + (amount || 0.75));
  }

  /* ------------------------------------------------------------------------
     1. Full-Viewport WebGL1 GLSL Caustic Light Shader
     ------------------------------------------------------------------------ */
  function initCausticShader() {
    if (reduced) return;
    var canvas = document.createElement("canvas");
    canvas.id = "caustic-gl";
    canvas.setAttribute("aria-hidden", "true");
    document.body.insertBefore(canvas, document.body.firstChild);

    var gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power" }) ||
             canvas.getContext("experimental-webgl");
    if (!gl) { canvas.remove(); return; }

    var vsSrc = [
      "attribute vec2 a_pos;",
      "void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }"
    ].join("\n");

    var fsSrc = [
      "precision mediump float;",
      "uniform vec2 u_res;",
      "uniform float u_time;",
      "uniform vec2 u_mouse;",
      "uniform float u_dark;",
      "uniform float u_pulse;",
      "float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }",
      "float noise(vec2 p){",
      "  vec2 i = floor(p); vec2 f = fract(p);",
      "  vec2 u = f*f*(3.0 - 2.0*f);",
      "  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),",
      "             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);",
      "}",
      "float fbm(vec2 p){",
      "  float v = 0.0; float a = 0.5;",
      "  mat2 m = mat2(0.80, 0.60, -0.60, 0.80);",
      "  for(int i=0; i<4; i++){ v += a * noise(p); p = m * p * 2.02; a *= 0.5; }",
      "  return v;",
      "}",
      "void main(){",
      "  vec2 uv = gl_FragCoord.xy / u_res;",
      "  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);",
      "  vec2 m = (u_mouse - 0.5) * 0.45;",
      "  float t = u_time * 0.14;",
      "  vec2 q = vec2(fbm(p * 1.45 + vec2(t, -t * 0.7) + m * 0.6),",
      "                fbm(p * 1.45 + vec2(-t * 0.8, t * 0.9) + vec2(5.2, 1.3)));",
      "  float f = fbm(p * 1.85 + 2.1 * q + vec2(t * 0.5, -t * 0.4));",
      "  float ridge = 1.0 - abs(f * 2.0 - 1.0);",
      "  float caustic = pow(clamp(ridge, 0.0, 1.0), 3.6);",
      "  float glow = smoothstep(0.25, 0.92, f) * 0.55 + caustic * (0.68 + u_pulse * 0.35);",
      "  float distM = length(uv - u_mouse);",
      "  float mouseAura = exp(-distM * 3.4) * (0.18 + u_pulse * 0.16);",
      "  vec3 dBase   = vec3(0.068, 0.058, 0.155);",
      "  vec3 dIndigo = vec3(0.320, 0.270, 0.860);",
      "  vec3 dCoral  = vec3(0.950, 0.540, 0.390);",
      "  vec3 dGold   = vec3(0.953, 0.780, 0.420);",
      "  vec3 darkCol = mix(dBase, dIndigo, clamp(glow * 0.72 + mouseAura, 0.0, 1.0));",
      "  darkCol = mix(darkCol, dCoral, clamp(caustic * q.x * (0.72 + u_pulse * 0.3), 0.0, 1.0));",
      "  darkCol += dGold * pow(caustic, 2.2) * (0.16 + u_pulse * 0.14);",
      "  vec3 lBase   = vec3(0.965, 0.961, 0.992);",
      "  vec3 lLav    = vec3(0.840, 0.820, 0.985);",
      "  vec3 lPeach  = vec3(0.988, 0.878, 0.835);",
      "  vec3 lightCol = mix(lBase, lLav, clamp(glow * 0.58 + mouseAura * 0.65, 0.0, 1.0));",
      "  lightCol = mix(lightCol, lPeach, clamp(caustic * q.y * (0.52 + u_pulse * 0.25), 0.0, 1.0));",
      "  vec3 col = mix(lightCol, darkCol, u_dark);",
      "  gl_FragColor = vec4(col, 1.0);",
      "}"
    ].join("\n");

    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    }
    var vs = compile(gl.VERTEX_SHADER, vsSrc);
    var fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) { canvas.remove(); return; }

    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return; }

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "a_pos");
    gl.useProgram(prog);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var uRes = gl.getUniformLocation(prog, "u_res");
    var uTime = gl.getUniformLocation(prog, "u_time");
    var uMouse = gl.getUniformLocation(prog, "u_mouse");
    var uDark = gl.getUniformLocation(prog, "u_dark");
    var uPulse = gl.getUniformLocation(prog, "u_pulse");

    document.documentElement.classList.add("has-gl");

    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    function resize() {
      canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr * 0.72));
      canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr * 0.72));
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    window.addEventListener("resize", resize);

    var mx = 0.72, my = 0.72, tx = 0.72, ty = 0.72;
    window.addEventListener("pointermove", function (e) {
      tx = e.clientX / Math.max(1, window.innerWidth);
      ty = 1.0 - e.clientY / Math.max(1, window.innerHeight);
    }, { passive: true });

    var isDark = function () { return document.documentElement.getAttribute("data-theme") === "dark" ? 1.0 : 0.0; };
    var darkVal = isDark();
    var startT = performance.now();
    var raf = null;

    function frame(now) {
      if (document.hidden) { raf = null; return; }
      mx += (tx - mx) * 0.05;
      my += (ty - my) * 0.05;
      darkVal += (isDark() - darkVal) * 0.08;
      pulseLevel *= 0.94;
      if (pulseLevel < 0.002) pulseLevel = 0;

      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (now - startT) * 0.001);
      gl.uniform2f(uMouse, mx, my);
      gl.uniform1f(uDark, darkVal);
      gl.uniform1f(uPulse, pulseLevel);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(frame);
    }
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && !raf) raf = requestAnimationFrame(frame);
    });
    raf = requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------------
     2. Floating Spatial Glass Bottom Dock + WAAPI Liquid-Elastic Pill
     ------------------------------------------------------------------------ */
  function initDock() {
    var nav = document.querySelector("nav[aria-label='Primary']");
    if (!nav) return;
    nav.classList.add("dock");
    document.body.classList.add("has-dock");

    var bar = nav.querySelector("div");
    if (!bar) return;
    var pill = document.createElement("span");
    pill.className = "dock-pill";
    pill.setAttribute("aria-hidden", "true");
    bar.insertBefore(pill, bar.firstChild);

    var lastRect = null;
    function moveDockPill(animate) {
      var active = bar.querySelector("a.on");
      if (!active) {
        pill.classList.remove("ready");
        return;
      }
      var x = active.offsetLeft, y = active.offsetTop, w = active.offsetWidth, h = active.offsetHeight;
      var from = lastRect;
      lastRect = { x: x, y: y, w: w, h: h };
      pill.classList.add("ready");
      pill.getAnimations().forEach(function (a) { a.cancel(); });
      pill.style.width = w + "px";
      pill.style.height = h + "px";
      pill.style.transform = "translate(" + x + "px," + y + "px)";
      if (!animate || !from || reduced || !pill.animate || (from.x === x && from.w === w)) return;
      var sx = Math.min(x, from.x);
      var sw = Math.max(x + w, from.x + from.w) - sx;
      pill.animate([
        { transform: "translate(" + from.x + "px," + y + "px)", width: from.w + "px", easing: "cubic-bezier(.2,.9,.3,1)" },
        { transform: "translate(" + sx + "px," + y + "px)", width: sw + "px", offset: 0.4, easing: "cubic-bezier(.34,1.45,.64,1)" },
        { transform: "translate(" + x + "px," + y + "px)", width: w + "px" }
      ], { duration: 480 });
    }

    if ("MutationObserver" in window) {
      new MutationObserver(function () { moveDockPill(true); }).observe(bar, {
        subtree: true, attributes: true, attributeFilter: ["class"]
      });
    }
    window.addEventListener("resize", function () { moveDockPill(false); });
    window.addEventListener("load", function () { moveDockPill(false); });
    setTimeout(function () { moveDockPill(false); }, 120);

    var themeBtn = document.getElementById("theme");
    if (themeBtn) themeBtn.addEventListener("click", function () { triggerPulse(1.0); });
  }

  /* ------------------------------------------------------------------------
     3. Live-Executing SVG Automation Pipeline (.pipe)
     ------------------------------------------------------------------------ */
  function initLivePipeline() {
    var pipe = document.querySelector("ol.pipe");
    if (!pipe) return;
    var wrap = document.createElement("div");
    wrap.className = "pipe-wrap";
    pipe.parentNode.insertBefore(wrap, pipe);
    wrap.appendChild(pipe);

    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", "pipe-svg");
    svg.setAttribute("aria-hidden", "true");
    wrap.insertBefore(svg, pipe);

    function drawTrack() {
      var items = [].slice.call(pipe.children);
      if (items.length < 2 || window.innerWidth <= 640) { svg.innerHTML = ""; return; }
      var wr = wrap.getBoundingClientRect();
      var pts = items.map(function (li) {
        var r = li.getBoundingClientRect();
        return { x: r.left - wr.left + r.width / 2, y: r.top - wr.top + r.height / 2 };
      });
      var d = "M " + pts[0].x.toFixed(1) + " " + pts[0].y.toFixed(1);
      for (var i = 1; i < pts.length; i++) {
        d += " L " + pts[i].x.toFixed(1) + " " + pts[i].y.toFixed(1);
      }
      svg.setAttribute("viewBox", "0 0 " + Math.max(1, wr.width).toFixed(0) + " " + Math.max(1, wr.height).toFixed(0));
      svg.innerHTML =
        '<defs><linearGradient id="pipeGrad" x1="0%" y1="0%" x2="100%" y2="0%">' +
        '<stop offset="0%" stop-color="#9c93ff"/><stop offset="55%" stop-color="#ff9a76"/><stop offset="100%" stop-color="#f3c76b"/>' +
        '</linearGradient></defs>' +
        '<path class="pipe-track-base" d="' + d + '"/>' +
        '<path class="pipe-track-glow" d="' + d + '"/>';
    }

    drawTrack();
    window.addEventListener("resize", drawTrack);
    window.addEventListener("load", drawTrack);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawTrack);
    pipe.addEventListener("click", function () { triggerPulse(0.65); });
  }

  /* ------------------------------------------------------------------------
     4. 3D Perspective Tilt + Cursor-Tracked Holographic Glare
     ------------------------------------------------------------------------ */
  function init3DTilt() {
    if (!hoverCapable || reduced) return;
    var selector = ".bento > div, .tiers li, .proj, .quotes blockquote, .callout, .grid.steps > div";
    var cards = [].slice.call(document.querySelectorAll(selector));
    var notFoundMain = document.querySelector("body > main:only-of-type");
    if (notFoundMain && !document.getElementById("main") && !document.getElementById("design")) {
      cards.push(notFoundMain);
    }
    cards.forEach(function (el) { el.classList.add("tilt-card"); });

    var active = null;
    document.addEventListener("pointermove", function (e) {
      var card = e.target.closest && e.target.closest(".tilt-card");
      if (active && active !== card) {
        active.style.removeProperty("--rx");
        active.style.removeProperty("--ry");
        active = null;
      }
      if (!card) return;
      active = card;
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / Math.max(1, r.width);
      var py = (e.clientY - r.top) / Math.max(1, r.height);
      var maxDeg = card.classList.contains("proj") ? 3.2 : 5.5;
      card.style.setProperty("--rx", ((0.5 - py) * maxDeg * 2).toFixed(2) + "deg");
      card.style.setProperty("--ry", ((px - 0.5) * maxDeg * 2).toFixed(2) + "deg");
      card.style.setProperty("--mx", (e.clientX - r.left).toFixed(1) + "px");
      card.style.setProperty("--my", (e.clientY - r.top).toFixed(1) + "px");
    }, { passive: true });
  }

  /* ------------------------------------------------------------------------
     5. 60-Tick Animated SVG Radial Gauge inside #roi
     ------------------------------------------------------------------------ */
  function initRoiGauge60() {
    var svg = document.querySelector("#roi .cviz svg");
    var liftInput = document.getElementById("c-lift");
    if (!svg || !liftInput) return;

    svg.setAttribute("viewBox", "-14 -14 148 148");
    svg.setAttribute("width", "140");
    svg.setAttribute("height", "140");

    var ns = "http://www.w3.org/2000/svg";
    var g = document.createElementNS(ns, "g");
    g.setAttribute("class", "roi-ticks");
    var ticks = [];
    for (var i = 0; i < 60; i++) {
      var angle = (-90 + i * 6) * Math.PI / 180;
      var r1 = i % 5 === 0 ? 59 : 61;
      var r2 = 66;
      var line = document.createElementNS(ns, "line");
      line.setAttribute("x1", (60 + r1 * Math.cos(angle)).toFixed(2));
      line.setAttribute("y1", (60 + r1 * Math.sin(angle)).toFixed(2));
      line.setAttribute("x2", (60 + r2 * Math.cos(angle)).toFixed(2));
      line.setAttribute("y2", (60 + r2 * Math.sin(angle)).toFixed(2));
      line.setAttribute("stroke-width", i % 5 === 0 ? "2" : "1.25");
      line.setAttribute("stroke-linecap", "round");
      line.setAttribute("class", "roi-gauge-tick");
      g.appendChild(line);
      ticks.push(line);
    }
    svg.insertBefore(g, svg.firstChild);

    function syncTicks() {
      var val = parseFloat(liftInput.value) || 0;
      var lit = Math.round((val / 30) * 60);
      ticks.forEach(function (ln, idx) {
        ln.classList.remove("on", "hot", "gold");
        if (idx < lit) {
          ln.classList.add(idx > 44 ? "gold" : (idx > 24 ? "hot" : "on"));
        }
      });
    }
    liftInput.addEventListener("input", function () { syncTicks(); triggerPulse(0.25); });
    syncTicks();
  }

  /* ------------------------------------------------------------------------
     6. VERSO Diagonal-Seam Light Beam + Replaying Telemetry Sweeps
     ------------------------------------------------------------------------ */
  function initVersoAndTelemetry() {
    var cta = document.querySelector(".cta-card");
    if (cta) {
      var beam = document.createElement("span");
      beam.className = "verso-beam";
      beam.setAttribute("aria-hidden", "true");
      cta.appendChild(beam);
      var mainBtn = cta.querySelector(".btn.main");
      if (mainBtn) {
        mainBtn.addEventListener("mouseenter", function () {
          cta.classList.remove("beam-go");
          void cta.offsetWidth;
          cta.classList.add("beam-go");
          triggerPulse(0.8);
        });
      }
    }

    // Replay staggered bar sweep whenever Sample Report tabs switch
    var rtabs = [].slice.call(document.querySelectorAll(".rtabs [role=tab]"));
    rtabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        triggerPulse(0.55);
        var panel = document.getElementById(tab.getAttribute("aria-controls"));
        if (!panel || reduced) return;
        var chart = panel.querySelector(".funnel, .cols");
        if (!chart) return;
        chart.classList.remove("go");
        chart.classList.add("pre");
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { chart.classList.add("go"); });
        });
      });
    });

    // Pulse phone + caustic shader when visitor tests automation events
    var simb = document.getElementById("simb");
    var phone = document.querySelector(".phone");
    if (simb) {
      simb.addEventListener("click", function (e) {
        if (!e.target.closest("button")) return;
        triggerPulse(0.85);
        if (phone) {
          phone.classList.add("pulse");
          clearTimeout(phone._pt);
          phone._pt = setTimeout(function () { phone.classList.remove("pulse"); }, 900);
        }
      });
    }
  }

  function boot() {
    initCausticShader();
    initDock();
    initLivePipeline();
    init3DTilt();
    initRoiGauge60();
    initVersoAndTelemetry();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
