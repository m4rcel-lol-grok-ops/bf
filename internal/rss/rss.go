package rss

import (
	"context"
	"database/sql"
	"encoding/xml"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/byteforge/byteforge/internal/security"
	"github.com/byteforge/byteforge/internal/storage"
)

type Feed struct {
	ID            int64  `json:"id"`
	URL           string `json:"url"`
	Title         string `json:"title"`
	Description   string `json:"description"`
	Link          string `json:"link"`
	LastFetchedAt string `json:"last_fetched_at,omitempty"`
	LastError     string `json:"last_error,omitempty"`
	CreatedAt     string `json:"created_at"`
	UpdatedAt     string `json:"updated_at"`
	ItemCount     int    `json:"item_count,omitempty"`
}

type Item struct {
	ID          int64  `json:"id"`
	FeedID      int64  `json:"feed_id"`
	GUID        string `json:"guid"`
	Title       string `json:"title"`
	Link        string `json:"link"`
	Description string `json:"description"`
	Content     string `json:"content,omitempty"`
	Author      string `json:"author,omitempty"`
	PublishedAt string `json:"published_at,omitempty"`
	IsRead      bool   `json:"is_read"`
	IsFavorite  bool   `json:"is_favorite"`
	CreatedAt   string `json:"created_at"`
}

func ListFeeds(db *storage.DB) ([]Feed, error) {
	rows, err := db.Query(`
		SELECT f.id, f.url, f.title, f.description, f.link, f.last_fetched_at, f.last_error, f.created_at, f.updated_at,
		       (SELECT COUNT(*) FROM feed_items WHERE feed_id = f.id) as item_count
		FROM feeds f ORDER BY f.created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var feeds []Feed
	for rows.Next() {
		var f Feed
		var lastFetched, lastError sql.NullString
		if err := rows.Scan(&f.ID, &f.URL, &f.Title, &f.Description, &f.Link, &lastFetched, &lastError, &f.CreatedAt, &f.UpdatedAt, &f.ItemCount); err != nil {
			return nil, err
		}
		if lastFetched.Valid {
			f.LastFetchedAt = lastFetched.String
		}
		if lastError.Valid {
			f.LastError = lastError.String
		}
		feeds = append(feeds, f)
	}
	if feeds == nil {
		feeds = []Feed{}
	}
	return feeds, nil
}

func AddFeed(db *storage.DB, rawURL string, logger *slog.Logger) (*Feed, error) {
	if err := security.ValidateURLForSSRF(rawURL); err != nil {
		return nil, err
	}

	now := time.Now().UTC().Format(time.RFC3339)
	res, err := db.Exec(`INSERT INTO feeds (url, title, created_at, updated_at) VALUES (?, ?, ?, ?)`,
		rawURL, rawURL, now, now)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return nil, fmt.Errorf("feed already exists")
		}
		return nil, err
	}
	id, _ := res.LastInsertId()

	feed := &Feed{ID: id, URL: rawURL, Title: rawURL, CreatedAt: now, UpdatedAt: now}

	// Fetch immediately
	if err := fetchAndStore(db, id, rawURL, logger); err != nil {
		_, _ = db.Exec(`UPDATE feeds SET last_error = ?, updated_at = ? WHERE id = ?`, err.Error(), now, id)
		feed.LastError = err.Error()
	}

	return feed, nil
}

func DeleteFeed(db *storage.DB, id int64) error {
	res, err := db.Exec(`DELETE FROM feeds WHERE id = ?`, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("feed not found")
	}
	return nil
}

func RefreshFeed(db *storage.DB, id int64, logger *slog.Logger) error {
	var url string
	err := db.QueryRow(`SELECT url FROM feeds WHERE id = ?`, id).Scan(&url)
	if err != nil {
		return fmt.Errorf("feed not found")
	}
	return fetchAndStore(db, id, url, logger)
}

func fetchAndStore(db *storage.DB, feedID int64, rawURL string, logger *slog.Logger) error {
	if err := security.ValidateURLForSSRF(rawURL); err != nil {
		return err
	}

	client := &http.Client{
		Timeout: 15 * time.Second,
		Transport: &http.Transport{
			DialContext: (&net.Dialer{
				Timeout: 5 * time.Second,
			}).DialContext,
			ResponseHeaderTimeout: 10 * time.Second,
			DisableKeepAlives:     true,
		},
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 3 {
				return fmt.Errorf("too many redirects")
			}
			if err := security.ValidateURLForSSRF(req.URL.String()); err != nil {
				return err
			}
			return nil
		},
	}

	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, rawURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "Byteforge/1.0 RSS Reader")
	req.Header.Set("Accept", "application/rss+xml, application/atom+xml, application/xml, text/xml, */*")

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("fetch failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	limited := io.LimitReader(resp.Body, 5*1024*1024) // 5MB max
	body, err := io.ReadAll(limited)
	if err != nil {
		return fmt.Errorf("read body: %w", err)
	}

	feed, items, err := parseFeed(body)
	if err != nil {
		return fmt.Errorf("parse feed: %w", err)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	_, err = db.Exec(`UPDATE feeds SET title = ?, description = ?, link = ?, last_fetched_at = ?, last_error = NULL, updated_at = ? WHERE id = ?`,
		feed.Title, feed.Description, feed.Link, now, now, feedID)
	if err != nil {
		return err
	}

	for _, it := range items {
		guid := it.GUID
		if guid == "" {
			guid = it.Link
		}
		if guid == "" {
			continue
		}
		_, err := db.Exec(`
			INSERT INTO feed_items (feed_id, guid, title, link, description, content, author, published_at, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(feed_id, guid) DO UPDATE SET
				title = excluded.title,
				link = excluded.link,
				description = excluded.description,
				content = excluded.content,
				author = excluded.author,
				published_at = excluded.published_at
		`, feedID, guid, it.Title, it.Link, it.Description, it.Content, it.Author, it.PublishedAt, now)
		if err != nil {
			logger.Warn("insert item", "error", err)
		}
	}

	return nil
}

func ListItems(db *storage.DB, feedID int64, unreadOnly, favoriteOnly bool, q string, limit, offset int) ([]Item, error) {
	query := `SELECT id, feed_id, guid, title, link, description, content, author, published_at, is_read, is_favorite, created_at FROM feed_items WHERE 1=1`
	args := []interface{}{}

	if feedID > 0 {
		query += ` AND feed_id = ?`
		args = append(args, feedID)
	}
	if unreadOnly {
		query += ` AND is_read = 0`
	}
	if favoriteOnly {
		query += ` AND is_favorite = 1`
	}
	if q != "" {
		query += ` AND (title LIKE ? OR description LIKE ?)`
		like := "%" + q + "%"
		args = append(args, like, like)
	}
	query += ` ORDER BY COALESCE(published_at, created_at) DESC LIMIT ? OFFSET ?`
	args = append(args, limit, offset)

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []Item
	for rows.Next() {
		var it Item
		var isRead, isFav int
		var content, author, published sql.NullString
		if err := rows.Scan(&it.ID, &it.FeedID, &it.GUID, &it.Title, &it.Link, &it.Description, &content, &author, &published, &isRead, &isFav, &it.CreatedAt); err != nil {
			return nil, err
		}
		it.IsRead = isRead == 1
		it.IsFavorite = isFav == 1
		if content.Valid {
			it.Content = content.String
		}
		if author.Valid {
			it.Author = author.String
		}
		if published.Valid {
			it.PublishedAt = published.String
		}
		items = append(items, it)
	}
	if items == nil {
		items = []Item{}
	}
	return items, nil
}

func MarkRead(db *storage.DB, id int64, read bool) error {
	val := 0
	if read {
		val = 1
	}
	res, err := db.Exec(`UPDATE feed_items SET is_read = ? WHERE id = ?`, val, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("item not found")
	}
	return nil
}

func ToggleFavorite(db *storage.DB, id int64) (bool, error) {
	var current int
	err := db.QueryRow(`SELECT is_favorite FROM feed_items WHERE id = ?`, id).Scan(&current)
	if err != nil {
		return false, fmt.Errorf("item not found")
	}
	newVal := 1 - current
	_, err = db.Exec(`UPDATE feed_items SET is_favorite = ? WHERE id = ?`, newVal, id)
	return newVal == 1, err
}

// Minimal RSS/Atom parser
type rssRoot struct {
	XMLName xml.Name   `xml:"rss"`
	Channel rssChannel `xml:"channel"`
}

type rssChannel struct {
	Title       string    `xml:"title"`
	Description string    `xml:"description"`
	Link        string    `xml:"link"`
	Items       []rssItem `xml:"item"`
}

type rssItem struct {
	Title       string `xml:"title"`
	Link        string `xml:"link"`
	Description string `xml:"description"`
	Content     string `xml:"encoded"`
	Author      string `xml:"author"`
	GUID        string `xml:"guid"`
	PubDate     string `xml:"pubDate"`
}

type atomFeed struct {
	XMLName xml.Name    `xml:"feed"`
	Title   string      `xml:"title"`
	Subtitle string     `xml:"subtitle"`
	Link    []atomLink  `xml:"link"`
	Entries []atomEntry `xml:"entry"`
}

type atomLink struct {
	Href string `xml:"href,attr"`
	Rel  string `xml:"rel,attr"`
}

type atomEntry struct {
	Title   string     `xml:"title"`
	Link    []atomLink `xml:"link"`
	ID      string     `xml:"id"`
	Summary string     `xml:"summary"`
	Content string     `xml:"content"`
	Author  atomAuthor `xml:"author"`
	Updated string     `xml:"updated"`
	Published string   `xml:"published"`
}

type atomAuthor struct {
	Name string `xml:"name"`
}

type parsedFeed struct {
	Title       string
	Description string
	Link        string
}

type parsedItem struct {
	Title       string
	Link        string
	Description string
	Content     string
	Author      string
	GUID        string
	PublishedAt string
}

func parseFeed(data []byte) (*parsedFeed, []parsedItem, error) {
	// Try RSS 2.0
	var r rssRoot
	if err := xml.Unmarshal(data, &r); err == nil && r.Channel.Title != "" {
		items := make([]parsedItem, 0, len(r.Channel.Items))
		for _, it := range r.Channel.Items {
			items = append(items, parsedItem{
				Title:       it.Title,
				Link:        it.Link,
				Description: it.Description,
				Content:     it.Content,
				Author:      it.Author,
				GUID:        it.GUID,
				PublishedAt: it.PubDate,
			})
		}
		return &parsedFeed{
			Title:       r.Channel.Title,
			Description: r.Channel.Description,
			Link:        r.Channel.Link,
		}, items, nil
	}

	// Try Atom
	var a atomFeed
	if err := xml.Unmarshal(data, &a); err == nil && a.Title != "" {
		link := ""
		for _, l := range a.Link {
			if l.Rel == "" || l.Rel == "alternate" {
				link = l.Href
				break
			}
		}
		items := make([]parsedItem, 0, len(a.Entries))
		for _, e := range a.Entries {
			elink := ""
			for _, l := range e.Link {
				if l.Rel == "" || l.Rel == "alternate" {
					elink = l.Href
					break
				}
			}
			pub := e.Published
			if pub == "" {
				pub = e.Updated
			}
			items = append(items, parsedItem{
				Title:       e.Title,
				Link:        elink,
				Description: e.Summary,
				Content:     e.Content,
				Author:      e.Author.Name,
				GUID:        e.ID,
				PublishedAt: pub,
			})
		}
		return &parsedFeed{
			Title:       a.Title,
			Description: a.Subtitle,
			Link:        link,
		}, items, nil
	}

	return nil, nil, fmt.Errorf("unsupported or invalid feed format")
}
