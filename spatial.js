/* ==========================================================================
   LOOMWELL OPS — SPATIAL GLASS DECK & CAUSTIC ENGINE (v4, Zero Deps)
   ========================================================================== */
(function () {
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hoverCapable = window.matchMedia && window.matchMedia("(hover: hover)").matches;
  var pulseLevel = 0;

  function triggerPulse(amount) {
    pulseLevel = Math.min(1.4, pulseLevel + (amount || 0.7));
  }

  /* ------------------------------------------------------------------------
     1. Ultra-Light Full-Viewport WebGL1 Caustic Shader (Capped 512px, 30fps)
     ------------------------------------------------------------------------ */
  function initCausticShader() {
    if (reduced) return;
    var canvas = document.createElement("canvas");
    canvas.id = "caustic-gl";
    canvas.setAttribute("aria-hidden", "true");
    document.body.insertBefore(canvas, document.body.firstChild);

    var gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
    if (!gl) { canvas.remove(); return; }

    var vsSrc = "attribute vec2 a_pos; void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }";
    var fsSrc = [
      "precision mediump float;",
      "uniform vec2 u_res;",
      "uniform float u_time;",
      "uniform vec2 u_mouse;",
      "uniform float u_dark;",
      "uniform float u_pulse;",
      "void main(){",
      "  vec2 uv = gl_FragCoord.xy / u_res;",
      "  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);",
      "  vec2 m = (u_mouse - 0.5) * 0.35;",
      "  float t = u_time * 0.28;",
      "  vec2 q = p * 2.1 + m;",
      "  float w1 = sin(q.x * 1.4 + t + cos(q.y * 1.6 - t * 0.7));",
      "  float w2 = cos(q.y * 1.5 - t * 0.8 + sin(q.x * 1.3 + t * 0.6));",
      "  float w3 = sin((q.x + q.y) * 1.2 - t * 0.5 + w1 * 0.9);",
      "  float ridge = 1.0 - abs(w1 * 0.45 + w2 * 0.35 + w3 * 0.2);",
      "  float caustic = pow(clamp(ridge, 0.0, 1.0), 3.2);",
      "  float glow = smoothstep(-0.4, 0.9, w1 * 0.5 + w2 * 0.5) * 0.45 + caustic * (0.62 + u_pulse * 0.32);",
      "  float mouseAura = exp(-length(uv - u_mouse) * 3.2) * (0.18 + u_pulse * 0.14);",
      "  vec3 dBase   = vec3(0.068, 0.058, 0.155);",
      "  vec3 dIndigo = vec3(0.320, 0.270, 0.860);",
      "  vec3 dCoral  = vec3(0.950, 0.540, 0.390);",
      "  vec3 dGold   = vec3(0.953, 0.780, 0.420);",
      "  vec3 darkCol = mix(dBase, dIndigo, clamp(glow * 0.68 + mouseAura, 0.0, 1.0));",
      "  darkCol = mix(darkCol, dCoral, clamp(caustic * (0.55 + 0.35 * sin(t + p.x)) * (0.7 + u_pulse * 0.3), 0.0, 1.0));",
      "  darkCol += dGold * pow(caustic, 2.5) * (0.14 + u_pulse * 0.12);",
      "  vec3 lBase   = vec3(0.965, 0.961, 0.992);",
      "  vec3 lLav    = vec3(0.840, 0.820, 0.985);",
      "  vec3 lPeach  = vec3(0.988, 0.878, 0.835);",
      "  vec3 lightCol = mix(lBase, lLav, clamp(glow * 0.55 + mouseAura * 0.6, 0.0, 1.0));",
      "  lightCol = mix(lightCol, lPeach, clamp(caustic * 0.45, 0.0, 1.0));",
      "  gl_FragColor = vec4(mix(lightCol, darkCol, u_dark), 1.0);",
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
    canvas.addEventListener("webglcontextlost", function (e) {
      e.preventDefault();
      document.documentElement.classList.remove("has-gl");
      canvas.remove();
    });

    function resize() {
      var w = Math.min(512, Math.max(240, Math.floor(window.innerWidth * 0.35)));
      var h = Math.min(360, Math.max(160, Math.floor(window.innerHeight * 0.35)));
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
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
    var lastFrame = 0;
    var raf = null;

    function frame(now) {
      if (document.hidden) { raf = null; return; }
      if (now - lastFrame >= 33) {
        lastFrame = now;
        mx += (tx - mx) * 0.08;
        my += (ty - my) * 0.08;
        darkVal += (isDark() - darkVal) * 0.12;
        pulseLevel *= 0.92;
        if (pulseLevel < 0.002) pulseLevel = 0;

        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uTime, (now - startT) * 0.001);
        gl.uniform2f(uMouse, mx, my);
        gl.uniform1f(uDark, darkVal);
        gl.uniform1f(uPulse, pulseLevel);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      raf = requestAnimationFrame(frame);
    }
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && !raf) raf = requestAnimationFrame(frame);
    });
    raf = requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------------
     2. Spatial 5-View App Deck + Top Stepper + Highlighted "UP NEXT" Card
     ------------------------------------------------------------------------ */
  function initSpatialDeck() {
    var main = document.getElementById("main");
    var nav = document.querySelector("nav[aria-label='Primary']");
    if (!main || !nav) return false;

    var bar = nav.querySelector("div");
    if (!bar) return false;

    var deckDefs = [
      {
        id: "overview",
        label: "Overview",
        nextId: "case-study",
        nextTitle: "Case Study & Live Automation Simulator",
        nextSub: "See the Fit Body Boot Camp funnel, weekly metrics, and test the interactive SMS/email sequences.",
        ctaText: "Explore Case Study"
      },
      {
        id: "case-study",
        label: "Case study",
        nextId: "services",
        nextTitle: "Services, Pricing & ROI Calculator",
        nextSub: "Compare the 3 ways to start, calculate your follow-up revenue gap, or request a free mini audit.",
        ctaText: "See Services & ROI"
      },
      {
        id: "services",
        label: "Services",
        nextId: "projects",
        nextTitle: "Live Web Apps, Design & Social Media Work",
        nextSub: "Try the Content Calendar, Job Tracker, Budget Tracker, and CRM live—plus brand boards & videos.",
        ctaText: "View Projects & Work"
      },
      {
        id: "projects",
        label: "Projects & Work",
        nextId: "contact",
        nextTitle: "Experience, Tools, FAQ & Book a Call",
        nextSub: "Review work history, 30+ tools, working hours, and book a 30-minute intro call.",
        ctaText: "About & Contact"
      },
      {
        id: "contact",
        label: "Contact",
        nextId: "overview",
        nextTitle: "Back to Portfolio Overview",
        nextSub: "Return to the top summary, live pipeline, and core capabilities.",
        ctaText: "Back to Overview"
      }
    ];

    var decks = {};
    deckDefs.forEach(function (d) {
      var wrap = document.createElement("div");
      wrap.className = "deck-view";
      wrap.id = "deck-" + d.id;
      wrap.dataset.deck = d.id;
      decks[d.id] = wrap;
    });

    function bucketFor(el) {
      var id = el.id || "";
      if (el.tagName === "HEADER" || el.classList.contains("pipe") || el.classList.contains("pipe-wrap") ||
          id === "pd" || el.classList.contains("cap") || id === "clients" || el.classList.contains("duo") ||
          id === "intro" || id === "work") return "overview";
      if (id === "case-study" || id === "proof") return "case-study";
      if (id === "calculator" || id === "services") return "services";
      if (id === "design" || id === "projects" || id === "my-work") return "projects";
      if (id === "experience" || id === "hub" || id === "contact") return "contact";
      return null;
    }

    var children = [].slice.call(main.children);
    children.forEach(function (el) {
      if (el.tagName === "DIALOG") return;
      var b = bucketFor(el);
      if (b && decks[b]) decks[b].appendChild(el);
    });

    // Top Quick-Jump Stepper Bar (so visitors immediately see all 5 portfolio sections)
    var stepper = document.createElement("div");
    stepper.className = "deck-stepper";
    stepper.setAttribute("role", "navigation");
    stepper.setAttribute("aria-label", "Portfolio sections");
    var stepBtns = {};
    deckDefs.forEach(function (d, idx) {
      var sb = document.createElement("button");
      sb.type = "button";
      sb.dataset.deck = d.id;
      sb.innerHTML = '<em>0' + (idx + 1) + '</em>' + d.label;
      stepper.appendChild(sb);
      stepBtns[d.id] = sb;
    });
    main.insertBefore(stepper, main.firstChild);

    // Insert decks + High-Contrast "UP NEXT" Spotlight Banner on every view
    var roiDialog = document.getElementById("roi");
    deckDefs.forEach(function (d, idx) {
      var foot = document.createElement("div");
      foot.className = "deck-foot";
      foot.dataset.go = d.nextId;

      var segs = deckDefs.map(function (item, sIdx) {
        var cls = sIdx === idx ? "now" : (sIdx < idx ? "done" : "");
        return '<button type="button" class="' + cls + '" data-jump="' + item.id + '" aria-label="Go to ' + item.label + '" title="' + item.label + '"></button>';
      }).join("");

      var nextNum = ((idx + 1) % deckDefs.length) + 1;
      foot.innerHTML =
        '<div class="deck-foot-info">' +
          '<span class="deck-eyebrow">Up Next · Section 0' + nextNum + ' of 0' + deckDefs.length + '</span>' +
          '<div class="deck-next-title">' + d.nextTitle + '</div>' +
          '<div class="deck-next-sub">' + d.nextSub + '</div>' +
          '<div class="deck-prog" aria-label="Portfolio progress">' + segs + '</div>' +
        '</div>' +
        '<button type="button" class="deck-next" data-go="' + d.nextId + '">' + d.ctaText + ' <span class="arr" aria-hidden="true">→</span></button>';

      decks[d.id].appendChild(foot);
      if (roiDialog) main.insertBefore(decks[d.id], roiDialog);
      else main.appendChild(decks[d.id]);
    });

    document.body.classList.add("deck-mode");
    nav.classList.add("dock");
    document.body.classList.add("has-dock");

    var cta = bar.querySelector("a.cta");
    var themeBtn = document.getElementById("theme");
    [].slice.call(bar.querySelectorAll("a:not(.cta)")).forEach(function (a) { a.remove(); });

    var pill = document.createElement("span");
    pill.className = "dock-pill";
    pill.setAttribute("aria-hidden", "true");
    bar.insertBefore(pill, bar.firstChild);

    var tabBtns = {};
    deckDefs.forEach(function (d) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dock-tab";
      btn.dataset.deck = d.id;
      btn.textContent = d.label;
      bar.insertBefore(btn, cta || themeBtn);
      tabBtns[d.id] = btn;
    });

    var lastRect = null;
    var currentDeck = null;

    function movePill(btn, animate) {
      if (!btn) return;
      var x = btn.offsetLeft, y = btn.offsetTop, w = btn.offsetWidth, h = btn.offsetHeight;
      var from = lastRect;
      lastRect = { x: x, y: y, w: w, h: h };
      pill.classList.add("ready");
      if (pill.getAnimations) pill.getAnimations().forEach(function (a) { a.cancel(); });
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

    function showDeck(id, animate, scrollTarget) {
      if (!decks[id]) id = "overview";
      var changed = currentDeck !== id;
      currentDeck = id;
      var curDef = deckDefs.filter(function (d) { return d.id === id; })[0];
      var nextId = curDef ? curDef.nextId : null;

      Object.keys(decks).forEach(function (k) {
        var on = k === id;
        decks[k].hidden = !on;
        decks[k].classList.toggle("deck-active", on);
        if (on) {
          [].slice.call(decks[k].querySelectorAll("section.rv")).forEach(function (s) {
            s.classList.add("in");
          });
        }
      });

      Object.keys(tabBtns).forEach(function (k) {
        var on = k === id;
        tabBtns[k].classList.toggle("on", on);
        tabBtns[k].classList.toggle("is-next", k === nextId && id !== "contact");
        tabBtns[k].setAttribute("aria-current", on ? "page" : "false");
        if (stepBtns[k]) {
          stepBtns[k].classList.toggle("on", on);
          stepBtns[k].setAttribute("aria-current", on ? "page" : "false");
        }
      });

      movePill(tabBtns[id], animate && changed);
      if (changed) triggerPulse(0.75);

      if (scrollTarget) {
        setTimeout(function () { scrollTarget.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }); }, 60);
      } else if (changed) {
        window.scrollTo({ top: 0, behavior: "instant" });
      }
      requestAnimationFrame(function () { window.dispatchEvent(new Event("resize")); });
    }

    // Wire dock clicks, top stepper clicks, brand click, and UP NEXT card clicks
    bar.addEventListener("click", function (e) {
      var b = e.target.closest(".dock-tab");
      if (b) showDeck(b.dataset.deck, true);
    });
    stepper.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-deck]");
      if (b) showDeck(b.dataset.deck, true);
    });
    var brand = nav.querySelector("b");
    if (brand) brand.addEventListener("click", function () { showDeck("overview", true); });

    main.addEventListener("click", function (e) {
      var seg = e.target.closest(".deck-prog button[data-jump]");
      if (seg) { e.stopPropagation(); showDeck(seg.dataset.jump, true); return; }
      var nextBtn = e.target.closest(".deck-next[data-go]");
      if (nextBtn) { e.stopPropagation(); showDeck(nextBtn.dataset.go, true); return; }
      var foot = e.target.closest(".deck-foot");
      if (foot && foot.dataset.go) { showDeck(foot.dataset.go, true); }
    });

    document.addEventListener("keydown", function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      var idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < deckDefs.length) showDeck(deckDefs[idx].id, true);
    });

    function routeHash(hash) {
      var id = (hash || "").replace(/^#/, "");
      if (!id || id === "top") { showDeck("overview", true); return true; }
      if (decks[id]) { showDeck(id, true); return true; }
      var target = document.getElementById(id);
      if (!target) return false;
      var parentDeck = target.closest(".deck-view");
      if (parentDeck) {
        showDeck(parentDeck.dataset.deck, true, null);
        // Activate matching tabpanel if target is a project or hub tab
        var tab = document.querySelector('[role="tab"][aria-controls="' + id + '"]');
        if (tab) tab.click();
        // Auto-open work fold if jumping to #my-work
        if (id === "my-work") {
          var wf = document.getElementById("work-fold");
          if (wf) wf.open = true;
        }
        setTimeout(function () {
          var scrollEl = tab ? (tab.closest(".split, #hub") || target) : target;
          scrollEl.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
        }, 70);
        return true;
      }
      return false;
    }

    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var href = a.getAttribute("href");
      // Close ROI modal if link is inside it (e.g. "Request a free audit")
      var openDlg = a.closest && a.closest("dialog[open]");
      if (openDlg && openDlg.close) openDlg.close();
      if (routeHash(href)) e.preventDefault();
    }, true);

    window.addEventListener("hashchange", function () {
      if (location.hash) routeHash(location.hash);
    });

    if (themeBtn) themeBtn.addEventListener("click", function () { triggerPulse(1.0); });
    window.addEventListener("resize", function () { movePill(tabBtns[currentDeck], false); });
    window.addEventListener("load", function () { movePill(tabBtns[currentDeck], false); });

    if (!location.hash || !routeHash(location.hash)) showDeck("overview", false);
    return true;
  }

  function initSimpleDock() {
    var nav = document.querySelector("nav[aria-label='Primary']");
    if (!nav || nav.classList.contains("dock")) return;
    nav.classList.add("dock");
    document.body.classList.add("has-dock");
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
      if (items.length < 2 || window.innerWidth <= 640 || wrap.offsetWidth === 0) { svg.innerHTML = ""; return; }
      var wr = wrap.getBoundingClientRect();
      var pts = items.map(function (li) {
        var r = li.getBoundingClientRect();
        return { x: r.left - wr.left + r.width / 2, y: r.top - wr.top + r.height / 2 };
      });
      var d = "M " + pts[0].x.toFixed(1) + " " + pts[0].y.toFixed(1);
      for (var i = 1; i < pts.length; i++) d += " L " + pts[i].x.toFixed(1) + " " + pts[i].y.toFixed(1);
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
     4. 3D Perspective Tilt + Holographic Glare + Magnetic CTA Buttons
     ------------------------------------------------------------------------ */
  function init3DTiltAndMagnetic() {
    if (!hoverCapable || reduced) return;
    var selector = ".bento > div, .tiers li, .quotes blockquote, .callout, .grid.steps > div";
    var cards = [].slice.call(document.querySelectorAll(selector));
    var notFoundMain = document.querySelector("body > main:only-of-type");
    if (notFoundMain && !document.getElementById("main") && !document.getElementById("design")) {
      cards.push(notFoundMain);
    }
    cards.forEach(function (el) { el.classList.add("tilt-card"); });

    var activeCard = null;

    document.addEventListener("pointermove", function (e) {
      // Never tilt while hovering interactive controls so clicks never miss
      if (e.target.closest && e.target.closest("a, button, input, summary, iframe, select, textarea")) {
        if (activeCard) {
          activeCard.style.removeProperty("--rx");
          activeCard.style.removeProperty("--ry");
          activeCard = null;
        }
        return;
      }
      var card = e.target.closest && e.target.closest(".tilt-card");
      if (activeCard && activeCard !== card) {
        activeCard.style.removeProperty("--rx");
        activeCard.style.removeProperty("--ry");
        activeCard = null;
      }
      if (card) {
        activeCard = card;
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / Math.max(1, r.width);
        var py = (e.clientY - r.top) / Math.max(1, r.height);
        var maxDeg = 4.0;
        card.style.setProperty("--rx", ((0.5 - py) * maxDeg * 2).toFixed(2) + "deg");
        card.style.setProperty("--ry", ((px - 0.5) * maxDeg * 2).toFixed(2) + "deg");
        card.style.setProperty("--mx", (e.clientX - r.left).toFixed(1) + "px");
        card.style.setProperty("--my", (e.clientY - r.top).toFixed(1) + "px");
      }
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
        if (idx < lit) ln.classList.add(idx > 44 ? "gold" : (idx > 24 ? "hot" : "on"));
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
    initLivePipeline();
    if (!initSpatialDeck()) initSimpleDock();
    init3DTiltAndMagnetic();
    initRoiGauge60();
    initVersoAndTelemetry();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
