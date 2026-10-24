FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY . .
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
# pkg.ts keeps its daily counts in /data (a volume on EasyPanel)
RUN mkdir -p /data && chown bun:bun /data
USER bun
CMD ["bun", "server.ts"]
