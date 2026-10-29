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

  

  

  

  

  

  

  

  

  

  

  

  
});

describe("Leaky Bucket validation", () => {
  
  
  
  
  
});
