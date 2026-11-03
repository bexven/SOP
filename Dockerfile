# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# Product SOP — container image.
#   runner  : the app (Next.js standalone server)        → service "app"
#   migrate : applies database migrations (Prisma)       → service "migrate"
# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-bookworm-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# Optional extra CA certificate (only for networks behind a TLS-inspecting proxy).
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -f /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    npm ci --no-audit --no-fund --loglevel=error

FROM deps AS build
COPY . .
RUN npm run build \
 && cp -r public .next/standalone/public \
 && cp -r .next/static .next/standalone/.next/static

# Database migrations: full toolchain, runs once per update and exits.
FROM build AS migrate
CMD ["npx", "prisma", "migrate", "deploy"]

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
ARG RELEASE=dev
RUN groupadd --system --gid 1001 sop && useradd --system --uid 1001 --gid sop sop
COPY --from=build --chown=sop:sop /app/.next/standalone ./
RUN echo "$RELEASE" > RELEASE
USER sop
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
