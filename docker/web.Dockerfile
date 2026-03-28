ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG ALL_PROXY
ARG NO_PROXY

FROM node:22-bookworm-slim AS builder

ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG ALL_PROXY
ARG NO_PROXY

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV HTTP_PROXY=$HTTP_PROXY
ENV HTTPS_PROXY=$HTTPS_PROXY
ENV ALL_PROXY=$ALL_PROXY
ENV NO_PROXY=$NO_PROXY
ENV http_proxy=$HTTP_PROXY
ENV https_proxy=$HTTPS_PROXY
ENV all_proxy=$ALL_PROXY
ENV no_proxy=$NO_PROXY
ENV NODE_ENV=production
ENV PORT=4173
ENV BASE_PATH=/

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json ./
COPY artifacts/graph-lab/package.json artifacts/graph-lab/package.json
COPY lib/api-client-react/package.json lib/api-client-react/package.json
COPY lib/graph-contract/package.json lib/graph-contract/package.json

RUN pnpm install --frozen-lockfile

COPY artifacts/graph-lab artifacts/graph-lab
COPY attached_assets attached_assets
COPY lib/api-client-react lib/api-client-react
COPY lib/graph-contract lib/graph-contract

RUN pnpm --filter @workspace/graph-lab run build

FROM nginx:1.27-alpine AS runner

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/artifacts/graph-lab/dist/public /usr/share/nginx/html

EXPOSE 80
