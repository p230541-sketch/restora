package dump

import (
	"bytes"
	"fmt"
	"os/exec"
)

// Run executes pg_dump against the given DSN and returns the SQL bytes.
func Run(dsn string) ([]byte, error) {
	cmd := exec.Command("pg_dump", "--no-password", "--format=plain", dsn)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("pg_dump failed: %w\nstderr: %s", err, stderr.String())
	}
	return stdout.Bytes(), nil
}
