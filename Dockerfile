FROM node:22-bookworm-slim
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps ./apps
COPY packages ./packages
COPY infra/start.mjs ./infra/start.mjs
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @belac/api build
CMD ["node", "infra/start.mjs"]
