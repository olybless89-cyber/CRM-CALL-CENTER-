# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /workspace

FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
RUN npm ci --workspace apps/api --include-workspace-root

FROM deps AS build
COPY apps/api apps/api
RUN npm run prisma:generate --workspace apps/api
RUN npm run build --workspace apps/api

FROM base AS runtime
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
RUN npm ci --workspace apps/api --include-workspace-root --omit=dev
COPY --from=build /workspace/apps/api/dist apps/api/dist
# The generated Prisma Client output must sit next to wherever npm
# hoists @prisma/client in this workspace (the repo-root node_modules),
# not nested under apps/api, or Node can't resolve it at runtime.
COPY --from=build /workspace/apps/api/node_modules/.prisma node_modules/.prisma
COPY apps/api/prisma apps/api/prisma

EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
