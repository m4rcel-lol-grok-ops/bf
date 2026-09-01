package jobs

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/byteforge/byteforge/internal/security"
)

type Status string

const (
	StatusQueued     Status = "queued"
	StatusProcessing Status = "processing"
	StatusCompleted  Status = "completed"
	StatusFailed     Status = "failed"
	StatusExpired    Status = "expired"
)

type Job struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"`
	Status      Status                 `json:"status"`
	Progress    float64                `json:"progress"`
	Error       string                 `json:"error,omitempty"`
	ResultID    string                 `json:"result_id,omitempty"`
	Filename    string                 `json:"filename,omitempty"`
	MimeType    string                 `json:"mime_type,omitempty"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
	ExpiresAt   time.Time              `json:"expires_at"`
	InputPath   string                 `json:"-"`
	OutputPath  string                 `json:"-"`
	Params      map[string]interface{} `json:"params,omitempty"`
	cancel      context.CancelFunc
}

type WorkerFunc func(ctx context.Context, job *Job) error

type Manager struct {
	mu          sync.RWMutex
	jobs        map[string]*Job
	queue       chan *Job
	workers     int
	ttl         time.Duration
	downloads   *security.DownloadStore
	logger      *slog.Logger
	handlers    map[string]WorkerFunc
	wg          sync.WaitGroup
	ctx         context.Context
	cancel      context.CancelFunc
}

func NewManager(workers int, ttl time.Duration, downloads *security.DownloadStore, logger *slog.Logger) *Manager {
	ctx, cancel := context.WithCancel(context.Background())
	m := &Manager{
		jobs:      make(map[string]*Job),
		queue:     make(chan *Job, 100),
		workers:   workers,
		ttl:       ttl,
		downloads: downloads,
		logger:    logger,
		handlers:  make(map[string]WorkerFunc),
		ctx:       ctx,
		cancel:    cancel,
	}
	for i := 0; i < workers; i++ {
		m.wg.Add(1)
		go m.worker(i)
	}
	return m
}

func (m *Manager) Register(jobType string, fn WorkerFunc) {
	m.handlers[jobType] = fn
}

func (m *Manager) Submit(jobType string, inputPath string, params map[string]interface{}) (*Job, error) {
	id, err := security.GenerateSecureID(16)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	job := &Job{
		ID:        id,
		Type:      jobType,
		Status:    StatusQueued,
		Progress:  0,
		CreatedAt: now,
		UpdatedAt: now,
		ExpiresAt: now.Add(m.ttl),
		InputPath: inputPath,
		Params:    params,
	}

	m.mu.Lock()
	m.jobs[id] = job
	m.mu.Unlock()

	select {
	case m.queue <- job:
		return job, nil
	default:
		m.mu.Lock()
		delete(m.jobs, id)
		m.mu.Unlock()
		return nil, fmt.Errorf("job queue full")
	}
}

func (m *Manager) Get(id string) (*Job, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	j, ok := m.jobs[id]
	return j, ok
}

func (m *Manager) worker(id int) {
	defer m.wg.Done()
	for {
		select {
		case <-m.ctx.Done():
			return
		case job := <-m.queue:
			m.process(job)
		}
	}
}

func (m *Manager) process(job *Job) {
	handler, ok := m.handlers[job.Type]
	if !ok {
		m.fail(job, fmt.Errorf("unknown job type: %s", job.Type))
		return
	}

	m.update(job, StatusProcessing, 0, "")

	ctx, cancel := context.WithTimeout(m.ctx, 2*time.Minute)
	job.cancel = cancel
	defer cancel()

	err := handler(ctx, job)
	if err != nil {
		m.fail(job, err)
		return
	}

	if job.OutputPath != "" {
		resultID, err := m.downloads.Register(job.OutputPath, job.Filename, job.MimeType)
		if err != nil {
			m.fail(job, err)
			return
		}
		job.ResultID = resultID
	}

	m.update(job, StatusCompleted, 100, "")
}

func (m *Manager) update(job *Job, status Status, progress float64, errMsg string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	job.Status = status
	job.Progress = progress
	job.Error = errMsg
	job.UpdatedAt = time.Now()
}

func (m *Manager) fail(job *Job, err error) {
	m.logger.Error("job failed", "job_id", job.ID, "type", job.Type, "error", err)
	m.update(job, StatusFailed, job.Progress, err.Error())
}

func (m *Manager) Cleanup() {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := time.Now()
	for id, job := range m.jobs {
		if now.After(job.ExpiresAt) || job.Status == StatusCompleted || job.Status == StatusFailed {
			if job.InputPath != "" {
				// cleanup handled elsewhere
			}
			delete(m.jobs, id)
		}
	}
}

func (m *Manager) Shutdown() {
	m.cancel()
	m.wg.Wait()
}
