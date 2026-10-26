# Project Progress

## Current phase

Phase 1 — JavaScript fundamentals and in-memory algorithms.

## Completed milestones

- Verified the local runtime: Bun 1.4.0.
- Initialized a dependency-free JavaScript ES module package.
- Added a minimal `bun:test` smoke test.
- Current Token Bucket revision passes ad hoc controlled-time checks for exhaustion, fractional refill, refill boundary, independent clients, and capacity cap.
- Fixed timestamp preservation and cleanup deletion target; connected private cleanup to an optional interval and exposed `close()` to stop it.
- Exposed `createTokenBucket` through `src/index.js` and the package exports entry.

## Current task

Leaky Bucket pacing, FIFO removal, error capture, and continuation are implemented. Fix the empty-queue guard (`length === 0`, not null) and add submission validation next. Tests and clock behavior remain deferred at the learner's request.

## Architectural decisions

- Fixed Window Counter is intentionally excluded from this project at the learner's request.
- Algorithm order: Token Bucket, Leaky Bucket, Sliding Window Log, then Sliding Window Counter.
- Token Bucket starts full, refills continuously in tokens per second, caps tokens at capacity, and charges only allowed requests. Time is measured in milliseconds; fractional tokens are retained.
- The first task uses unit-cost requests. Configurable costs will be a follow-up exercise.
- Core algorithms remain independent of Bun HTTP and Redis APIs.
- Time will be provided through an injectable clock so tests do not depend on wall-clock time or fake timers.
- The initial implementation will be synchronous and in-memory. Redis-backed behavior will be introduced only after the in-memory semantics are correct.
- Cleanup removes only entries whose buckets would be full. `cleanupInterval: 0` disables the timer; `close()` stops scheduled cleanup without disabling consume.
- The learner has deferred automated algorithm tests and clock-behavior handling while continuing the algorithm learning sequence. Token Bucket remains a working draft, not a completed correctness milestone.
- No generic storage interface will be introduced yet because the algorithms need different state shapes and operations.
- Leaky Bucket uses the learner-selected queue-based behavior with `schedule(key, task)` returning the task's eventual result through a Promise.
- Each client has an independent FIFO waiting queue. Capacity excludes the running job; the first job may start immediately. Subsequent starts are separated by at least `1000 / leakRate` milliseconds, with at most one running job per client and no accumulated idle burst allowance.
- Queue overflow rejects submissions; task failure must settle its Promise and allow subsequent work to proceed. Timer lifecycle, shutdown, idle-state reclamation, and cancellation need explicit handling before this scheduler is complete.

## Concepts learned

- Pending: `Map`, closures, object state, elapsed-time arithmetic, fractional tokens, injected functions, and boundary conditions.
- Practiced retrieving client state on both initialization paths, capping refill at capacity, and returning limiter methods and decision objects.
- Practiced per-job result Promises, async/await, queue processing, timer handles, and start-time pacing; revisit these incrementally to consolidate understanding.

## Topics requiring revision

- `var` versus `let` scope, initialization on every branch, and the temporal dead zone.
- Object property shorthand requires an existing variable.
- Converting milliseconds to seconds and capping refill at capacity.
- Returning methods from a factory and returning decision objects from methods.

## Known bugs or limitations

- Capacity/refill validation is now at factory creation. Cleanup interval validation incorrectly rejects zero, preventing the documented timer-disable option. Clock-function validation is still missing.
- Backward clock movement and floating-point boundary behavior still need dedicated review/tests.
- Only the setup smoke test exists; no algorithm behavior is tested yet.
- Cleanup timing/lifecycle behavior is not covered by automated tests yet.
- Leaky Bucket empty-queue guard compares length to null instead of zero. After draining, it can schedule unnecessary wake-ups, access an undefined job, and reject the processor unexpectedly.
- Leaky Bucket submission validation, public entry-point export, shutdown, and idle-client reclamation are missing. Its scheduling behavior has not been verified by automated tests.
- Storage is not shared across processes and is lost on restart.

## Next milestone

Define and implement Leaky Bucket semantics. Return to Token Bucket tests, clock handling, and weighted costs in later milestones.
