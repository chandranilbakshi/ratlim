# Project Progress

## Current phase

Phase 1 — JavaScript fundamentals and in-memory algorithms.

## Completed milestones

- Verified the local runtime: Bun 1.4.0.
- Initialized a dependency-free JavaScript ES module package.
- Added a minimal `bun:test` smoke test.
- Token Bucket core passes ad hoc controlled-time checks for bursts, rejection, fractional refill, exact refill boundary, independent clients, capacity cap, and retry rounding.

## Current task

Understand retry-delay arithmetic, then add input validation and persistent deterministic Token Bucket tests.

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
- Practiced retrieving client state on both initialization paths, capping refill at capacity, and returning limiter methods and decision objects.

## Topics requiring revision

- `var` versus `let` scope, initialization on every branch, and the temporal dead zone.
- Object property shorthand requires an existing variable.
- Converting milliseconds to seconds and capping refill at capacity.
- Returning methods from a factory and returning decision objects from methods.

## Known bugs or limitations

- Input validation is missing; current checks cover valid configuration and nondecreasing time only.
- Backward clock movement and floating-point boundary behavior still need dedicated review/tests.
- Only the setup smoke test exists; no algorithm behavior is tested yet.
- The package has no public exports yet.
- Storage is not shared across processes and is lost on restart.

## Next milestone

Review the Token Bucket implementation and add deterministic correctness tests.
