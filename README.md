# Distributed Rate Limiter

A configurable, distributed rate-limiting library built with **Bun, JavaScript, and Redis**, designed to explore request throttling, concurrency control, and production-oriented backend engineering.

The project aims to provide multiple rate-limiting algorithms, in-memory and distributed storage, atomic request processing, and a lightweight HTTP integration using Bun's native APIs.

> **Project Status:** Work in progress. Features described in the roadmap are planned and may not yet be implemented.

## Overview

Rate limiting is an essential component of modern backend systems. It helps prevent API abuse, protect infrastructure from excessive traffic, enforce usage quotas, and maintain service availability.

This project explores how different rate-limiting algorithms behave under real-world traffic patterns, including sudden bursts, concurrent requests, and multiple application instances.

The primary objectives are:

- Implement and compare commonly used rate-limiting algorithms.
- Support both in-memory and Redis-backed rate limiting.
- Ensure atomic state updates in distributed environments.
- Develop a clean, reusable JavaScript API.
- Measure performance under different workloads.
- Explore production engineering trade-offs and failure scenarios.

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Bun |
| Language | JavaScript (ES Modules) |
| HTTP Server | Bun.serve() |
| Distributed State | Redis |
| Redis Client | Bun Native RedisClient |
| Atomic Operations | Redis Lua Scripts |
| Testing | bun:test |
| Infrastructure | Docker Compose |

## Rate-Limiting Algorithms

The project is designed to support five algorithms, each with different performance characteristics and trade-offs.

| Algorithm | Description |
|---|---|
| Fixed Window Counter | Counts requests within fixed time intervals. |
| Sliding Window Log | Tracks individual request timestamps for precise rolling-window enforcement. |
| Sliding Window Counter | Estimates rolling-window usage using weighted adjacent windows. |
| Token Bucket | Refills tokens over time and allows configurable request bursts. |
| Leaky Bucket | Controls request flow using a fixed leakage rate. |

Each implementation will be evaluated for correctness, time complexity, memory requirements, and behavior under different traffic patterns.

## Architecture

The system separates the rate-limiting logic from HTTP handling and storage infrastructure.

```text
                 Incoming Requests
                         |
                         v
                Bun HTTP Server
                         |
                         v
                  Rate Limiter
                         |
                Policy Evaluation
                         |
                         v
                Algorithm Engine
                         |
              +----------+----------+
              |                     |
              v                     v
        In-Memory Store        Redis Store
         (JavaScript Map)     (Bun RedisClient)
                                    |
                                    v
                             Redis Lua Scripts
                             (Atomic Operations)
                         |
                         v
                 Allow / Reject
```

This separation is intended to make the core algorithms testable and reusable independently of the HTTP server.

## Planned Features

### Rate Limiting

- Five configurable rate-limiting algorithms.
- Per-IP, per-user, and per-API-key limits.
- Route-specific rate-limit policies.
- Custom request costs and burst allowances.
- Configurable limits and time windows.

### Distributed Systems

- Redis-backed shared state across application instances.
- Atomic quota enforcement using Lua scripts.
- Concurrency-safe request processing.
- Redis key expiration and state management.
- Configurable behavior during storage failures.

### HTTP Integration

- Native Bun.serve() integration.
- HTTP `429 Too Many Requests` responses.
- `Retry-After` and applicable rate-limit headers.
- Custom request identity extraction.

### Testing and Observability

- Unit and integration tests.
- Deterministic time-based testing.
- Concurrent request simulations.
- Load testing and benchmarking.
- Request metrics and latency measurements.

## Example API

The following demonstrates the intended API design and is not yet a guaranteed working interface.

```javascript
import { createRateLimiter } from "./src/index.js";

const limiter = createRateLimiter({
  algorithm: "token-bucket",
  capacity: 100,
  refillRate: 10,
});

const result = await limiter.consume("user:123");

if (!result.allowed) {
  console.log("Rate limit exceeded");
}
```

The library is intended to expose a consistent API across different algorithms and storage backends.

## Development Roadmap

- [ ] Implement in-memory rate-limiting algorithms.
- [ ] Add deterministic tests and boundary-case coverage.
- [ ] Integrate Bun's native Redis client.
- [ ] Implement atomic Redis operations using Lua.
- [ ] Support distributed rate limiting across multiple Bun instances.
- [ ] Build Bun.serve() HTTP integration.
- [ ] Add configurable policies and request identification.
- [ ] Implement failure handling and observability.
- [ ] Conduct load testing and performance benchmarking.
- [ ] Prepare reusable package exports and documentation.

## Engineering Considerations

Beyond implementing individual algorithms, this project explores several important backend engineering challenges.

**Concurrency and atomicity:** Multiple application instances must be able to enforce shared quotas without permitting extra requests due to race conditions.

**Memory efficiency:** Rate-limiting state must be managed carefully to avoid unnecessary memory growth, particularly with algorithms that retain request timestamps.

**Distributed consistency:** Redis scripting can guarantee atomic script execution on a single Redis server, but failover, replication, and multi-region deployments introduce additional consistency considerations.

**Fault tolerance:** Different applications may require different behavior when the rate-limiting storage layer becomes unavailable.

**Performance:** Algorithm selection involves trade-offs between precision, throughput, latency, and memory consumption.

## Project Goals

This project is both a reusable backend engineering tool and an exploration of distributed systems concepts.

The aim is to develop a well-tested, maintainable rate limiter while documenting important architectural decisions, performance characteristics, and real-world limitations.

## License

License to be determined.
