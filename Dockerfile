FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY . .
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
USER bun
CMD ["bun", "server.ts"]
