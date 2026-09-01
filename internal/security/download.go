package security

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type DownloadStore struct {
	mu      sync.RWMutex
	entries map[string]*DownloadEntry
	baseDir string
	ttl     time.Duration
}

type DownloadEntry struct {
	ID        string
	Path      string
	Filename  string
	MimeType  string
	CreatedAt time.Time
	ExpiresAt time.Time
}

func NewDownloadStore(baseDir string, ttl time.Duration) *DownloadStore {
	return &DownloadStore{
		entries: make(map[string]*DownloadEntry),
		baseDir: baseDir,
		ttl:     ttl,
	}
}

func (s *DownloadStore) Register(path, filename, mimeType string) (string, error) {
	id, err := GenerateSecureID(32)
	if err != nil {
		return "", err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	s.entries[id] = &DownloadEntry{
		ID:        id,
		Path:      path,
		Filename:  sanitizeFilename(filename),
		MimeType:  mimeType,
		CreatedAt: now,
		ExpiresAt: now.Add(s.ttl),
	}
	return id, nil
}

func (s *DownloadStore) Get(id string) (*DownloadEntry, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	e, ok := s.entries[id]
	if !ok {
		return nil, fmt.Errorf("not found")
	}
	if time.Now().After(e.ExpiresAt) {
		return nil, fmt.Errorf("expired")
	}
	if _, err := os.Stat(e.Path); err != nil {
		return nil, fmt.Errorf("file missing")
	}
	return e, nil
}

func (s *DownloadStore) Delete(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if e, ok := s.entries[id]; ok {
		_ = os.Remove(e.Path)
		delete(s.entries, id)
	}
}

func (s *DownloadStore) Cleanup() {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	for id, e := range s.entries {
		if now.After(e.ExpiresAt) {
			_ = os.Remove(e.Path)
			delete(s.entries, id)
		}
	}
}

func GenerateSecureID(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func sanitizeFilename(name string) string {
	name = filepath.Base(name)
	name = strings.ReplaceAll(name, "..", "")
	name = strings.Map(func(r rune) rune {
		if r < 32 || r == '/' || r == '\\' || r == ':' || r == '*' || r == '?' || r == '"' || r == '<' || r == '>' || r == '|' {
			return '_'
		}
		return r
	}, name)
	if name == "" || name == "." || name == ".." {
		return "download"
	}
	return name
}

func SecureTempDir(base string) (string, error) {
	id, err := GenerateSecureID(16)
	if err != nil {
		return "", err
	}
	dir := filepath.Join(base, id)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", err
	}
	return dir, nil
}
