# loreruff.com

> LORERUFF-OS: a personal site dressed as a retro computer. Zero dependencies,
> zero build step, zero trackers, zero network requests.

The live site is at [https://loreruff.com](https://loreruff.com) (Italian
edition at [/it/](https://loreruff.com/it/)). Born from a simple idea: a
portfolio shouldn't look like a résumé PDF, it should behave like the machine
it was written on. So the site boots: limine-style bootloader, kernel ring
whose every line is a live measurement, then a desktop with a working shell.

## Features

- **Boot sequence** — pick normal or silent boot; `DEL` opens CMOS SETUP
  (PC speaker, CRT scanlines, verbose boot — real settings, persisted in
  localStorage). A ghost in the machine: one cold boot in ten shows a PXE
  network-boot screen instead.
- **Live kernel boot** — dmesg lines driven by PerformanceObserver (real
  timings, not fake delays), with bursts, skippable with any key.
- **`lsh`, a real shell** — fixed at the bottom (`` ` `` or `/` to focus,
  `Esc` to close). It reads the DOM, the kernel ring and your screen — nothing
  else: `go <section>`, `ls modules` (from the DOM), `neofetch` (your real
  device), `dmesg`, `turbo` (8 MHz compat mode), `sl`, `lang en|it`,
  `sudo`/`rm` (refused, honestly), and more.
- **Honest power management** — idle 60 s → sync roll; tab hidden >2 s →
  S3 resume with degauss on return. `prefers-reduced-motion` disables all of
  it; without JS nothing overlays and the content is plain readable HTML.
- **Bilingual** — EN default, IT mirror, switched by a shell command, not a
  page reload of duplicated markup.

## Stack

| Layer    | Choice |
|----------|--------|
| Markup   | hand-written HTML (one file per language) |
| Style    | one CSS file: phosphor green + violet, flat, IBM Plex Mono self-hosted (woff2, latin) |
| Behavior | vanilla JS, two files (`boot.js`, `cli.js`), no frameworks |
| Server   | static files on nginx, deployed by rsync |

## Layout

```
index.html          EN (default)
it/index.html       IT
assets/os.css       design system (phosphor green + violet, flat, mono)
assets/boot.js      CMOS, sounds, bootloader, kernel boot, S3, idle roll
assets/cli.js       lsh shell, suggestions, sl, jokes
assets/fonts/       IBM Plex Mono 400/500/700 (self-hosted woff2, latin)
```

## Security notes

- **Zero network requests at runtime**: no fetch/XHR/WebSocket/beacon, no
  third-party scripts, no fonts from CDNs, no analytics, no cookies.
- Hardened server-side: HSTS (2y + subdomains), strict CSP
  (`default-src 'self'`), `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy: no-referrer`, TLS 1.2/1.3 (Let's Encrypt), dotfiles
  (`.git/` included) denied by nginx.
- All dynamic DOM writes go through `textContent`; nothing is ever parsed
  into HTML. Storage holds only cosmetic preferences (speaker, scanlines,
  verbose, boot counter).

## License

[AGPL-3.0](LICENSE) — © LoreRuff

---

Developed with strong AI assistance (opencode/GLM); humans led the ideas, the
testing and the debugging — said openly because it shaped how the project was
built.
