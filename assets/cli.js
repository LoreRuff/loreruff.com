/* LORERUFF-OS shell (lsh 1.0) — a fixed one-line terminal at the bottom.
   Fake filesystems are refused: ls reads the real DOM, neofetch reads the
   real visitor device, dmesg reads the real kernel ring. Suggestions are
   navigation aids, not decoration. */
(function () {
  "use strict";

  var LROS = window.LROS;
  var bar = document.getElementById("clibar");
  var input = document.getElementById("cli-input");
  var panel = document.getElementById("cli-panel");
  var out = document.getElementById("cli-out");
  var sug = document.getElementById("cli-sug");
  var sndBtn = document.getElementById("cli-snd");
  if (!bar || !input) return;

  var IT = document.documentElement.lang === "it";
  var hist = [], hi = -1;
  var T = IT ? {
    unknown: "lsh: comando non trovato: ", tryHelp: " — prova ",
    help: [
      "go <hero|modules|about|contact>  naviga la pagina",
      "ls modules      moduli nella pagina (letti dal DOM)",
      "neofetch        il tuo dispositivo, letta adesso",
      "dmesg           log kernel reale di questa sessione",
      "man <cmd>       manuale breve di ogni comando",
      "degauss         scarica le bobine del tubo (wobble CRT)",
      "panic           kernel panic con call trace vera e reboot",
      "boot            riavvia (cold boot con bootloader)",
      "lang <en|it>    cambia lingua",
      "turbo           interruttore TURBO (come sui 486)",
      "cat motd        messaggio del giorno",
      "history  clear  exit  whoami  uname -a  date  echo  sl"
    ],
    modules: "moduli nella pagina (dal DOM, non da un file finto):",
    noDir: "ls: solo 'modules' esiste, il filesystem è read-only",
    motd: [
      "Software che non chiede niente.",
      "Zero permessi · un file per modulo · un processo · zero tracker.",
      "Questo terminale gira sul tuo dispositivo: niente esce da qui."
    ],
    sudo1: "guest non è nel file sudoers. Questo incidente sarà riportato.",
    sudo2: "(no — 0 tracker, nessuno lo sa)",
    rmrf: "nice try: il filesystem è read-only e non c'è niente da cancellare",
    rmok: "rm: permsione negata (e va bene così)",
    turboOff: "turbo OFF — modalità compatibilità 8MHz",
    turboOn: "turbo ON — piena velocità",
    stuck: "sei dentro vim. per uscire: :q!   (funziona da 30 anni)",
    loading: "emacs: caricamento… (ancora in caricamento)",
    whoami: "guest — " + navigator.language + " · il terminale sa questo e nient'altro",
    langSet: "lingua: ",
    langErr: "uso: lang en | lang it",
    resync: "vsync perso (60s di inattività) — riallineato",
    resume: "riprendo da S3",
    sugNav: "naviga:",
    degauss: "degauss: bobine scaricate. purezza del colore ripristinata.",
    manList: "manuali lsh: ",
    manNone: "man: nessuna pagina per "
  } : {
    unknown: "lsh: command not found: ", tryHelp: " — try ",
    help: [
      "go <hero|modules|about|contact>  jump to section",
      "ls modules      modules on this page (read from the DOM)",
      "neofetch        your device, probed right now",
      "dmesg           real kernel log of this session",
      "man <cmd>       a short manual for every command",
      "degauss         discharge the CRT coils (wobble)",
      "panic           kernel panic with a real call trace, then reboot",
      "boot            reboot (cold boot with bootloader)",
      "lang <en|it>    switch language",
      "turbo           TURBO switch (like on a 486)",
      "cat motd        message of the day",
      "history  clear  exit  whoami  uname -a  date  echo  sl"
    ],
    modules: "modules on this page (from the DOM, not a fake file):",
    noDir: "ls: only 'modules' exists, the filesystem is read-only",
    motd: [
      "Software that asks for nothing.",
      "Zero permissions · one file per module · one process · zero trackers.",
      "This terminal runs on your device: nothing leaves here."
    ],
    sudo1: "guest is not in the sudoers file. This incident will be reported.",
    sudo2: "(no — 0 trackers, nobody knows)",
    rmrf: "nice try: filesystem is read-only and there is nothing to delete",
    rmok: "rm: permission denied (and that's fine)",
    turboOff: "turbo OFF — 8MHz compatibility mode",
    turboOn: "turbo ON — full speed",
    stuck: "you are now stuck inside vim. to exit: :q!   (works since forever)",
    loading: "emacs: loading… (still loading)",
    whoami: "guest — " + navigator.language + " · that's all the terminal knows",
    langSet: "language: ",
    langErr: "usage: lang en | lang it",
    resync: "vsync lost (60s idle) — re-synced",
    resume: "resuming from S3",
    sugNav: "navigate:",
    degauss: "degauss: coils discharged. color purity restored.",
    manList: "lsh manual pages: ",
    manNone: "man: no manual entry for "
  };

  /* ---------- output ---------- */
  function print(txt, cls) {
    var l = document.createElement("div");
    l.className = "line" + (cls ? " " + cls : "");
    l.textContent = txt;
    out.appendChild(l);
    panel.scrollTop = panel.scrollHeight;
  }
  function printAll(lines) { lines.forEach(function (l) { print(l); }); }
  function ps1() { return "guest@loreruff:~$"; }

  /* ---------- helpers with real data ---------- */
  function upStr() {
    var s = Math.floor(performance.now() / 1000);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }
  function browser() {
    var u = navigator.userAgent;
    if (u.indexOf("Edg") !== -1) return "Edge";
    if (u.indexOf("Firefox") !== -1) return "Firefox";
    if (u.indexOf("Chrome") !== -1) return "Chrome";
    if (u.indexOf("Safari") !== -1) return "Safari";
    return "unknown";
  }
  function domModules() {
    return [].slice.call(document.querySelectorAll(".module")).map(function (m) {
      var chip = m.querySelector(".chip");
      return (m.getAttribute("data-name") || "?").padEnd(12) +
        (chip ? chip.textContent : "");
    });
  }

  var train =
    "      ====        ________                ___________\n" +
    "  _D _|  |_______/        \\__I_I_____===__|_________|\n" +
    "   |(_)---  |   H\\________/ |   |        =|___ ___|\n" +
    "   /     |  |   H  |  |     |   |         ||_| |_||\n" +
    "  |      |  |   H  |__--------------------| [___] |\n" +
    "  | ________|___H__/__|_____/[][]~\\_______|       |\n" +
    "  |/ |   |-----------I_____I [][] []  D   |=======|__";

  function runSl() {
    var d = document.createElement("div");
    d.className = "sl";
    d.textContent = train;
    document.body.appendChild(d);
    LROS.sound.chugga(8);
    setTimeout(function () { d.remove(); }, 3200);
    print(IT ? "il trenino è passato. non l'hai visto arrivare." :
      "here it comes. you never see it coming.");
  }

  var logo =
    " ▄▄▄▄▄▄▄ \n" +
    " █ LROS █\n" +
    " ▀▀█▀▀▀▀ \n" +
    "  █  ▀▀  ";

  /* ---------- man pages: short, honest, one per command ---------- */
  var MAN = document.documentElement.lang === "it" ? {
    help: ["help — elenca i comandi. È tutta la documentazione che serve."],
    go: ["go SEZIONE — scorre la pagina. Sezioni: hero, modules, about, contact.", "La navigazione chiude il terminale da sola."],
    ls: ["ls — legge i moduli DAL DOM REALE della pagina.", "Non esiste un filesystem finto: solo 'modules'."],
    cat: ["cat FILE — mostra motd o dmesg. Il resto è read-only,"],
    neofetch: ["neofetch — il tuo dispositivo, sondato adesso: cores, schermo,", "uptime, payload vero della pagina. Nessun dato lascia il browser."],
    dmesg: ["dmesg — il kernel ring di questa sessione: boot, viti, degauss,", "panic. Ogni evento del sito è loggato qui."],
    uname: ["uname -a — nome del sistema. Il resto del kernel è in view-source."],
    whoami: ["whoami — guest. Sa la tua lingua, nient'altro."],
    date: ["date — data e ora del tuo dispositivo."],
    echo: ["echo ARG — restituisce gli argomenti. Come il vero, ma in meno."],
    history: ["history — i comandi che hai dato in questa sessione."],
    clear: ["clear — pulisce il pannello di output."],
    exit: ["exit — chiude il pannello. Anche ESC lo fa."],
    boot: ["boot — riavvio a freddo: ricarica e riparte dal bootloader limine."],
    lang: ["lang en|it — cambia lingua del sito (due pagine statiche)."],
    turbo: ["turbo — spegne il TURBO: 8MHz di compatibilità, come sui 486.", "Sui 486 il turbo serviva a RALLENTARE. Qui funziona uguale."],
    sudo: ["sudo — guest non è nei sudoers. E non c'è nulla da elevare:"],
    rm: ["rm — permisione negata. Il filesystem è read-only e va bene così."],
    sl: ["sl — se sbagli ls, passa il trenino. Qui lo invochi tu."],
    vim: ["vim — non c'è un editor qui. Ma il sorgente è talmente corto", "che non serve: view-source è la documentazione."],
    emacs: ["emacs — caricamento… (ancora in caricamento dal 1976)"],
    degauss: ["degauss — scarica le bobine del tubo: wobble magnetico e", "purezza del colore, come i monitor col pulsante fisico."],
    panic: ["panic — provoca un kernel panic con call trace VERA.", "Reboot automatico dopo 3 secondi, boot sequence inclusa."],
    man: ["man [cmd] — queste pagine. Scritte a mano, brevi apposta."]
  } : {
    help: ["help — list the commands. That's all the documentation needed."],
    go: ["go SECTION — scroll the page. Sections: hero, modules, about, contact.", "Navigation closes the shell by itself."],
    ls: ["ls — reads the modules FROM THE REAL DOM of the page.", "There is no fake filesystem: only 'modules' exists."],
    cat: ["cat FILE — shows motd or dmesg. Everything else is read-only,"],
    neofetch: ["neofetch — your device, probed right now: cores, screen, uptime,", "the page's real payload. No data leaves the browser."],
    dmesg: ["dmesg — this session's kernel ring: boot, screws, degauss, panic.", "Every event on the site is logged here."],
    uname: ["uname -a — system name. The rest of the kernel is in view-source."],
    whoami: ["whoami — guest. It knows your language, nothing else."],
    date: ["date — your device's clock."],
    echo: ["echo ARGS — prints the arguments back. Like the real one, minus."],
    history: ["history — the commands you ran this session."],
    clear: ["clear — wipes the output panel."],
    exit: ["exit — closes the panel. ESC does the same."],
    boot: ["boot — cold reboot: reloads and restarts from the limine bootloader."],
    lang: ["lang en|it — switch the site language (two static pages)."],
    turbo: ["turbo — turns TURBO off: 8MHz compatibility, like on a 486.", "On a 486, turbo was for SLOWING down. Here it works the same."],
    sudo: ["sudo — guest is not in the sudoers file. And there's nothing to elevate:"],
    rm: ["rm — permission denied. The filesystem is read-only, and that's fine."],
    sl: ["sl — if you mistype ls, the train passes. Here you invoke it yourself."],
    vim: ["vim — no editor here. But the source is so short you don't need one:", "view-source is the documentation."],
    emacs: ["emacs — loading… (still loading since 1976)"],
    degauss: ["degauss — discharges the CRT coils: magnetic wobble and", "color purity, like monitors with a physical button."],
    panic: ["panic — triggers a kernel panic with a REAL call trace.", "Automatic reboot after 3 seconds, boot sequence included."],
    man: ["man [cmd] — these pages. Hand-written, short on purpose."]
  };

  /* ---------- commands ---------- */
  var cmds = {
    help: { fn: function () { printAll(T.help); } },
    man: { fn: function (a) {
      var t = (a[0] || "").toLowerCase();
      if (t === "fastfetch") t = "neofetch";
      if (!t) { print(T.manList + Object.keys(MAN).join(" ")); return; }
      var pg = MAN[t];
      if (!pg) { print(T.manNone + t); LROS.sound.buzz(); return; }
      printAll(pg);
    } },
    go: { fn: function (a) {
      var map = { hero: "top", top: "top", modules: "modules", about: "about", contact: "contact", contatti: "contact", moduli: "modules" };
      var id = map[(a[0] || "").toLowerCase()];
      var el = id && document.getElementById(id);
      if (!el) { print(T.langErr); LROS.sound.buzz(); return; }
      el.scrollIntoView({ behavior: "smooth" });
      closePanel(); /* navigation closes the shell by itself */
    } },
    ls: { fn: function (a) {
      var what = (a[0] || "modules").toLowerCase();
      if (what === "modules" || what === "moduli") printAll([T.modules].concat(domModules()));
      else { print(T.noDir); LROS.sound.buzz(); }
    } },
    cat: { fn: function (a) {
      var f = (a[0] || "").replace(/^\.?\//, "");
      if (f === "motd" || f === "etc/motd") printAll(T.motd);
      else if (f === "dmesg") printAll(LROS.dmesg());
      else { print("cat: " + (a[0] || "?") + ": read-only fs"); LROS.sound.buzz(); }
    } },
    neofetch: { fn: doFetch }, fastfetch: { fn: doFetch },
    dmesg: { fn: function () { printAll(LROS.dmesg()); } },
    uname: { fn: function (a) {
      print(a[0] === "-a"
        ? "LORERUFF-OS loreruff 1.0.0 #1 SMP " + browser() + "/" + (navigator.hardwareConcurrency || "?") + " cores GNU/Nix"
        : "LORERUFF-OS");
    } },
    whoami: { fn: function () { print(T.whoami); } },
    date: { fn: function () { print(new Date().toString()); } },
    echo: { fn: function (a) { print(a.join(" ")); } },
    history: { fn: function () { printAll(hist.map(function (h, i) { return "  " + (i + 1) + "  " + h; })); } },
    clear: { fn: function () { out.textContent = ""; } },
    exit: { fn: function () { closePanel(); } },
    boot: { fn: function () {
      try { sessionStorage.removeItem("lros-boot"); } catch (e) {}
      location.reload();
    } },
    lang: { fn: function (a) {
      var l = (a[0] || "").toLowerCase();
      if (l === "en") location.href = "/";
      else if (l === "it") location.href = "/it/";
      else print(T.langErr);
    } },
    turbo: { fn: function () {
      var on = document.documentElement.classList.toggle("turbo");
      LROS.klog("turbo " + (on ? "off: 8MHz compat" : "on"));
      print(on ? T.turboOff : T.turboOn);
    } },
    sudo: { fn: function () { printAll([T.sudo1, T.sudo2]); LROS.sound.buzz(); } },
    rm: { fn: function (a) {
      print(a.join(" ").indexOf("-rf") !== -1 || a.indexOf("/") !== -1 ? T.rmrf : T.rmok);
      LROS.sound.buzz();
    } },
    sl: { fn: runSl },
    vim: { fn: function () { print(T.stuck); } },
    emacs: { fn: function () { print(T.loading); } },
    degauss: { fn: function () {
      var b = document.body;
      b.classList.remove("wake"); void b.offsetWidth; b.classList.add("wake");
      setTimeout(function () { b.classList.remove("wake"); }, 520);
      LROS.klog("manual degauss — coils discharged");
      print(T.degauss);
    } },
    panic: { fn: function () {
      var el = document.getElementById("panic"), pl = document.getElementById("paniclog");
      if (!el || !pl) return;
      /* real call trace, not a fake one: this Error IS the panic */
      var stack = (new Error().stack || "").trim().split("\n").slice(-4);
      pl.textContent = [
        "Kernel panic - not syncing: attempted to kill init",
        "CPU: " + (navigator.hardwareConcurrency || "?") + " cores · PID 1 (lsh)",
        "Call trace:"
      ].concat(stack).concat(["", "Rebooting in 3s…"]).join("\n");
      el.classList.add("open");
      LROS.klog("panic() — user-initiated, rebooting");
      LROS.sound.buzz();
      setTimeout(function () {
        try { sessionStorage.removeItem("lros-boot"); } catch (e) {}
        location.reload(); /* full reload: the boot sequence plays again */
      }, 3000);
    } }
  };

  function doFetch() {
    var s = LROS.sizes;
    var lines = [
      "guest@loreruff",
      "--------------",
      "OS:       LORERUFF-OS 1.0.0",
      "Host:     " + browser() + " · " + (navigator.hardwareConcurrency || "?") + " cores · " + (navigator.deviceMemory ? navigator.deviceMemory + "GB" : "mem n/a"),
      "Screen:   " + innerWidth + "x" + innerHeight + " @ " + (devicePixelRatio || 1) + "x",
      "Locale:   " + navigator.language,
      "Uptime:   " + upStr(),
      "Payload:  " + LROS.kb(s.total) + " · " + s.reqs + " requests, 0 third-party",
      "Boots:    " + LROS.cmos.boots + " · speaker " + (LROS.cmos.speaker ? "on" : "off")
    ];
    /* logo on the left, info on the right, one combined pre */
    var lg = logo.split("\n");
    lines.forEach(function (l, i) {
      var pad = (lg[i] || "         ") + "  ";
      print(pad + l, "line");
    });
  }

  /* ---------- suggestions: navigation first ---------- */
  var navSug = ["go hero", "go modules", "go about", "go contact"];
  function refreshSug() {
    var v = input.value.trim().toLowerCase();
    sug.textContent = "";
    if (!v) return;
    var pool = navSug.concat(Object.keys(cmds));
    var hits = pool.filter(function (c) { return c !== v && c.indexOf(v) === 0; }).slice(0, 3);
    if (!hits.length) return;
    var label = document.createElement("span");
    label.textContent = T.sugNav + " ";
    sug.appendChild(label);
    hits.forEach(function (h) {
      var b = document.createElement("b");
      b.textContent = h;
      b.addEventListener("click", function () { input.value = h; input.focus(); refreshSug(); });
      sug.appendChild(b);
    });
  }
  function complete() {
    var v = input.value.trim().toLowerCase();
    if (!v) return;
    var pool = navSug.concat(Object.keys(cmds));
    var hit = pool.filter(function (c) { return c.indexOf(v) === 0; })[0];
    if (hit) { input.value = hit; refreshSug(); LROS.sound.tick(); }
  }

  /* ---------- run ---------- */
  function run(raw) {
    var line = raw.trim();
    print(ps1() + " " + line, "cmd");
    if (!line) return;
    hist.push(line);
    var parts = line.split(/\s+/);
    var name = parts[0].toLowerCase();
    var c = cmds[name];
    if (!c) {
      print(T.unknown + name + T.tryHelp + "help");
      LROS.sound.buzz();
      return;
    }
    LROS.sound.blip();
    c.fn(parts.slice(1));
  }

  /* ---------- panel open/close + minimize + keys ---------- */
  var minBtn = document.getElementById("cli-min");
  function openPanel() {
    bar.classList.remove("down");
    try { sessionStorage.removeItem("lros-cli"); } catch (e) {}
    panel.classList.add("open");
    bar.classList.add("open");
    input.focus();
  }
  function closePanel() {
    panel.classList.remove("open");
    bar.classList.remove("open");
    input.blur();
  }
  function minimize() {
    closePanel();
    bar.classList.add("down");
    try { sessionStorage.setItem("lros-cli", "down"); } catch (e) {}
  }
  try { if (sessionStorage.getItem("lros-cli") === "down") bar.classList.add("down"); } catch (e) {}
  bar.addEventListener("click", function (e) {
    if (e.target === sndBtn || e.target === minBtn) return;
    if (bar.classList.contains("down") || !panel.classList.contains("open")) openPanel();
  });
  if (minBtn) minBtn.addEventListener("click", function (e) { e.stopPropagation(); minimize(); });
  sndBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    LROS.cmos.speaker = LROS.cmos.speaker ? 0 : 1;
    LROS.saveCmos();
    drawSnd();
    if (LROS.cmos.speaker) { LROS.sound.unlock(); LROS.sound.blip(); }
  });
  function drawSnd() {
    sndBtn.textContent = "[snd:" + (LROS.cmos.speaker ? "on" : "off") + "]";
    sndBtn.classList.toggle("on", !!LROS.cmos.speaker);
  }
  drawSnd();

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { run(input.value); input.value = ""; refreshSug(); }
    else if (e.key === "Tab") { e.preventDefault(); complete(); }
    else if (e.key === "Escape") { closePanel(); }
    else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (hist.length) { hi = hi < 0 ? hist.length - 1 : Math.max(0, hi - 1); input.value = hist[hi]; refreshSug(); }
    }
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (hi >= 0) { hi = Math.min(hist.length - 1, hi + 1); input.value = hist[hi]; refreshSug(); }
    }
    else if (e.key !== "Control") { LROS.sound.tick(); }
  });
  addEventListener("keydown", function (e) {
    if (e.key === "`" || (e.key === "/" && document.activeElement !== input &&
        !/INPUT|TEXTAREA/.test(document.activeElement.tagName))) {
      e.preventDefault();
      openPanel(); /* also un-minimizes */
    }
  });
  input.addEventListener("input", refreshSug);
})();
