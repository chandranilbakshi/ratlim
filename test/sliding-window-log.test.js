import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { createSlidWinLog } from "../src/algorithms/slidingwinlog.js";
import { installIntervalHarness } from "./helpers/interval-harness.js";

function setup(overrides = {}) {
  let now = 0;
  const limiter = createSlidWinLog({
    capacity: 2, windowMs: 1000, cleanupInterval: 0,
    clock: () => now, ...overrides,
  });
  return { limiter, at(timestamp) { now = timestamp; } };
}

describe("Sliding Window Log decisions", () => {
  test("accepts exactly capacity requests including duplicate timestamps", () => {
    const { limiter } = setup();
    expect(limiter.consume("alice")).toEqual({ allowed: true, retryAfterMs: 0 });
    expect(limiter.consume("alice").allowed).toBe(true);
    expect(limiter.consume("alice")).toEqual({ allowed: false, retryAfterMs: 1000 });
  });

  test("retains a request just before expiry and removes it at the exact boundary", () => {
    const { limiter, at } = setup({ capacity: 1 });
    limiter.consume("alice");
    at(999);
    expect(limiter.consume("alice")).toEqual({ allowed: false, retryAfterMs: 1 });
    at(1000);
    expect(limiter.consume("alice").allowed).toBe(true);
  });

  test("expires staggered timestamps individually rather than resetting the whole log", () => {
    const { limiter, at } = setup();
    limiter.consume("alice");
    at(400);
    limiter.consume("alice");
    at(1000);
    expect(limiter.consume("alice").allowed).toBe(true);
    expect(limiter.consume("alice")).toEqual({ allowed: false, retryAfterMs: 400 });
    at(1400);
    expect(limiter.consume("alice").allowed).toBe(true);
  });

  

  

  

  

  

  

  
});

describe("Sliding Window Log validation", () => {
  const config = { capacity: 2, windowMs: 1000, cleanupInterval: 0 };
  
  
  
  
  
});

describe("Sliding Window Log cleanup and lifecycle", () => {
  afterEach(() => mock.restore());

  

  

  

  

  
});
