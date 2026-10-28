// pkg.net-merge.org: net-merge's Linux package repositories. The files are built by net-merge's release
// workflow and live on GitHub Pages; this passes requests through, so the address never has to change.
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const upstream = (process.env.PKG_UPSTREAM ?? "https://net-merge.github.io/net-merge").replace(/\/$/, "");
const forward = ["range", "if-modified-since", "if-none-match"];
const keep = ["content-type", "content-length", "content-range", "accept-ranges", "last-modified", "etag", "cache-control"];

// ---- Counting: how many different machines check each repository for updates, per day.
// Only a salted hash of the IP is kept, and only for the current day, so nobody can be followed.

type Kind = "apt" | "rpm" | "apk" | "arch";
type Day = Partial<Record<Kind | "downloads", number>>;

interface Store {
  salt: string;
  today: string;
  seen: string[]; // "<kind>:<hash>" for today
  days: Record<string, Day>;
}

const storePath = `${process.env.PKG_DATA ?? "/data"}/counts.json`;
let store: Store = { salt: randomBytes(16).toString("hex"), today: "", seen: [], days: {} };
try {
  if (existsSync(storePath)) store = JSON.parse(readFileSync(storePath, "utf8")) as Store;
} catch (e) {
  console.error("counts: starting fresh,", e);
}
let seen = new Set(store.seen);
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function kindOf(path: string): Kind | undefined {
  if (path === "/apt/dists/stable/InRelease" || path === "/apt/dists/stable/Release") return "apt";
  if (path === "/rpm/repodata/repomd.xml") return "rpm";
  if (/^\/apk\/[^/]+\/APKINDEX\.tar\.gz$/.test(path)) return "apk";
  if (/^\/arch\/[^/]+\/net-merge\.db$/.test(path)) return "arch";
}

function count(path: string, ip: string) {
  const day = new Date().toISOString().slice(0, 10);
  if (store.today !== day) {
    store.today = day;
    seen = new Set();
  }
  const d = (store.days[day] ??= {});
  const kind = kindOf(path);
  if (kind) {
    const key = `${kind}:${createHash("sha256").update(`${store.salt}|${day}|${ip}`).digest("hex").slice(0, 16)}`;
    if (seen.has(key)) return;
    seen.add(key);
    d[kind] = (d[kind] ?? 0) + 1;
  } else if (/\.(deb|rpm|apk|pkg\.tar\.zst)$/.test(path)) {
    d.downloads = (d.downloads ?? 0) + 1;
  } else {
    return;
  }
  saveTimer ??= setTimeout(save, 5000);
}

function save() {
  saveTimer = undefined;
  store.seen = [...seen];
  try {
    mkdirSync(storePath.slice(0, storePath.lastIndexOf("/")), { recursive: true });
    writeFileSync(storePath, JSON.stringify(store));
  } catch (e) {
    console.error("counts: not saved,", e);
  }
}

// /_stats?token=…: the daily counts (no hashes). Off unless PKG_STATS_TOKEN is set.
function stats(url: URL): Response {
  const token = process.env.PKG_STATS_TOKEN;
  if (!token || url.searchParams.get("token") !== token) return new Response("Not found", { status: 404 });
  return Response.json(store.days, { headers: { "Cache-Control": "no-store" } });
}

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  async fetch(req, srv) {
    if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
    const url = new URL(req.url);
    if (url.pathname === "/_stats") return stats(url);
    // Traefik replaces X-Real-Ip with the real client address, so a client can't fake it.
    count(url.pathname, req.headers.get("x-real-ip") ?? srv.requestIP(req)?.address ?? "");

    // identity: a compressed upstream body would be unpacked by fetch and no longer match content-length
    const headers = new Headers({ "accept-encoding": "identity", "user-agent": "pkg.net-merge.org" });
    for (const h of forward) {
      const v = req.headers.get(h);
      if (v) headers.set(h, v);
    }
    const r = await fetch(upstream + url.pathname + url.search, { method: req.method, headers });
    const out = new Headers();
    for (const h of keep) {
      const v = r.headers.get(h);
      if (v) out.set(h, v);
    }
    return new Response(r.body, { status: r.status, headers: out });
  },
});

process.on("SIGTERM", () => {
  if (saveTimer) clearTimeout(saveTimer);
  save();
  process.exit(0);
});

console.log(`pkg.net-merge.org on ${server.url}, serving ${upstream}`);
