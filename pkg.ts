// pkg.net-merge.org: net-merge's Linux package repositories. The files are built by net-merge's release
// workflow and live on GitHub Pages; this passes requests through, so the address never has to change.
const upstream = (process.env.PKG_UPSTREAM ?? "https://rohit267.github.io/net-merge").replace(/\/$/, "");
const forward = ["range", "if-modified-since", "if-none-match"];
const keep = ["content-type", "content-length", "content-range", "accept-ranges", "last-modified", "etag", "cache-control"];

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  async fetch(req) {
    if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
    const url = new URL(req.url);
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

console.log(`pkg.net-merge.org on ${server.url}, serving ${upstream}`);
