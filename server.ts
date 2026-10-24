import home from "./src/index.html";

const repo = "rohit267/net-merge";
const publicDir = `${import.meta.dir}/public`;
const day = "public, max-age=86400";

// Files with fixed URLs (icons, the social preview, screenshots, the demo video), one route each,
// so no request path ever reaches the file system.
const files: Record<string, (req: Request) => Response> = {};
for await (const name of new Bun.Glob("**/*").scan({ cwd: publicDir })) {
  const file = Bun.file(`${publicDir}/${name}`);
  files[`/${name}`] = (req) => serveFile(file, req);
}

// Safari only plays <video> when the server answers byte-range requests.
function serveFile(file: ReturnType<typeof Bun.file>, req: Request): Response {
  const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.get("range") ?? "");
  const headers = { "Cache-Control": day, "Accept-Ranges": "bytes", "Content-Type": file.type };
  if (!range) return new Response(file, { headers });
  const start = Number(range[1]);
  const end = range[2] ? Math.min(Number(range[2]), file.size - 1) : file.size - 1;
  if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${file.size}` } });
  return new Response(file.slice(start, end + 1), {
    status: 206,
    headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${file.size}` },
  });
}

interface Stats {
  stars: number | null;
  version: string | null;
}

let stats: Stats = { stars: null, version: null };
let fetchedAt = 0;

async function gh(path: string): Promise<unknown> {
  const r = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "net-merge.org" },
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  return r.json();
}

function field(v: unknown, key: string): unknown {
  return typeof v === "object" && v !== null && key in v ? (v as Record<string, unknown>)[key] : undefined;
}

// Refreshed at most once an hour, so visitors never hit GitHub's rate limit; a failure keeps the old values.
async function currentStats(): Promise<Stats> {
  if (Date.now() - fetchedAt < 3_600_000) return stats;
  fetchedAt = Date.now();
  try {
    const [info, release] = await Promise.all([gh(""), gh("/releases/latest")]);
    const stars = field(info, "stargazers_count");
    const version = field(release, "tag_name");
    stats = {
      stars: typeof stars === "number" ? stars : stats.stars,
      version: typeof version === "string" ? version : stats.version,
    };
  } catch (e) {
    console.error("stats:", e);
  }
  return stats;
}

const notFound = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page not found: net-merge</title><body style="font:18px/1.5 system-ui,sans-serif;max-width:40em;margin:15vh auto;padding:0 20px">
<h1>This page does not exist.</h1><p><a href="/">Go to the net-merge home page</a></p></body></html>`;

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  development: process.env.NODE_ENV !== "production",
  routes: {
    "/": home,
    "/api/stats": async () => Response.json(await currentStats(), { headers: { "Cache-Control": "public, max-age=600" } }),
    ...files,
  },
  fetch: () => new Response(notFound, { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }),
});

console.log(`net-merge.org on ${server.url}`);
