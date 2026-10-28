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

  

  

  

  

  

  

  

  

  

  

  

  

  

  

  
});

describe("Leaky Bucket validation", () => {
  
  
  
  
  
});
