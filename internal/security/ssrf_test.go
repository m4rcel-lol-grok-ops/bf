package security

import (
	"net"
	"testing"
)

func TestIsBlockedIP(t *testing.T) {
	cases := []struct {
		ip      string
		blocked bool
	}{
		{"127.0.0.1", true},
		{"10.0.0.1", true},
		{"192.168.1.1", true},
		{"172.16.0.1", true},
		{"169.254.169.254", true},
		{"8.8.8.8", false},
		{"1.1.1.1", false},
	}
	for _, c := range cases {
		ip := net.ParseIP(c.ip)
		got := IsBlockedIP(ip)
		if got != c.blocked {
			t.Errorf("IsBlockedIP(%s) = %v, want %v", c.ip, got, c.blocked)
		}
	}
}

func TestValidateURLForSSRF(t *testing.T) {
	if err := ValidateURLForSSRF("http://127.0.0.1/"); err == nil {
		t.Error("expected block for localhost")
	}
	if err := ValidateURLForSSRF("http://169.254.169.254/latest/meta-data/"); err == nil {
		t.Error("expected block for metadata")
	}
	if err := ValidateURLForSSRF("ftp://example.com"); err == nil {
		t.Error("expected block for non-http scheme")
	}
}
