import { describe, expect, test } from "bun:test";
import { createLeakyBucket } from "../src/algorithms/leaky-bucket.js";
import { runIsolatedLeakyScenario } from "./helpers/isolated-leaky-scenario.js";

describe("Leaky Bucket scheduling", () => {
  // Each callback runs in its own Bun process with a virtual clock. No real
  // network calls or long sleeps are involved. Failures expose implementation
  // bugs; they are intentionally not skipped or converted into expected passes.
  test("creates no background timer before any work is submitted", () => {
    runIsolatedLeakyScenario(async ({ assert, createLeakyBucket, clock }) => {
      createLeakyBucket({ capacity: 2, leakRate: 2 });
      assert.equal(clock.pendingTimers, 0);
    });
  });

  test("starts the first job immediately and returns its synchronous result", () => {
    runIsolatedLeakyScenario(async ({ assert, createLeakyBucket, clock }) => {
      const limiter = createLeakyBucket({ capacity: 2, leakRate: 2 });
      const starts = [];
      const result = limiter.schedule("alice", () => { starts.push(clock.now); return 42; });
      assert.deepEqual(starts, [0]);
      assert.equal(await result, 42);
      await clock.advanceTo(500);
    });
  });

  test("keeps a result pending until the asynchronous task completes", () => {
    runIsolatedLeakyScenario(async ({ assert, createLeakyBucket, clock, deferred }) => {
      const limiter = createLeakyBucket({ capacity: 2, leakRate: 2 });
      const gate = deferred();
      let settled = false;
      const result = limiter.schedule("alice", () => gate.promise);
      result.then(() => { settled = true; });
      await clock.flush();
      assert.equal(settled, false);
      gate.resolve("finished");
      assert.equal(await result, "finished");
      await clock.advanceTo(500);
    });
  });

  test("executes jobs FIFO and keeps their Promise results separate", () => {
    runIsolatedLeakyScenario(async ({ assert, createLeakyBucket, clock }) => {
      const limiter = createLeakyBucket({ capacity: 2, leakRate: 2 });
      const starts = [];
      const first = limiter.schedule("alice", () => { starts.push(["A", clock.now]); return "A"; });
      const second = limiter.schedule("alice", () => { starts.push(["B", clock.now]); return "B"; });
      const third = limiter.schedule("alice", () => { starts.push(["C", clock.now]); return "C"; });
      await clock.advanceTo(499);
      assert.deepEqual(starts, [["A", 0]]);
      await clock.advanceTo(1000);
      assert.deepEqual(await Promise.all([first, second, third]), ["A", "B", "C"]);
      assert.deepEqual(starts, [["A", 0], ["B", 500], ["C", 1000]]);
      await clock.advanceTo(1500);
    });
  });

  test("capacity counts waiting jobs but excludes the running job", () => {
    runIsolatedLeakyScenario(async ({ assert, createLeakyBucket, clock, deferred }) => {
      const limiter = createLeakyBucket({ capacity: 1, leakRate: 2 });
      const gate = deferred();
      const first = limiter.schedule("alice", () => gate.promise);
      const second = limiter.schedule("alice", () => "second");
      let overflowRan = false;
      await assert.rejects(limiter.schedule("alice", () => { overflowRan = true; }), /Queue is full/);
      assert.equal(overflowRan, false);
      gate.resolve("first");
      assert.equal(await first, "first");
      await clock.advanceTo(500);
      assert.equal(await second, "second");
      await clock.advanceTo(1000);
    });
  });

  test("allows independent clients to run while another client is blocked", () => {
    runIsolatedLeakyScenario(async ({ assert, createLeakyBucket, clock, deferred }) => {
      const limiter = createLeakyBucket({ capacity: 1, leakRate: 2 });
      const gate = deferred();
      const alice = limiter.schedule("alice", () => gate.promise);
      assert.equal(await limiter.schedule("bob", () => "bob result"), "bob result");
      gate.resolve("alice result");
      assert.equal(await alice, "alice result");
      await clock.advanceTo(500);
    });
  });

  test("does not overlap jobs for one client and starts promptly after a slow job", () => {
    runIsolatedLeakyScenario(async ({ assert, createLeakyBucket, clock, deferred }) => {
      const limiter = createLeakyBucket({ capacity: 2, leakRate: 2 });
      const gate = deferred();
      const starts = [];
      const first = limiter.schedule("alice", () => { starts.push(clock.now); return gate.promise; });
      const second = limiter.schedule("alice", () => { starts.push(clock.now); return "second"; });
      await clock.advanceTo(800);
      assert.deepEqual(starts, [0]);
      gate.resolve("first");
      assert.equal(await first, "first");
      await clock.flush();
      assert.equal(await second, "second");
      assert.deepEqual(starts, [0, 800]);
      await clock.advanceTo(1300);
    });
  });

  test("forwards synchronous task failures and continues with the next job", () => {
    runIsolatedLeakyScenario(async ({ assert, createLeakyBucket, clock }) => {
      const limiter = createLeakyBucket({ capacity: 2, leakRate: 2 });
      const error = new Error("task failed");
      const rejected = assert.rejects(
        limiter.schedule("alice", () => { throw error; }),
        (received) => received === error,
      );
      const next = limiter.schedule("alice", () => "recovered");
      await rejected;
      await clock.advanceTo(500);
      assert.equal(await next, "recovered");
      await clock.advanceTo(1000);
    });
  });

  test("forwards asynchronous task failures without stopping the queue", () => {
    runIsolatedLeakyScenario(async ({ assert, createLeakyBucket, clock, deferred }) => {
      const limiter = createLeakyBucket({ capacity: 2, leakRate: 2 });
      const gate = deferred();
      const rejected = assert.rejects(limiter.schedule("alice", () => gate.promise), /async failure/);
      const next = limiter.schedule("alice", () => "recovered");
      gate.reject(new Error("async failure"));
      await rejected;
      await clock.advanceTo(500);
      assert.equal(await next, "recovered");
      await clock.advanceTo(1000);
    });
  });

  test("creates only one wake-up timer when multiple jobs wait", () => {
    runIsolatedLeakyScenario(async ({ assert, createLeakyBucket, clock }) => {
      const limiter = createLeakyBucket({ capacity: 3, leakRate: 2 });
      const first = limiter.schedule("alice", () => "A");
      await clock.flush();
      const second = limiter.schedule("alice", () => "B");
      const third = limiter.schedule("alice", () => "C");
      assert.equal(clock.pendingTimers, 1);
      await clock.advanceTo(1000);
      assert.deepEqual(await Promise.all([first, second, third]), ["A", "B", "C"]);
      await clock.advanceTo(1500);
    });
  });

  test("rechecks the deadline if a timer fires early", () => {
    runIsolatedLeakyScenario(async ({ assert, createLeakyBucket, clock }) => {
      const limiter = createLeakyBucket({ capacity: 2, leakRate: 2 });
      const starts = [];
      const first = limiter.schedule("alice", () => { starts.push(clock.now); });
      const second = limiter.schedule("alice", () => { starts.push(clock.now); });
      await clock.flush();
      await clock.fireEarly();
      assert.deepEqual(starts, [0]);
      assert.equal(clock.pendingTimers, 1);
      await clock.advanceTo(500);
      await Promise.all([first, second]);
      assert.deepEqual(starts, [0, 500]);
      await clock.advanceTo(1000);
    });
  });

  test("idle time does not accumulate credit for a later burst", () => {
    runIsolatedLeakyScenario(async ({ assert, createLeakyBucket, clock }) => {
      const limiter = createLeakyBucket({ capacity: 2, leakRate: 2 });
      await limiter.schedule("alice", () => "initial");
      await clock.advanceTo(10_000);
      const starts = [];
      const first = limiter.schedule("alice", () => { starts.push(clock.now); });
      const second = limiter.schedule("alice", () => { starts.push(clock.now); });
      await clock.flush();
      assert.deepEqual(starts, [10_000]);
      await clock.advanceTo(10_500);
      await Promise.all([first, second]);
      assert.deepEqual(starts, [10_000, 10_500]);
      await clock.advanceTo(11_000);
    });
  });

  test("keeps cooldown when new work arrives after the queue becomes empty", () => {
    runIsolatedLeakyScenario(async ({ assert, createLeakyBucket, clock }) => {
      const limiter = createLeakyBucket({ capacity: 2, leakRate: 2 });
      await limiter.schedule("alice", () => "first");
      await clock.advanceTo(200);
      let started = false;
      const second = limiter.schedule("alice", () => { started = true; });
      await clock.advanceTo(499);
      assert.equal(started, false);
      await clock.advanceTo(500);
      await second;
      assert.equal(started, true);
      await clock.advanceTo(1000);
      assert.equal(clock.pendingTimers, 0);
    });
  });

  test("rounds wake-ups conservatively for fractional job intervals", () => {
    runIsolatedLeakyScenario(async ({ assert, createLeakyBucket, clock }) => {
      const limiter = createLeakyBucket({ capacity: 2, leakRate: 3 });
      const starts = [];
      const first = limiter.schedule("alice", () => starts.push(clock.now));
      const second = limiter.schedule("alice", () => starts.push(clock.now));
      await clock.advanceTo(333);
      assert.deepEqual(starts, [0]);
      await clock.advanceTo(334);
      await Promise.all([first, second]);
      assert.deepEqual(starts, [0, 334]);
      await clock.advanceTo(668);
    });
  });

  test("supports fractional leak rates", () => {
    runIsolatedLeakyScenario(async ({ assert, createLeakyBucket, clock }) => {
      const limiter = createLeakyBucket({ capacity: 2, leakRate: 0.5 });
      const starts = [];
      const first = limiter.schedule("alice", () => starts.push(clock.now));
      const second = limiter.schedule("alice", () => starts.push(clock.now));
      await clock.advanceTo(1999);
      assert.deepEqual(starts, [0]);
      await clock.advanceTo(2000);
      await Promise.all([first, second]);
      assert.deepEqual(starts, [0, 2000]);
      await clock.advanceTo(4000);
    });
  });

  test("keeps limiter instances independent for the same client key", () => {
    runIsolatedLeakyScenario(async ({ assert, createLeakyBucket, clock, deferred }) => {
      const first = createLeakyBucket({ capacity: 1, leakRate: 2 });
      const second = createLeakyBucket({ capacity: 1, leakRate: 2 });
      const gate = deferred();
      const pending = first.schedule("alice", () => gate.promise);
      assert.equal(await second.schedule("alice", () => "independent"), "independent");
      gate.resolve("done");
      await pending;
      await clock.advanceTo(500);
    });
  });
});

describe("Leaky Bucket validation", () => {
  
  
  
  
  
});
