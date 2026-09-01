package api

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/byteforge/byteforge/internal/security"
)

var supportedConversions = map[string][]string{
	"image/png":                {"image/jpeg", "image/webp", "image/gif", "image/bmp"},
	"image/jpeg":               {"image/png", "image/webp", "image/gif", "image/bmp"},
	"image/webp":               {"image/png", "image/jpeg", "image/gif"},
	"image/gif":                {"image/png", "image/jpeg", "image/webp"},
	"image/bmp":                {"image/png", "image/jpeg", "image/webp"},
	"image/tiff":               {"image/png", "image/jpeg", "image/webp"},
	"image/svg+xml":            {"image/png"},
	"text/plain":               {"text/html", "text/markdown"},
	"text/markdown":            {"text/html", "text/plain"},
	"text/html":                {"text/plain", "text/markdown"},
	"text/csv":                 {"text/plain"},
	"application/pdf":          {},
	"audio/mpeg":               {"audio/wav"},
	"audio/wav":                {"audio/mpeg"},
	"video/mp4":                {"video/webm"},
	"video/webm":               {"video/mp4"},
}

func (s *Server) handleConverterFormats(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(supportedConversions)
}

func (s *Server) handleConverterUpload(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, s.cfg.MaxUploadSize)
	if err := r.ParseMultipartForm(s.cfg.MaxUploadSize); err != nil {
		http.Error(w, "file too large or invalid form", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "missing file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	targetFormat := r.FormValue("target")
	if targetFormat == "" {
		http.Error(w, "missing target format", http.StatusBadRequest)
		return
	}

	if header.Size > s.cfg.MaxUploadSize {
		http.Error(w, "file exceeds size limit", http.StatusRequestEntityTooLarge)
		return
	}

	tmpDir, err := security.SecureTempDir(s.cfg.TempDir)
	if err != nil {
		s.logger.Error("temp dir", "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	srcPath := filepath.Join(tmpDir, sanitizeName(header.Filename))
	dst, err := os.Create(srcPath)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	written, err := io.Copy(dst, file)
	dst.Close()
	if err != nil {
		os.RemoveAll(tmpDir)
		http.Error(w, "failed to save upload", http.StatusInternalServerError)
		return
	}
	if written == 0 {
		os.RemoveAll(tmpDir)
		http.Error(w, "empty file", http.StatusBadRequest)
		return
	}

	params := map[string]interface{}{
		"target":   targetFormat,
		"filename": header.Filename,
		"size":     written,
	}

	job, err := s.jobs.Submit("convert", srcPath, params)
	if err != nil {
		os.RemoveAll(tmpDir)
		http.Error(w, err.Error(), http.StatusServiceUnavailable)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"job_id": job.ID,
		"status": job.Status,
	})
}

func (s *Server) handleConverterJob(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	job, ok := s.jobs.Get(id)
	if !ok {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(job)
}

func sanitizeName(name string) string {
	name = filepath.Base(name)
	name = strings.ReplaceAll(name, "..", "")
	if name == "" {
		return "upload"
	}
	return name
}

func mimeToExt(mime string) string {
	switch mime {
	case "image/png":
		return ".png"
	case "image/jpeg":
		return ".jpg"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	case "image/bmp":
		return ".bmp"
	case "image/tiff":
		return ".tiff"
	case "audio/wav":
		return ".wav"
	case "audio/mpeg":
		return ".mp3"
	case "video/mp4":
		return ".mp4"
	case "video/webm":
		return ".webm"
	case "text/plain":
		return ".txt"
	case "text/html":
		return ".html"
	case "text/markdown":
		return ".md"
	default:
		return ""
	}
}
