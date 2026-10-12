# Project Progress

## Current phase

Phase 1 — JavaScript fundamentals and in-memory algorithms.

## Completed milestones

- Verified the local runtime: Bun 1.4.0.
- Initialized a dependency-free JavaScript ES module package.
- Added a minimal `bun:test` smoke test.

## Current task

Implement the in-memory Token Bucket algorithm.

## Architectural decisions

- Fixed Window Counter is intentionally excluded from this project at the learner's request.
- Algorithm order: Token Bucket, Leaky Bucket, Sliding Window Log, then Sliding Window Counter.
- Token Bucket starts full, refills continuously in tokens per second, caps tokens at capacity, and charges only allowed requests. Time is measured in milliseconds; fractional tokens are retained.
- The first task uses unit-cost requests. Configurable costs will be a follow-up exercise.
- Core algorithms remain independent of Bun HTTP and Redis APIs.
- Time will be provided through an injectable clock so tests do not depend on wall-clock time or fake timers.
- The initial implementation will be synchronous and in-memory. Redis-backed behavior will be introduced only after the in-memory semantics are correct.
- No generic storage interface will be introduced yet because the algorithms need different state shapes and operations.
- Leaky Bucket semantics (meter/rejection or queue) remain undecided until that milestone.

## Concepts learned

- Pending: `Map`, closures, object state, elapsed-time arithmetic, fractional tokens, injected functions, and boundary conditions.

## Topics requiring revision

- None recorded yet.

## Known bugs or limitations

- No limiter algorithm has been implemented yet.
- The package has no public exports yet.
- Storage is not shared across processes and is lost on restart.

## Next milestone

Review the Token Bucket implementation and add deterministic correctness tests.
