package security

import (
	"fmt"
	"net"
	"net/url"
	"strings"
)

var blockedCIDRs = []string{
	"127.0.0.0/8",
	"10.0.0.0/8",
	"172.16.0.0/12",
	"192.168.0.0/16",
	"169.254.0.0/16",
	"::1/128",
	"fc00::/7",
	"fe80::/10",
	"0.0.0.0/8",
	"100.64.0.0/10",
	"192.0.0.0/24",
	"192.0.2.0/24",
	"198.51.100.0/24",
	"203.0.113.0/24",
	"224.0.0.0/4",
	"240.0.0.0/4",
}

var blockedNets []*net.IPNet

func init() {
	for _, cidr := range blockedCIDRs {
		_, n, err := net.ParseCIDR(cidr)
		if err == nil {
			blockedNets = append(blockedNets, n)
		}
	}
}

func IsBlockedIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsUnspecified() {
		return true
	}
	for _, n := range blockedNets {
		if n.Contains(ip) {
			return true
		}
	}
	return false
}

func ValidateURLForSSRF(rawURL string) error {
	u, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("invalid URL: %w", err)
	}

	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("unsupported scheme: %s", u.Scheme)
	}

	host := u.Hostname()
	if host == "" {
		return fmt.Errorf("missing host")
	}

	// Block obvious localhost names
	lower := strings.ToLower(host)
	if lower == "localhost" || lower == "localhost.localdomain" || strings.HasSuffix(lower, ".localhost") {
		return fmt.Errorf("blocked host: %s", host)
	}

	// Resolve and check all IPs
	ips, err := net.LookupIP(host)
	if err != nil {
		return fmt.Errorf("DNS lookup failed: %w", err)
	}
	if len(ips) == 0 {
		return fmt.Errorf("no IPs resolved for host")
	}

	for _, ip := range ips {
		if IsBlockedIP(ip) {
			return fmt.Errorf("blocked IP address: %s", ip.String())
		}
	}

	return nil
}

func IsSafeRedirect(rawURL string) bool {
	return ValidateURLForSSRF(rawURL) == nil
}
