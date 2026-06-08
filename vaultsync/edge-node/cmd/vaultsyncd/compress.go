package main

import (
	"bytes"
	"compress/gzip"
)

// gzipBytes compresses data with gzip. Run on the plaintext dump BEFORE
// encryption — encrypted output is high-entropy and does not compress.
func gzipBytes(data []byte) ([]byte, error) {
	var buf bytes.Buffer
	gw := gzip.NewWriter(&buf)
	if _, err := gw.Write(data); err != nil {
		return nil, err
	}
	if err := gw.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
