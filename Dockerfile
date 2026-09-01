# Build stage
FROM golang:1.22-bookworm AS builder

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o /byteforge ./cmd/server

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
    imagemagick \
    wget \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r byteforge && useradd -r -g byteforge -d /app -s /sbin/nologin byteforge

WORKDIR /app

COPY --from=builder /byteforge /app/byteforge
COPY web /app/web

RUN mkdir -p /data /tmp/byteforge \
    && chown -R byteforge:byteforge /app /data /tmp/byteforge

USER byteforge

ENV APP_HOST=0.0.0.0 \
    APP_PORT=18527 \
    DATA_DIR=/data \
    TEMP_DIR=/tmp/byteforge

EXPOSE 18527

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["wget", "-q", "-O", "-", "http://127.0.0.1:18527/api/health"] || exit 1

ENTRYPOINT ["/app/byteforge"]
