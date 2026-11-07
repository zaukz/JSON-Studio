import type { ConversionMode } from './convert'

export const SAMPLE_DOCUMENT = `{
  "$schema": "https://jsonstudio.local/schema/workspace.json",
  "project": "orbit-analytics",
  "version": "2.4.0",
  "environment": "production",
  "description": "Realtime product telemetry for the Orbit dashboard.",
  "features": {
    "realtime": true,
    "auditLog": false,
    "maxSeats": 25,
    "roles": ["owner", "editor", "viewer"]
  },
  "regions": [
    { "id": "us-east-1", "latencyMs": 38, "primary": true },
    { "id": "eu-west-1", "latencyMs": 52, "primary": false },
    { "id": "ap-south-1", "latencyMs": 74, "primary": false }
  ],
  "limits": {
    "requestsPerMinute": 6000,
    "burst": 1200,
    "payloadKb": 512
  },
  "maintenance": {
    "window": "Sun 02:00-03:00 UTC",
    "autoRollback": true
  },
  "metadata": {
    "createdAt": "2025-03-14T09:21:00Z",
    "owner": null,
    "tags": ["infra", "analytics"],
    "notes": "Demo document - replace it with your own JSON."
  }
}
`

export const SAMPLE_COMPARE_LEFT = `{
  "service": "checkout-api",
  "version": "1.8.2",
  "replicas": 3,
  "regions": ["us-east-1", "eu-west-1"],
  "features": {
    "retries": true,
    "maxRetries": 3,
    "timeoutMs": 2500,
    "sentry": false
  },
  "env": {
    "LOG_LEVEL": "info",
    "CACHE_TTL": 60
  }
}
`

export const SAMPLE_COMPARE_RIGHT = `{
  "service": "checkout-api",
  "version": "1.9.0",
  "replicas": 4,
  "regions": ["us-east-1", "eu-west-1", "ap-south-1"],
  "features": {
    "retries": true,
    "maxRetries": 5,
    "timeoutMs": 2500,
    "circuitBreaker": true
  },
  "env": {
    "LOG_LEVEL": "warn",
    "CACHE_TTL": 60
  },
  "observability": {
    "tracing": "otel",
    "sampleRate": 0.25
  }
}
`

export const SAMPLE_YAML = `# Release pipeline for aurora-gateway
service: aurora-gateway
version: 3.1.0
strategy:
  type: rolling
  maxSurge: 25%
  maxUnavailable: 0
  steps:
    - pause: 30s
    - pause: 60s
environments:
  production:
    replicas: 6
    tracing: true
    regions:
      - iad
      - ams
  staging:
    replicas: 2
    tracing: false
`

export const SAMPLE_CSV_JSON = `[
  {
    "orderId": "ord_1042",
    "customer": "Maya Chen",
    "plan": "team",
    "seats": 12,
    "mrr": 348,
    "currency": "USD",
    "renewal": "2026-04-01",
    "status": "active"
  },
  {
    "orderId": "ord_1043",
    "customer": "Jules Moreau",
    "plan": "solo",
    "seats": 1,
    "mrr": 19,
    "currency": "EUR",
    "renewal": "2026-02-18",
    "status": "trial"
  },
  {
    "orderId": "ord_1044",
    "customer": "Ibrahim Okafor",
    "plan": "business",
    "seats": 40,
    "mrr": 1160,
    "currency": "USD",
    "renewal": null,
    "status": "active"
  },
  {
    "orderId": "ord_1045",
    "customer": "Sana Kapoor",
    "plan": "team",
    "seats": 8,
    "mrr": 232,
    "currency": "INR",
    "renewal": "2026-06-30",
    "status": "paused"
  }
]
`

export const SAMPLE_CONVERT_INPUTS: Record<ConversionMode, string> = {
  'json-to-yaml': SAMPLE_DOCUMENT,
  'yaml-to-json': SAMPLE_YAML,
  'json-to-csv': SAMPLE_CSV_JSON,
}
