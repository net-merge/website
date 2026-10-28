// Fonts load from /fonts at runtime: the CSS bundler would inline them as base64 and bloat the CSS.
for (const [family, weight, file] of [
  ["Overpass", "400", "overpass-latin-400-normal"],
  ["Overpass", "700", "overpass-latin-700-normal"],
  ["Overpass", "800", "overpass-latin-800-normal"],
  ["Overpass Mono", "400", "overpass-mono-latin-400-normal"],
] as const) {
  const face = new FontFace(family, `url(/fonts/${file}.woff2) format("woff2")`, { weight, display: "swap" });
  document.fonts.add(face);
  face.load().catch(() => {});
}

type Os = "windows" | "macos" | "linux";

const raw = "https://raw.githubusercontent.com/net-merge/net-merge/main";
const setupExe = "https://github.com/net-merge/net-merge/releases/latest/download/net-merge-setup.exe";

const installs: Record<Os, { command: string; hint: () => Node[] }> = {
  windows: {
    command: `irm ${raw}/install.ps1 | iex`,
    hint: () => [
      text("Paste it into PowerShell and approve the admin prompt. Antivirus blocked it? "),
      link(setupExe, "Download net-merge-setup.exe"),
      text(" and double-click it."),
    ],
  },
  macos: {
    command: `curl -fsSL ${raw}/install.sh | sh`,
    hint: () => [text("Paste it into Terminal. It uses Homebrew if you have it.")],
  },
  linux: {
    command: `curl -fsSL ${raw}/install.sh | sh`,
    hint: () => [
      text("Paste it into a terminal. It uses your package manager (apt, dnf, zypper, apk or pacman), so net-merge updates with the rest of your system."),
    ],
  },
};

function text(s: string): Node {
  return document.createTextNode(s);
}

function link(href: string, label: string): Node {
  const a = document.createElement("a");
  a.href = href;
  a.textContent = label;
  return a;
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} is missing`);
  return el as T;
}

function detectOs(): Os {
  const ua = navigator.userAgent;
  if (/Windows/.test(ua)) return "windows";
  if (/Macintosh/.test(ua)) return "macos";
  if (/Linux|X11|CrOS/.test(ua) && !/Android/.test(ua)) return "linux";
  return "windows";
}

// iPads report "Macintosh", so touch support tells them apart from Macs.
const onPhone = /Android|iPhone|iPad/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

const tabs = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
const panel = byId("command");
const cmd = byId("cmd");
const hint = byId("hint");
const copy = byId<HTMLButtonElement>("copy");
const status = byId("status");

function select(os: Os, focus = false) {
  for (const tab of tabs) {
    const on = tab.dataset.os === os;
    tab.setAttribute("aria-selected", String(on));
    tab.tabIndex = on ? 0 : -1;
    if (on) {
      panel.setAttribute("aria-labelledby", tab.id);
      if (focus) tab.focus();
    }
  }
  cmd.textContent = installs[os].command;
  hint.replaceChildren(...installs[os].hint());
  copy.textContent = "Copy";
}

function isOs(v: string | undefined): v is Os {
  return v === "windows" || v === "macos" || v === "linux";
}

tabs.forEach((tab, i) => {
  tab.addEventListener("click", () => {
    if (isOs(tab.dataset.os)) select(tab.dataset.os);
  });
  tab.addEventListener("keydown", (e) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    const next = tabs[(i + step + tabs.length) % tabs.length]?.dataset.os;
    if (isOs(next)) select(next, true);
  });
});

copy.addEventListener("click", async () => {
  const value = cmd.textContent ?? "";
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    // No clipboard access (plain http, old browser): select the text so Ctrl+C works.
    getSelection()?.selectAllChildren(cmd);
  }
  copy.textContent = "Copied";
  status.textContent = "Command copied";
  setTimeout(() => (copy.textContent = "Copy"), 2000);
});

select(detectOs());

// Set here, not in the HTML: the bundled copy of the video is served without byte ranges, which Safari needs.
const demo = byId<HTMLVideoElement>("demo");
if (demo.dataset.src) demo.src = demo.dataset.src;
if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
  demo.controls = true; // no autoplay: people who turned off motion start it themselves
} else {
  demo.play().catch(() => (demo.controls = true));
}
if (onPhone) byId("phone").hidden = false;

interface Stats {
  stars: number | null;
  version: string | null;
}

fetch("/api/stats")
  .then((r) => (r.ok ? (r.json() as Promise<Stats>) : null))
  .then((s) => {
    if (s?.version) byId("version").textContent = s.version;
    if (s?.stars) {
      const n = s.stars.toLocaleString("en-US");
      byId("stars-text").textContent = `${n} stars`;
      byId("stars").setAttribute("aria-label", `net-merge on GitHub, ${n} stars`);
    }
  })
  .catch(() => {});
