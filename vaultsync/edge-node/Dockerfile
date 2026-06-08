FROM golang:1.22-alpine AS builder
RUN apk add --no-cache postgresql16-client
WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /vaultsyncd ./cmd/vaultsyncd

FROM alpine:3.19
RUN apk add --no-cache postgresql16-client ca-certificates
COPY --from=builder /vaultsyncd /usr/local/bin/vaultsyncd
RUN mkdir -p /var/spool/vaultsyncd
ENTRYPOINT ["/usr/local/bin/vaultsyncd"]
