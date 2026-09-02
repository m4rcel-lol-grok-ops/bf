package converter

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/m4rcel-lol-grok-ops/bf/internal/jobs"
)

func Register(m *jobs.Manager) {
	m.Register("convert", handleConvert)
	m.Register("pdf_info", handlePDFInfo)
}

func handleConvert(ctx context.Context, job *jobs.Job) error {
	target, _ := job.Params["target"].(string)
	filename, _ := job.Params["filename"].(string)
	if target == "" {
		return fmt.Errorf("missing target format")
	}

	src := job.InputPath
	ext := mimeToExt(target)
	if ext == "" {
		return fmt.Errorf("unsupported target: %s", target)
	}

	outName := strings.TrimSuffix(filepath.Base(filename), filepath.Ext(filename)) + ext
	outPath := filepath.Join(filepath.Dir(src), outName)

	srcExt := strings.ToLower(filepath.Ext(src))
	srcMime := extToMime(srcExt)

	// Image conversions via ImageMagick convert if available, else ffmpeg
	if strings.HasPrefix(srcMime, "image/") || strings.HasPrefix(target, "image/") {
		if err := convertImage(ctx, src, outPath, target); err != nil {
			return err
		}
	} else if strings.HasPrefix(srcMime, "audio/") || strings.HasPrefix(target, "audio/") {
		if err := convertMedia(ctx, src, outPath); err != nil {
			return err
		}
	} else if strings.HasPrefix(srcMime, "video/") || strings.HasPrefix(target, "video/") {
		if err := convertMedia(ctx, src, outPath); err != nil {
			return err
		}
	} else if strings.HasPrefix(srcMime, "text/") || strings.HasPrefix(target, "text/") {
		if err := convertText(src, outPath, target); err != nil {
			return err
		}
	} else {
		return fmt.Errorf("unsupported conversion from %s to %s", srcMime, target)
	}

	job.OutputPath = outPath
	job.Filename = outName
	job.MimeType = target
	return nil
}

func handlePDFInfo(ctx context.Context, job *jobs.Job) error {
	// Placeholder for PDF info; real PDF editing would use more advanced libs
	job.Filename = filepath.Base(job.InputPath)
	job.MimeType = "application/pdf"
	job.OutputPath = job.InputPath
	return nil
}

func convertImage(ctx context.Context, src, dst, target string) error {
	// Prefer magick/convert
	bin := findBin("magick", "convert")
	if bin != "" {
		args := []string{src, dst}
		if bin == "magick" {
			args = []string{src, dst}
		}
		cmd := exec.CommandContext(ctx, bin, args...)
		cmd.Env = []string{"PATH=/usr/local/bin:/usr/bin:/bin", "HOME=/tmp"}
		out, err := cmd.CombinedOutput()
		if err != nil {
			return fmt.Errorf("imagemagick: %v: %s", err, string(out))
		}
		return nil
	}

	// Fallback to ffmpeg for some formats
	return convertMedia(ctx, src, dst)
}

func convertMedia(ctx context.Context, src, dst string) error {
	bin := findBin("ffmpeg")
	if bin == "" {
		return fmt.Errorf("ffmpeg not available")
	}
	ctx, cancel := context.WithTimeout(ctx, 90*time.Second)
	defer cancel()

	args := []string{
		"-y", "-i", src,
		"-hide_banner", "-loglevel", "error",
		dst,
	}
	cmd := exec.CommandContext(ctx, bin, args...)
	cmd.Env = []string{"PATH=/usr/local/bin:/usr/bin:/bin", "HOME=/tmp"}
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("ffmpeg: %v: %s", err, string(out))
	}
	return nil
}

func convertText(src, dst, target string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	// Simple pass-through / basic conversion
	return os.WriteFile(dst, data, 0600)
}

func findBin(names ...string) string {
	for _, n := range names {
		if p, err := exec.LookPath(n); err == nil {
			return p
		}
	}
	return ""
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

func extToMime(ext string) string {
	switch strings.ToLower(ext) {
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".webp":
		return "image/webp"
	case ".gif":
		return "image/gif"
	case ".bmp":
		return "image/bmp"
	case ".tiff", ".tif":
		return "image/tiff"
	case ".svg":
		return "image/svg+xml"
	case ".mp3":
		return "audio/mpeg"
	case ".wav":
		return "audio/wav"
	case ".mp4":
		return "video/mp4"
	case ".webm":
		return "video/webm"
	case ".txt":
		return "text/plain"
	case ".md", ".markdown":
		return "text/markdown"
	case ".html", ".htm":
		return "text/html"
	case ".csv":
		return "text/csv"
	case ".pdf":
		return "application/pdf"
	default:
		return "application/octet-stream"
	}
}
