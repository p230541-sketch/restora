package main

import (
	"bufio"
	"os"
	"strconv"
	"strings"
	"syscall"
	"time"
)

// processStart marks daemon boot, used to report real uptime.
var processStart = time.Now()

// Metrics is the real host/process telemetry served at /metrics.
type Metrics struct {
	CPUPercent     float64 `json:"cpu_percent"`
	MemUsedBytes   uint64  `json:"mem_used_bytes"`
	MemTotalBytes  uint64  `json:"mem_total_bytes"`
	MemPercent     float64 `json:"mem_percent"`
	DiskUsedBytes  uint64  `json:"disk_used_bytes"`
	DiskTotalBytes uint64  `json:"disk_total_bytes"`
	DiskPercent    float64 `json:"disk_percent"`
	UptimeSeconds  int64   `json:"uptime_seconds"`
}

func collectMetrics(path string) Metrics {
	m := Metrics{UptimeSeconds: int64(time.Since(processStart).Seconds())}
	m.CPUPercent = sampleCPU()
	m.MemUsedBytes, m.MemTotalBytes, m.MemPercent = readMem()
	m.DiskUsedBytes, m.DiskTotalBytes, m.DiskPercent = readDisk(path)
	return m
}

type cpuStat struct{ idle, total uint64 }

// sampleCPU computes CPU utilization by sampling /proc/stat twice.
func sampleCPU() float64 {
	a, ok1 := readCPUStat()
	time.Sleep(200 * time.Millisecond)
	b, ok2 := readCPUStat()
	if !ok1 || !ok2 {
		return 0
	}
	idleDelta := float64(b.idle - a.idle)
	totalDelta := float64(b.total - a.total)
	if totalDelta <= 0 {
		return 0
	}
	return clampPct((1 - idleDelta/totalDelta) * 100)
}

func readCPUStat() (cpuStat, bool) {
	f, err := os.Open("/proc/stat")
	if err != nil {
		return cpuStat{}, false
	}
	defer f.Close()

	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := sc.Text()
		if !strings.HasPrefix(line, "cpu ") {
			continue
		}
		fields := strings.Fields(line)[1:]
		var total, idle uint64
		for i, fs := range fields {
			v, _ := strconv.ParseUint(fs, 10, 64)
			total += v
			if i == 3 { // 4th column is idle
				idle = v
			}
		}
		return cpuStat{idle: idle, total: total}, true
	}
	return cpuStat{}, false
}

func readMem() (used, total uint64, pct float64) {
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return 0, 0, 0
	}
	defer f.Close()

	var memTotal, memAvail uint64
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		fields := strings.Fields(sc.Text())
		if len(fields) < 2 {
			continue
		}
		v, _ := strconv.ParseUint(fields[1], 10, 64) // values are in kB
		switch fields[0] {
		case "MemTotal:":
			memTotal = v * 1024
		case "MemAvailable:":
			memAvail = v * 1024
		}
	}
	if memTotal == 0 {
		return 0, 0, 0
	}
	used = memTotal - memAvail
	return used, memTotal, clampPct(float64(used) / float64(memTotal) * 100)
}

func readDisk(path string) (used, total uint64, pct float64) {
	var st syscall.Statfs_t
	if err := syscall.Statfs(path, &st); err != nil {
		return 0, 0, 0
	}
	bsize := uint64(st.Bsize)
	total = st.Blocks * bsize
	free := st.Bavail * bsize
	if total == 0 {
		return 0, 0, 0
	}
	used = total - free
	return used, total, clampPct(float64(used) / float64(total) * 100)
}

func clampPct(p float64) float64 {
	if p < 0 {
		return 0
	}
	if p > 100 {
		return 100
	}
	return p
}
