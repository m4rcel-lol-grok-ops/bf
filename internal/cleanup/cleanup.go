package cleanup

import (
	"log/slog"
	"os"
	"path/filepath"
	"time"
)

type Worker struct {
	tempDir  string
	ttl      time.Duration
	interval time.Duration
	logger   *slog.Logger
	stop     chan struct{}
}

func New(tempDir string, ttl, interval time.Duration, logger *slog.Logger) *Worker {
	return &Worker{
		tempDir:  tempDir,
		ttl:      ttl,
		interval: interval,
		logger:   logger,
		stop:     make(chan struct{}),
	}
}

func (w *Worker) Start() {
	go w.loop()
}

func (w *Worker) Stop() {
	close(w.stop)
}

func (w *Worker) loop() {
	// Cleanup on startup
	w.run()

	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	for {
		select {
		case <-w.stop:
			return
		case <-ticker.C:
			w.run()
		}
	}
}

func (w *Worker) run() {
	entries, err := os.ReadDir(w.tempDir)
	if err != nil {
		if !os.IsNotExist(err) {
			w.logger.Error("cleanup read dir", "error", err)
		}
		return
	}

	now := time.Now()
	for _, e := range entries {
		path := filepath.Join(w.tempDir, e.Name())
		info, err := e.Info()
		if err != nil {
			continue
		}
		if now.Sub(info.ModTime()) > w.ttl {
			if err := os.RemoveAll(path); err != nil {
				w.logger.Warn("cleanup remove", "path", path, "error", err)
			} else {
				w.logger.Debug("cleaned up", "path", path)
			}
		}
	}
}
