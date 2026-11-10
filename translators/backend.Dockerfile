# syntax=docker/dockerfile:1
# The backend image for the translators' section, local development: the
# same as backend/Dockerfile, but cargo runs on 4 jobs (the WSL machine has
# ~10 GB of memory) and keeps its target directory in a build cache, so a
# rebuild compiles only what changed. Context: ./backend.
FROM rust:1-bookworm AS builder
WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev libpq-dev
RUN rm -rf /var/lib/apt/lists/*

COPY . .
ENV SQLX_OFFLINE=true
ENV CARGO_BUILD_JOBS=4
RUN --mount=type=cache,id=kw-translators-target,target=/build/target \
    --mount=type=cache,id=kw-translators-registry,target=/usr/local/cargo/registry \
    cargo build --bin backend && cp target/debug/backend /backend-bin

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libssl3 libpq5
RUN rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /backend-bin ./backend
COPY --from=builder /build/external ./external

EXPOSE 3060
CMD ["./backend"]
