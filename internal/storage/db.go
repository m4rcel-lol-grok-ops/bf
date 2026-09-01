package storage

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

type DB struct {
	*sql.DB
}

func Open(dataDir string) (*DB, error) {
	if err := os.MkdirAll(dataDir, 0750); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}

	dbPath := filepath.Join(dataDir, "byteforge.db")
	dsn := fmt.Sprintf("file:%s?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(ON)&_pragma=synchronous(NORMAL)", dbPath)

	sqlDB, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	sqlDB.SetMaxOpenConns(10)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(time.Hour)

	if err := sqlDB.Ping(); err != nil {
		sqlDB.Close()
		return nil, fmt.Errorf("ping sqlite: %w", err)
	}

	db := &DB{sqlDB}
	if err := db.Migrate(); err != nil {
		sqlDB.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}

	return db, nil
}

func (db *DB) Migrate() error {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS schema_migrations (
			version INTEGER PRIMARY KEY,
			applied_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS feeds (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			url TEXT NOT NULL UNIQUE,
			title TEXT,
			description TEXT,
			link TEXT,
			last_fetched_at TEXT,
			last_error TEXT,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_feeds_url ON feeds(url)`,
		`CREATE TABLE IF NOT EXISTS feed_items (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			feed_id INTEGER NOT NULL,
			guid TEXT NOT NULL,
			title TEXT,
			link TEXT,
			description TEXT,
			content TEXT,
			author TEXT,
			published_at TEXT,
			is_read INTEGER NOT NULL DEFAULT 0,
			is_favorite INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL,
			FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE CASCADE,
			UNIQUE(feed_id, guid)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_feed_items_feed_id ON feed_items(feed_id)`,
		`CREATE INDEX IF NOT EXISTS idx_feed_items_is_read ON feed_items(is_read)`,
		`CREATE INDEX IF NOT EXISTS idx_feed_items_is_favorite ON feed_items(is_favorite)`,
		`CREATE INDEX IF NOT EXISTS idx_feed_items_published_at ON feed_items(published_at)`,
		`CREATE TABLE IF NOT EXISTS jobs (
			id TEXT PRIMARY KEY,
			type TEXT NOT NULL,
			status TEXT NOT NULL,
			input_path TEXT,
			output_path TEXT,
			error_message TEXT,
			progress REAL DEFAULT 0,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			expires_at TEXT
		)`,
		`CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)`,
		`CREATE INDEX IF NOT EXISTS idx_jobs_expires_at ON jobs(expires_at)`,
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for i, m := range migrations {
		var applied int
		err := tx.QueryRow(`SELECT COUNT(*) FROM schema_migrations WHERE version = ?`, i+1).Scan(&applied)
		if err != nil {
			// table may not exist yet
			if _, err2 := tx.Exec(migrations[0]); err2 != nil {
				return fmt.Errorf("create schema_migrations: %w", err2)
			}
			applied = 0
		}
		if applied == 0 {
			if _, err := tx.Exec(m); err != nil {
				return fmt.Errorf("migration %d: %w", i+1, err)
			}
			now := time.Now().UTC().Format(time.RFC3339)
			if _, err := tx.Exec(`INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)`, i+1, now); err != nil {
				return fmt.Errorf("record migration %d: %w", i+1, err)
			}
		}
	}

	return tx.Commit()
}

func (db *DB) Close() error {
	return db.DB.Close()
}
