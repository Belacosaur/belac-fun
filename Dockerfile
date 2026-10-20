FROM node:22-bookworm-slim
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @belac/api build
CMD ["node", "apps/api/dist/server.js"]
