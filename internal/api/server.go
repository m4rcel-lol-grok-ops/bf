package api

import (
	"context"
	"encoding/json"
	"fmt"
	"html/template"
	"log/slog"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/m4rcel-lol-grok-ops/bf/internal/config"
	"github.com/m4rcel-lol-grok-ops/bf/internal/jobs"
	"github.com/m4rcel-lol-grok-ops/bf/internal/security"
	"github.com/m4rcel-lol-grok-ops/bf/internal/storage"
	"golang.org/x/time/rate"
)

type Server struct {
	cfg        *config.Config
	db         *storage.DB
	jobs       *jobs.Manager
	downloads  *security.DownloadStore
	logger     *slog.Logger
	templates  *template.Template
	limiters   map[string]*rate.Limiter
	limiterMu  sync.Mutex
	mux        *http.ServeMux
}

func NewServer(cfg *config.Config, db *storage.DB, jobMgr *jobs.Manager, downloads *security.DownloadStore, logger *slog.Logger, viewsDir string) (*Server, error) {
	s := &Server{
		cfg:       cfg,
		db:        db,
		jobs:      jobMgr,
		downloads: downloads,
		logger:    logger,
		limiters:  make(map[string]*rate.Limiter),
		mux:       http.NewServeMux(),
	}

	tmpl := template.New("").Funcs(template.FuncMap{
		"safeHTML": func(s string) template.HTML { return template.HTML(s) },
	})
	pattern := filepath.Join(viewsDir, "*.ejs")
	if matches, _ := filepath.Glob(pattern); len(matches) > 0 {
		if t, err := tmpl.ParseGlob(pattern); err == nil {
			tmpl = t
		} else {
			logger.Warn("parse templates", "error", err)
		}
	} else {
		logger.Warn("no templates found", "dir", viewsDir)
	}
	s.templates = tmpl

	s.routes()
	return s, nil
}

func (s *Server) routes() {
	s.mux.HandleFunc("GET /api/health", s.handleHealth)
	s.mux.HandleFunc("GET /api/ready", s.handleReady)
	s.mux.HandleFunc("GET /download/{id}", s.handleDownload)

	// Pages
	s.mux.HandleFunc("GET /{$}", s.handlePage("index"))
	s.mux.HandleFunc("GET /converter", s.handlePage("converter"))
	s.mux.HandleFunc("GET /editor", s.handlePage("editor"))
	s.mux.HandleFunc("GET /svg", s.handlePage("svg"))
	s.mux.HandleFunc("GET /pdf", s.handlePage("pdf"))
	s.mux.HandleFunc("GET /rss", s.handlePage("rss"))
	s.mux.HandleFunc("GET /bytebeat", s.handlePage("bytebeat"))
	s.mux.HandleFunc("GET /settings", s.handlePage("settings"))

	// Converter API
	s.mux.HandleFunc("POST /api/converter/upload", s.rateLimited(s.handleConverterUpload))
	s.mux.HandleFunc("GET /api/converter/job/{id}", s.handleConverterJob)
	s.mux.HandleFunc("GET /api/converter/formats", s.handleConverterFormats)

	// RSS API
	s.mux.HandleFunc("GET /api/rss/feeds", s.handleRSSListFeeds)
	s.mux.HandleFunc("POST /api/rss/feeds", s.rateLimited(s.handleRSSAddFeed))
	s.mux.HandleFunc("DELETE /api/rss/feeds/{id}", s.handleRSSDeleteFeed)
	s.mux.HandleFunc("POST /api/rss/feeds/{id}/refresh", s.rateLimited(s.handleRSSRefreshFeed))
	s.mux.HandleFunc("GET /api/rss/items", s.handleRSSItems)
	s.mux.HandleFunc("POST /api/rss/items/{id}/read", s.handleRSSMarkRead)
	s.mux.HandleFunc("POST /api/rss/items/{id}/favorite", s.handleRSSToggleFavorite)

	// PDF API (basic)
	s.mux.HandleFunc("POST /api/pdf/upload", s.rateLimited(s.handlePDFUpload))
	s.mux.HandleFunc("GET /api/pdf/job/{id}", s.handlePDFJob)

	// Static files
	fs := http.FileServer(http.Dir("web/public"))
	s.mux.Handle("GET /static/", http.StripPrefix("/static/", fs))
}

func (s *Server) Handler() http.Handler {
	return s.securityHeaders(s.requestLogger(s.mux))
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (s *Server) handleReady(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if err := s.db.Ping(); err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{"status": "not ready", "error": "database"})
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (s *Server) handlePage(name string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		data := map[string]interface{}{
			"Title":   "Byteforge",
			"Page":    name,
			"Tagline": "A universal toolkit for files, code, documents, feeds and sound.",
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		if err := s.templates.ExecuteTemplate(w, name+".ejs", data); err != nil {
			// Fallback simple HTML if template missing
			s.logger.Error("template error", "page", name, "error", err)
			s.renderFallback(w, name, data)
		}
	}
}

func (s *Server) renderFallback(w http.ResponseWriter, name string, data map[string]interface{}) {
	html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Byteforge — %s</title>
<link rel="stylesheet" href="/static/css/base.css">
<link rel="stylesheet" href="/static/css/layout.css">
<link rel="stylesheet" href="/static/css/components.css">
</head>
<body>
<div id="app">
<aside class="sidebar" id="sidebar">
  <div class="logo"><a href="/">Byteforge</a></div>
  <nav>
    <a href="/" class="%s">Dashboard</a>
    <a href="/converter" class="%s">Converter</a>
    <a href="/editor" class="%s">Code Editor</a>
    <a href="/svg" class="%s">SVG Editor</a>
    <a href="/pdf" class="%s">PDF Editor</a>
    <a href="/rss" class="%s">RSS Reader</a>
    <a href="/bytebeat" class="%s">Bytebeat</a>
    <a href="/settings" class="%s">Settings</a>
  </nav>
</aside>
<main class="content">
  <header class="topbar">
    <button class="menu-toggle" id="menu-toggle" aria-label="Menu">☰</button>
    <h1>%s</h1>
    <button class="cmd-btn" id="cmd-btn" title="Command palette (Ctrl+K)">⌘K</button>
  </header>
  <div class="page" id="page-%s">
    <p>Loading %s…</p>
  </div>
</main>
</div>
<div id="command-palette" class="cmd-palette hidden" role="dialog" aria-modal="true">
  <input type="search" id="cmd-input" placeholder="Type a command…" autocomplete="off">
  <ul id="cmd-list"></ul>
</div>
<script src="/static/js/app.js"></script>
<script src="/static/js/command-palette.js"></script>
<script src="/static/js/%s.js"></script>
</body>
</html>`, name, active(name, "index"), active(name, "converter"), active(name, "editor"),
		active(name, "svg"), active(name, "pdf"), active(name, "rss"), active(name, "bytebeat"),
		active(name, "settings"), strings.Title(name), name, name, name)
	w.Write([]byte(html))
}

func active(current, target string) string {
	if current == target || (current == "index" && target == "index") {
		return "active"
	}
	return ""
}

func (s *Server) handleDownload(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" || len(id) < 16 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	entry, err := s.downloads.Get(id)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", entry.MimeType)
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, entry.Filename))
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeFile(w, r, entry.Path)
}

func (s *Server) rateLimited(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ip := clientIP(r)
		s.limiterMu.Lock()
		lim, ok := s.limiters[ip]
		if !ok {
			lim = rate.NewLimiter(rate.Every(s.cfg.RateLimitWindow/time.Duration(s.cfg.RateLimitRequests)), s.cfg.RateLimitRequests)
			s.limiters[ip] = lim
		}
		s.limiterMu.Unlock()
		if !lim.Allow() {
			http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
			return
		}
		next(w, r)
	}
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}
	host := r.RemoteAddr
	if idx := strings.LastIndex(host, ":"); idx != -1 {
		return host[:idx]
	}
	return host
}

func (s *Server) securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "SAMEORIGIN")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
		// CSP that allows necessary features for editors, PDF.js, Web Audio, workers
		csp := "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; media-src 'self' blob:; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'"
		w.Header().Set("Content-Security-Policy", csp)
		next.ServeHTTP(w, r)
	})
}

func (s *Server) requestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &responseWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(rw, r)
		s.logger.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", rw.status,
			"duration_ms", time.Since(start).Milliseconds(),
			"remote", clientIP(r),
		)
	})
}

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

func (s *Server) Shutdown(ctx context.Context) error {
	return nil
}
