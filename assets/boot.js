/* LORERUFF-OS — pre-desktop life: CMOS, sounds, limine bootloader, kernel
   boot, suspend/resume. Design rule: every line printed is a real
   measurement or a real decision taken on this device. No theatre. */
(function () {
  "use strict";

  var docEl = document.documentElement;
  docEl.classList.add("preboot"); /* JS alive: only now overlays may show */

  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var revisiting = false;
  try { revisiting = !!sessionStorage.getItem("lros-boot"); } catch (e) {}
  var SKIP = reduced || revisiting;

  /* ---------- CMOS (real settings, persisted) ---------- */
  var CMOS_KEY = "lros-cmos";
  var cmos, checksumBad = false;
  try { cmos = JSON.parse(localStorage.getItem(CMOS_KEY) || "null"); } catch (e) {}
  /* shape check: a tampered value parsing to a non-object would crash the
     boot overlay later (cmos.boots++), self-DoS only, cheap to prevent */
  if (!cmos || typeof cmos !== "object" || Array.isArray(cmos)) cmos = null;
  if (!cmos) {
    /* empty storage = the battery was pulled (incognito). Say it. */
    checksumBad = true;
    cmos = { speaker: 1, scanline: 1, verbose: 0, boots: 0, last: null };
  }
  function saveCmos() {
    try { localStorage.setItem(CMOS_KEY, JSON.stringify(cmos)); } catch (e) {}
  }
  if (!cmos.scanline) docEl.classList.add("no-scan");
  /* dead CMOS battery: the clock starts behind, like on a real board */
  var drift = checksumBad ? 61000 + Math.floor(Math.random() * 45000) : 0;
  var lastLogin = cmos.last || null;

  /* ---------- kernel log ring ---------- */
  var DMESG = [];
  function klog(msg) { DMESG.push([performance.now() / 1000, msg]); }
  var LROS = window.LROS = {
    klog: klog,
    dmesg: function () {
      return DMESG.map(function (d) {
        return "[" + d[0].toFixed(6).padStart(12, " ") + "] " + d[1];
      });
    },
    cmos: cmos,
    saveCmos: saveCmos,
    setScanlines: function (v) { docEl.classList.toggle("no-scan", !v); },
    setTurbo: function (v) { docEl.classList.toggle("turbo", !!v); },
    lang: document.documentElement.lang || "en"
  };

  /* ---------- sound: square waves only, PC-speaker honesty ---------- */
  var actx = null;
  var silentBoot = false; /* this boot only (menu choice) */
  function sndOn() { return !!cmos.speaker && !silentBoot && actx; }
  function wave(type, freq, dur, gain, when) {
    if (!sndOn()) return;
    var t = (when || 0) + actx.currentTime;
    var o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  LROS.sound = {
    unlock: function () {
      if (!actx) { try { actx = new AudioContext(); } catch (e) {} }
      if (actx && actx.state === "suspended") actx.resume();
    },
    beep: function () { wave("square", 1000, 0.15, 0.07); },          /* POST */
    tick: function () { wave("square", 1200 + Math.random() * 400, 0.018, 0.02); },
    blip: function () { wave("square", 880, 0.04, 0.045); wave("square", 1320, 0.05, 0.045, 0.05); },
    jingle: function () {
      /* four chiptune notes, square waves, like a startup sound on 4-bit hardware */
      [392, 523, 659, 784].forEach(function (f, i) { wave("square", f, 0.12, 0.045, i * 0.12); });
    },
    buzz: function () { wave("sawtooth", 110, 0.16, 0.05); },
    chugga: function (n) {
      for (var i = 0; i < n; i++) wave("square", 90, 0.06, 0.05, i * 0.12);
    },
    enabled: sndOn
  };

  /* ---------- real probes ---------- */
  var nav = performance.getEntriesByType("navigation")[0];
  var parseMs = nav ? Math.max(0, nav.responseEnd - nav.startTime) : 0;
  var cores = navigator.hardwareConcurrency || "?";
  var mem = navigator.deviceMemory ? navigator.deviceMemory + "GB" : "n/a";
  var conn = (navigator.connection && navigator.connection.effectiveType) || "unknown";
  var sizes = { css: 0, js: 0, fonts: 0, total: 0, reqs: 0 };
  function readResources() {
    var entries = performance.getEntriesByType("resource");
    sizes.css = sizes.js = sizes.fonts = sizes.total = 0;
    sizes.reqs = entries.length;
    entries.forEach(function (e) {
      /* decodedBodySize is the payload (disk cache included). On a 304
         revalidation it is 0 while transferSize is just headers (~300B):
         counting those would report a fake 0.3 kB, so 0 => "cached" */
      var b = e.decodedBodySize || 0;
      sizes.total += b;
      if (e.name.indexOf("os.css") !== -1) sizes.css += b;
      else if (e.name.indexOf("boot.js") !== -1 || e.name.indexOf("cli.js") !== -1) sizes.js += b;
      else if (e.name.indexOf(".woff2") !== -1) sizes.fonts += b;
    });
  }
  try {
    new PerformanceObserver(function () { readResources(); })
      .observe({ type: "resource", buffered: true });
  } catch (e) { readResources(); }
  function kb(b) { return b ? (b / 1024).toFixed(1) + " kB" : "(…)"; }
  /* on a 304 revalidation decodedBodySize is 0: bytes live in the browser
     cache, so the honest label is "cached (304)", not a fake number */
  function sz(b) { return b ? kb(b) : "cached (304)"; }
  LROS.sizes = sizes; LROS.kb = kb; LROS.sz = sz;

  klog("LORERUFF-OS 1.0.0 kernel starting");
  if (checksumBad) klog("CMOS CHECKSUM BAD — DEFAULTS LOADED");

  /* ---------- uptime in the statusbar ---------- */
  var up0 = Date.now();
  setInterval(function () {
    var el = document.getElementById("uptime");
    if (!el) return;
    var s = Math.floor((Date.now() - up0) / 1000);
    el.textContent = "up " + Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }, 15000);

  /* ---------- receipt ---------- */
  function fillReceipt() {
    /* when css/js come from a 304 the total only counts wire bytes we can
       prove: say so, instead of a number that understates the page */
    var cachedAssets = !sizes.css || !sizes.js;
    var totalTxt = sz(sizes.total) + (cachedAssets
      ? (LROS.lang === "it" ? " + css/js in cache" : " + css/js cached") : "");
    var map = {
      "r-parse": parseMs.toFixed(1) + " ms",
      "r-css": sz(sizes.css), "r-js": sz(sizes.js), "r-fonts": sz(sizes.fonts),
      "r-total": totalTxt, "r-reqs": sizes.reqs + " (same-origin)"
    };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = map[id];
    });
  }

  /* ---------- boot rendering ---------- */
  var boot = document.getElementById("boot");
  var log = document.getElementById("bootlog");
  var done = false;
  var started = false; /* a boot is already running: no double runBoot */
  var bootRan = false; /* SKIP revisits go straight to desktop, no login theatre */
  var cursor = document.createElement("span");
  cursor.className = "cursor";

  function renderLine(text) {
    var row = document.createElement("div");
    row.textContent = "[" + (performance.now() / 1000).toFixed(6).padStart(12, " ") + "] " + text;
    log.insertBefore(row, cursor);
  }
  function finishBoot() {
    if (done) return;
    done = true;
    fillReceipt();
    log.textContent = "";
    boot.classList.add("off");
    document.body.classList.add("on");
    try { sessionStorage.setItem("lros-boot", "1"); } catch (e) {}
    boot.addEventListener("animationend", function () { boot.style.display = "none"; });
    if (bootRan) runLogin();
  }

  /* ---------- login: guest, zero taps, real timestamps ---------- */
  /* ---------- login: guest, zero taps, ~2s of honest theatre ---------- */
  function runLogin() {
    var el = document.getElementById("login");
    var lg = document.getElementById("loginlog");
    if (!el || !lg) return;
    el.classList.add("open");
    lg.textContent = "LORERUFF-OS 1.0.0 (tty1)\n";
    var name = "guest", c = 0;
    setTimeout(function () { lg.textContent += "loreruff login: "; typeGuest(); }, 300);
    function typeGuest() {
      (function ty() {
        if (c < name.length) { lg.textContent += name[c++]; setTimeout(ty, 130); }
        else finishLogin();
      })();
    }
    function finishLogin() {
      lg.textContent += "\nLast login: " + (lastLogin || "first boot (fresh CMOS)");
      klog("login: guest (auto, 0 taps)");
      /* the jingle is the desktop's arrival sound: after the login, not during boot */
      setTimeout(function () {
        el.classList.remove("open");
        if (!silentBoot) LROS.sound.jingle();
      }, 1050);
    }
  }

  function bootLines() {
    var compact = !cmos.verbose && (innerWidth < 700 || cores <= 4);
    var full = [
      "LORERUFF-OS 1.0.0 — booting",
      "Command line: quiet splash (not today)",
      "CMOS: speaker " + (cmos.speaker ? "on" : "off") + ", scanlines " + (cmos.scanline ? "on" : "off") + ", boot #" + (cmos.boots + 1),
      "CPU: " + cores + " cores, memory " + mem + ", DPR " + (devicePixelRatio || 1),
      "Viewport probe: " + innerWidth + "x" + innerHeight + " @ " + conn,
      "parse index.html .......... OK (" + parseMs.toFixed(1) + " ms)",
      "mount /assets/os.css ...... OK (" + sz(sizes.css) + ")",
      "exec boot.js + cli.js ..... OK (" + sz(sizes.js) + ")",
      "load phosphor fonts ....... OK (" + sz(sizes.fonts) + ")",
      "net: 0 third-party requests, 0 trackers",
      "l10n: " + LROS.lang + " ................ OK",
      "starting window manager ... OK",
      "welcome, guest"
    ];
    if (compact) return full.filter(function (_, i) { return [0, 4, 5, 8, 9, 11, 12].indexOf(i) !== -1; });
    return full;
  }

  function runBoot(silent) {
    if (started) return; /* Enter mid-boot / double timer / double click */
    started = true;
    bootRan = true;
    silentBoot = !!silent;
    cmos.boots++; cmos.last = new Date().toString(); saveCmos();
    LROS.sound.unlock(); LROS.sound.beep();
    klog("boot requested (limine), boot #" + cmos.boots);
    limine.classList.add("hidden");
    boot.classList.remove("hidden");
    log.appendChild(cursor);
    var all = bootLines();
    var i = 0;
    (function burst() {
      var n = 1 + Math.floor(Math.random() * 3);
      while (n-- > 0 && i < all.length) renderLine(all[i++]);
      LROS.sound.tick();
      if (i < all.length) setTimeout(burst, 60 + Math.random() * 180);
      else setTimeout(finishBoot, 220);
    })();
    setTimeout(finishBoot, 2000); /* hard cap */
    /* key skip: registered now, so the Enter that launched boot can't kill it */
    setTimeout(function () {
      addEventListener("keydown", finishBoot, { once: true });
    }, 150);
  }

  /* ---------- limine bootloader ---------- */
  var limine = document.getElementById("limine");
  var entries = [].slice.call(document.querySelectorAll("#limine .lim-entry"));
  var sel = 0;
  function drawSel() {
    entries.forEach(function (e, i) { e.classList.toggle("sel", i === sel); });
  }
  function limineKey(e) {
    if (cmosOpen || done) return; /* bootloader is pre-boot only */
    if (e.key === "ArrowDown") { sel = (sel + 1) % entries.length; drawSel(); }
    else if (e.key === "ArrowUp") { sel = (sel + entries.length - 1) % entries.length; drawSel(); }
    else if (e.key === "Enter") { runBoot(sel === 1); }
    else if (e.key === "Delete") { openCmos(); }
  }
  entries.forEach(function (e, i) {
    e.addEventListener("click", function () { sel = i; drawSel(); runBoot(i === 1); });
  });

  /* default entry self-boots after 5s without input, like a BIOS timeout */
  var armT = 0;
  function armAutoboot() {
    clearTimeout(armT);
    armT = setTimeout(function () {
      if (cmosOpen) { armAutoboot(); return; } /* SETUP open: wait, don't boot */
      if (!done && !started) runBoot(sel === 1);
    }, 5000);
  }
  function limineShown() { return !done && getComputedStyle(limine).display !== "none"; }
  ["keydown", "pointerdown", "pointermove"].forEach(function (ev) {
    addEventListener(ev, function () { if (limineShown()) armAutoboot(); }, { passive: true });
  });

  /* ---------- PXE ghost: one boot in ten thinks there is no disk ---------- */
  var pxeEl = document.getElementById("pxe");
  var pxeLog = document.getElementById("pxelog");
  function maybePxe(next) {
    if (SKIP || !pxeEl || Math.random() >= 0.10) { next(); return; }
    var lines = ["Intel(R) Boot Agent GE v1.5.13", "PXE-M0F: booting from network…", ""];
    var i = 0;
    klog("PXE-M0F: netboot probe (1-in-10 ghost)");
    pxeEl.classList.add("open");
    (function step() {
      if (i < lines.length) { pxeLog.textContent += lines[i++] + "\n"; setTimeout(step, 430); }
      else setTimeout(function () { pxeEl.classList.remove("open"); next(); }, 750);
    })();
  }
  LROS.pxe = maybePxe;

  /* real clock, like every BIOS that respects itself. Dead battery = late clock */
  var clocks = [document.getElementById("lim-clock"), document.getElementById("cmos-clock")];
  setInterval(function () {
    var t = new Date(Date.now() - drift).toLocaleTimeString();
    clocks.forEach(function (c) { if (c) c.textContent = t; });
  }, 1000);
  if (drift) klog("CMOS battery dead — clock drift " + Math.round(drift / 1000) + "s");

  /* ---------- CMOS SETUP (DEL) ---------- */
  var cmosEl = document.getElementById("cmos");
  var cmosOpen = false;
  var rows = [].slice.call(document.querySelectorAll("#cmos .cmos-row"));
  var csel = 0;
  function cmosVals() {
    return [cmos.speaker ? "On" : "Off", cmos.scanline ? "On" : "Off", cmos.verbose ? "On" : "Off"];
  }
  function drawCmos() {
    var v = cmosVals();
    rows.forEach(function (r, i) {
      r.querySelector(".cmos-val").textContent = v[i];
      r.classList.toggle("sel", i === csel);
    });
    var bc = document.getElementById("cmos-boots");
    if (bc) bc.textContent = cmos.boots + " (cold)";
  }
  function openCmos() {
    cmosOpen = true;
    cmosEl.classList.add("open");
    drawCmos();
  }
  function closeCmos(save) {
    if (save) { saveCmos(); klog("CMOS written"); }
    cmosOpen = false;
    cmosEl.classList.remove("open");
  }
  function cmosKey(e) {
    if (!cmosOpen) return;
    if (e.key === "ArrowDown") { csel = (csel + 1) % rows.length; drawCmos(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { csel = (csel + rows.length - 1) % rows.length; drawCmos(); e.preventDefault(); }
    else if (e.key === "Enter") {
      var k = ["speaker", "scanline", "verbose"][csel];
      cmos[k] = cmos[k] ? 0 : 1;
      if (k === "scanline") LROS.setScanlines(cmos.scanline);
      LROS.sound.blip(); drawCmos();
    }
    else if (e.key === "F10") { closeCmos(true); }
    else if (e.key === "Escape") { closeCmos(false); }
  }
  rows.forEach(function (r, i) {
    r.addEventListener("click", function () {
      var k = ["speaker", "scanline", "verbose"][i];
      cmos[k] = cmos[k] ? 0 : 1;
      if (k === "scanline") LROS.setScanlines(cmos.scanline);
      drawCmos();
    });
  });
  document.getElementById("cmos-save").addEventListener("click", function () { closeCmos(true); });
  document.getElementById("cmos-quit").addEventListener("click", function () { closeCmos(false); });

  /* ---------- S3 suspend / wake ---------- */
  var hiddenAt = 0;
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (!hiddenAt) return;
    var gone = (Date.now() - hiddenAt) / 1000;
    hiddenAt = 0;
    if (gone < 2 || reduced || !done) return;
    klog("resuming from S3 (" + gone.toFixed(0) + "s)");
    document.body.classList.add("wake");
    LROS.sound.tick();
    setTimeout(function () { document.body.classList.remove("wake"); }, 500);
  });

  /* ---------- SIGNAL LOST: sync roll after real idle ---------- */
  var idleT;
  function armIdle() {
    clearTimeout(idleT);
    idleT = setTimeout(function () {
      if (!done || reduced || document.hidden) return;
      klog("vsync lost (60s idle) — re-syncing");
      document.body.classList.add("resync");
      LROS.sound.buzz();
      /* the roll alone is invisible at 60fps: spell it out, CRT style.
         the caption leaves only on real user input, never on a timer */
      var ns = document.getElementById("nosignal");
      if (ns && !ns.classList.contains("open")) {
        ns.classList.add("open");
        var dismiss = function () {
          ns.classList.remove("open");
          ["keydown", "pointerdown", "scroll", "wheel"].forEach(function (ev) {
            removeEventListener(ev, dismiss);
          });
        };
        ["keydown", "pointerdown", "scroll", "wheel"].forEach(function (ev) {
          addEventListener(ev, dismiss);
        });
      }
      setTimeout(function () { document.body.classList.remove("resync"); }, 750);
    }, 60000);
  }

  /* ---------- screensaver: 3 real idle minutes, starfield, any key kills it ---------- */
  var saverEl = document.getElementById("saver");
  var saverOn = false, svRaf = 0, svCtx = null, svStars = null, svT = 0;
  function armSaver() {
    clearTimeout(svT);
    svT = setTimeout(function () {
      if (!done || reduced || document.hidden || saverOn) return;
      startSaver();
    }, 180000);
  }
  function startSaver() {
    saverOn = true;
    saverEl.width = innerWidth; saverEl.height = innerHeight;
    svCtx = saverEl.getContext("2d");
    svStars = [];
    for (var i = 0; i < 150; i++) {
      svStars.push({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() * 0.9 + 0.1 });
    }
    klog("idle 180s — screensaver engaged");
    saverEl.classList.add("open");
    svTick();
  }
  function svTick() {
    if (!saverOn) return;
    var w = saverEl.width, h = saverEl.height, cx = w / 2, cy = h / 2;
    svCtx.fillStyle = "#030504"; svCtx.fillRect(0, 0, w, h);
    svCtx.fillStyle = "#39ff88";
    svStars.forEach(function (s) {
      s.z -= 0.0035;
      if (s.z <= 0.02) { s.x = Math.random() * 2 - 1; s.y = Math.random() * 2 - 1; s.z = 1; }
      var px = cx + (s.x / s.z) * (w / 4), py = cy + (s.y / s.z) * (h / 4);
      var r = Math.max(1, (1 - s.z) * 2.2);
      svCtx.fillRect(px, py, r, r);
    });
    svRaf = requestAnimationFrame(svTick);
  }
  function killSaver() {
    if (!saverOn) return;
    saverOn = false;
    cancelAnimationFrame(svRaf);
    saverEl.classList.remove("open");
    klog("screensaver exited");
    armSaver();
  }
  LROS.saver = { start: startSaver, kill: killSaver };

  /* ---------- case screws: unscrew the bezel, read the inner plate ---------- */
  var screws = [].slice.call(document.querySelectorAll(".screw"));
  var loose = 0;
  var plate = document.getElementById("plate");
  screws.forEach(function (s) {
    s.addEventListener("click", function (ev) {
      ev.stopPropagation();
      if (s.classList.contains("loose")) return;
      s.classList.add("loose");
      loose++;
      klog("screw " + loose + "/4 loosened");
      LROS.sound.tick();
      if (loose === screws.length) openPlate();
    });
  });
  function openPlate() {
    klog("bezel removed — inner plate visible");
    var set = function (id, v) { var e = document.getElementById(id); if (e) e.textContent = v; };
    set("p-html", document.documentElement.outerHTML.length + " B");
    set("p-css", sz(sizes.css));
    set("p-js", sz(sizes.js));
    set("p-dom", document.getElementsByTagName("*").length + " nodes");
    plate.classList.add("open");
    LROS.sound.blip();
  }
  if (plate) plate.addEventListener("click", function () {
    plate.classList.remove("open");
    screws.forEach(function (s) { s.classList.remove("loose"); });
    loose = 0;
    klog("plate closed, screws back in");
  });

  /* ---------- Konami: ↑↑↓↓←→←→BA = overclock, thermal warning ---------- */
  var KON = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  var kidx = 0;
  addEventListener("keydown", function (e) {
    if (!done) return;
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === KON[kidx]) {
      if (++kidx === KON.length) { kidx = 0; toggleOc(); }
    } else kidx = k === KON[0] ? 1 : 0;
  });
  function toggleOc() {
    var on = docEl.classList.toggle("oc");
    if (on && docEl.classList.contains("turbo")) {
      docEl.classList.remove("turbo");
      klog("turbo removed — full clock requested");
    }
    klog(on ? "overclock accepted — thermal warning" : "clocks back to stock");
    LROS.sound.blip();
  }

  ["pointermove", "keydown", "scroll", "pointerdown"].forEach(function (ev) {
    addEventListener(ev, function () {
      /* any input while the screensaver runs kills it first */
      if (saverOn) { killSaver(); return; }
      armIdle(); armSaver();
    }, { passive: true });
  });
  armIdle(); armSaver();

  /* ---------- wiring ---------- */
  addEventListener("keydown", function (e) { cmosKey(e); if (!cmosOpen) limineKey(e); });
  document.getElementById("boot").addEventListener("pointerdown", finishBoot);

  if (SKIP) {
    limine.classList.add("hidden");
    boot.classList.add("hidden");
    finishBoot();
  } else {
    maybePxe(function () { drawSel(); armAutoboot(); });
  }
  /* second pass: cached loads and late fonts settle after first paint */
  addEventListener("load", function () {
    readResources();
    fillReceipt();
  });
})();
