package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/m4rcel-lol-grok-ops/bf/internal/api"
	"github.com/m4rcel-lol-grok-ops/bf/internal/cleanup"
	"github.com/m4rcel-lol-grok-ops/bf/internal/config"
	"github.com/m4rcel-lol-grok-ops/bf/internal/converter"
	"github.com/m4rcel-lol-grok-ops/bf/internal/jobs"
	"github.com/m4rcel-lol-grok-ops/bf/internal/security"
	"github.com/m4rcel-lol-grok-ops/bf/internal/storage"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		logger.Error("config", "error", err)
		os.Exit(1)
	}

	if err := os.MkdirAll(cfg.TempDir, 0750); err != nil {
		logger.Error("temp dir", "error", err)
		os.Exit(1)
	}
	if err := os.MkdirAll(cfg.DataDir, 0750); err != nil {
		logger.Error("data dir", "error", err)
		os.Exit(1)
	}

	db, err := storage.Open(cfg.DataDir)
	if err != nil {
		logger.Error("database", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	downloads := security.NewDownloadStore(cfg.TempDir, cfg.TempFileTTL)
	jobMgr := jobs.NewManager(cfg.MaxConcurrentJobs, cfg.TempFileTTL, downloads, logger)
	converter.Register(jobMgr)

	cleanupWorker := cleanup.New(cfg.TempDir, cfg.TempFileTTL, cfg.CleanupInterval, logger)
	cleanupWorker.Start()
	defer cleanupWorker.Stop()

	viewsDir := "web/views"
	if _, err := os.Stat(viewsDir); os.IsNotExist(err) {
		// Try relative to executable or common locations
		candidates := []string{
			filepath.Join(".", "web", "views"),
			"/app/web/views",
			filepath.Join(filepath.Dir(os.Args[0]), "web", "views"),
		}
		for _, c := range candidates {
			if _, err := os.Stat(c); err == nil {
				viewsDir = c
				break
			}
		}
	}

	srv, err := api.NewServer(cfg, db, jobMgr, downloads, logger, viewsDir)
	if err != nil {
		logger.Error("api server", "error", err)
		os.Exit(1)
	}

	httpServer := &http.Server{
		Addr:              cfg.Addr(),
		Handler:           srv.Handler(),
		ReadTimeout:       cfg.ReadTimeout,
		ReadHeaderTimeout: cfg.ReadHeaderTimeout,
		WriteTimeout:      cfg.WriteTimeout,
		IdleTimeout:       cfg.IdleTimeout,
		MaxHeaderBytes:    cfg.MaxHeaderBytes,
	}

	go func() {
		logger.Info("Byteforge starting", "addr", cfg.Addr(), "data", cfg.DataDir)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	logger.Info("shutting down", "signal", sig.String())

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	jobMgr.Shutdown()
	if err := httpServer.Shutdown(ctx); err != nil {
		logger.Error("shutdown", "error", err)
	}
	logger.Info("Byteforge stopped")
}
