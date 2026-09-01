package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Host                string
	Port                int
	DataDir             string
	TempDir             string
	MaxUploadSize       int64
	MaxPDFSize          int64
	MaxImageSize        int64
	MaxArchiveSize      int64
	MaxProcessingTime   time.Duration
	MaxConcurrentJobs   int
	TempFileTTL         time.Duration
	CleanupInterval     time.Duration
	RateLimitRequests   int
	RateLimitWindow     time.Duration
	LogLevel            string
	ReadTimeout         time.Duration
	ReadHeaderTimeout   time.Duration
	WriteTimeout        time.Duration
	IdleTimeout         time.Duration
	MaxHeaderBytes      int
}

func Load() (*Config, error) {
	cfg := &Config{
		Host:              getEnv("APP_HOST", "0.0.0.0"),
		Port:              getEnvInt("APP_PORT", 18527),
		DataDir:           getEnv("DATA_DIR", "/data"),
		TempDir:           getEnv("TEMP_DIR", "/tmp/byteforge"),
		MaxUploadSize:     getEnvSize("MAX_UPLOAD_SIZE", 100*1024*1024),
		MaxPDFSize:        getEnvSize("MAX_PDF_SIZE", 100*1024*1024),
		MaxImageSize:      getEnvSize("MAX_IMAGE_SIZE", 50*1024*1024),
		MaxArchiveSize:    getEnvSize("MAX_ARCHIVE_SIZE", 100*1024*1024),
		MaxProcessingTime: getEnvDuration("MAX_PROCESSING_TIME", 120*time.Second),
		MaxConcurrentJobs: getEnvInt("MAX_CONCURRENT_JOBS", 2),
		TempFileTTL:       getEnvDuration("TEMP_FILE_TTL", 3600*time.Second),
		CleanupInterval:   getEnvDuration("CLEANUP_INTERVAL", 300*time.Second),
		RateLimitRequests: getEnvInt("RATE_LIMIT_REQUESTS", 60),
		RateLimitWindow:   getEnvDuration("RATE_LIMIT_WINDOW", time.Minute),
		LogLevel:          getEnv("LOG_LEVEL", "info"),
		ReadTimeout:       getEnvDuration("READ_TIMEOUT", 30*time.Second),
		ReadHeaderTimeout: getEnvDuration("READ_HEADER_TIMEOUT", 10*time.Second),
		WriteTimeout:      getEnvDuration("WRITE_TIMEOUT", 120*time.Second),
		IdleTimeout:       getEnvDuration("IDLE_TIMEOUT", 120*time.Second),
		MaxHeaderBytes:    getEnvInt("MAX_HEADER_BYTES", 1<<20),
	}

	if cfg.Port < 1 || cfg.Port > 65535 {
		return nil, fmt.Errorf("invalid APP_PORT: %d", cfg.Port)
	}

	return cfg, nil
}

func (c *Config) Addr() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func getEnvInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return def
}

func getEnvSize(key string, def int64) int64 {
	if v := os.Getenv(key); v != "" {
		v = strings.TrimSpace(strings.ToUpper(v))
		multiplier := int64(1)
		if strings.HasSuffix(v, "KB") {
			multiplier = 1024
			v = strings.TrimSuffix(v, "KB")
		} else if strings.HasSuffix(v, "MB") {
			multiplier = 1024 * 1024
			v = strings.TrimSuffix(v, "MB")
		} else if strings.HasSuffix(v, "GB") {
			multiplier = 1024 * 1024 * 1024
			v = strings.TrimSuffix(v, "GB")
		} else if strings.HasSuffix(v, "B") {
			v = strings.TrimSuffix(v, "B")
		}
		if i, err := strconv.ParseInt(strings.TrimSpace(v), 10, 64); err == nil {
			return i * multiplier
		}
	}
	return def
}

func getEnvDuration(key string, def time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
		if secs, err := strconv.Atoi(v); err == nil {
			return time.Duration(secs) * time.Second
		}
	}
	return def
}
