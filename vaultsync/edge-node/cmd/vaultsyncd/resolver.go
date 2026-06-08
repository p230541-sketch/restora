package main

import (
	"github.com/aws/aws-sdk-go-v2/aws"
)

func endpointResolver(endpointURL string) aws.EndpointResolverWithOptionsFunc {
	return func(service, region string, options ...interface{}) (aws.Endpoint, error) {
		return aws.Endpoint{
			URL:               endpointURL,
			HostnameImmutable: true,
			SigningRegion:     region,
		}, nil
	}
}
