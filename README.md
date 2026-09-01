# Byteforge

**Byteforge — A universal toolkit for files, code, documents, feeds and sound.**

Production-ready, self-hostable universal web utility platform.

## Features

- **File Converter** — Images, audio, video, text (FFmpeg / ImageMagick)
- **Code Editor** — Multi-language browser editor with download
- **SVG Editor** — Visual + source modes, shapes, import/export
- **PDF Editor** — Upload and view PDFs
- **RSS Reader** — RSS 1.0 / 2.0 / Atom with SSRF protection
- **Bytebeat Composer** — Restricted expression evaluator, Web Audio, WAV export, presets, local save

## Requirements

- Linux VPS
- Docker & Docker Compose
- (Optional) Caddy system binary for HTTPS / domain reverse proxy

## Quick start

```bash
cp .env.example .env
docker compose build
docker compose up -d
```

### Direct VPS IP access

Byteforge listens on **0.0.0.0:18527** and Docker publishes:

```yaml
ports:
  - "18527:18527"
```

Open in a browser:

```
http://YOUR_VPS_IP:18527
```

**Firewall:** allow TCP port **18527** if you want public direct access:

```
TCP 18527 → Byteforge
```

You may close the port if you only access the app through Caddy.

### Health check

```bash
curl http://127.0.0.1:18527/api/health
# {"status":"ok"}

curl http://127.0.0.1:18527/api/ready
# {"status":"ok"}
```

## Caddy (system binary only)

Caddy is **not** managed by Docker. It must already be installed on the host.

Example Caddyfile:

```
example.com {
    reverse_proxy 127.0.0.1:18527
}
```

Architecture:

```
Internet
   │
   ├─ http://VPS_IP:18527  ──────────────► Byteforge :18527
   │
   └─ https://example.com
            │
            ▼
      Caddy (host binary)
            │
            ▼ reverse_proxy
      Byteforge :18527
```

There is **no** Caddy container, image, or installation step in this project.

## Configuration

See `.env.example`. Important variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_HOST` | `0.0.0.0` | Listen address |
| `APP_PORT` | `18527` | Listen port |
| `DATA_DIR` | `/data` | SQLite + persistent data |
| `TEMP_DIR` | `/tmp/byteforge` | Temporary processing |
| `MAX_UPLOAD_SIZE` | `100MB` | Max upload |
| `MAX_CONCURRENT_JOBS` | `2` | Worker pool size |
| `TEMP_FILE_TTL` | `3600` | Temp file lifetime (seconds) |

## Operations

```bash
# Logs
docker compose logs -f

# Restart
docker compose restart

# Stop
docker compose down

# Update
git pull
docker compose build
docker compose up -d
```

### Backup

SQLite database lives in the `byteforge_data` volume (default path inside container: `/data/byteforge.db`).

```bash
docker compose exec byteforge cat /data/byteforge.db > byteforge-backup.db
```

## Security notes

- Non-root container user
- `cap_drop: ALL`, `no-new-privileges`
- Rate limiting on expensive endpoints
- SSRF protection on RSS (blocks private/link-local/metadata ranges)
- Path traversal protection, secure download IDs
- Command injection avoided (explicit `exec.Command` args)
- CSP, X-Content-Type-Options, Referrer-Policy, etc.
- Bytebeat uses a restricted parser + Web Worker (no `eval` of user code)
- Uploaded files are temporary and cleaned up automatically

## Development

```bash
go test ./...
go vet ./...
go build -o byteforge ./cmd/server
APP_HOST=127.0.0.1 APP_PORT=18527 DATA_DIR=./data TEMP_DIR=./tmp ./byteforge
```

## License

MIT
