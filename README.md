# net-merge.org

The website of [net-merge](https://github.com/net-merge/net-merge): one page, served by [Bun](https://bun.sh).

## Run it

```
bun install
bun dev
```

Then open http://localhost:3000. `bun dev` reloads when you edit a file.

## What is where

- `src/index.html`, `src/styles.css`, `src/main.ts`: the page. Bun bundles them when the server starts.
- `public/`: files with fixed URLs (icons, screenshots, the demo video, robots.txt). Each one gets its own route.
- `server.ts`: serves the page, the files in `public/`, and `/api/stats` (stars and the latest version, fetched
  from GitHub at most once an hour).
- `pkg.ts`: pkg.net-merge.org, the Linux package repositories. The files live on GitHub Pages (net-merge's
  release workflow builds them); it passes requests through. `PKG_UPSTREAM` sets where they come from.

## Deploy

`Dockerfile` builds an image that listens on port 3000. It runs on EasyPanel twice: as the website, and with
the command `bun pkg.ts` as pkg.net-merge.org.

## License

MIT, see `LICENSE`.
