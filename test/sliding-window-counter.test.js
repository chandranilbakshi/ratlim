import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { createSlidWinCnt } from "../src/algorithms/slidingwincnt.js";
import { installIntervalHarness } from "./helpers/interval-harness.js";

function setup(overrides = {}) {
  let now = 0;
  const limiter = createSlidWinCnt({
    capacity: 2, windowMs: 1000, cleanupInterval: 0,
    clock: () => now, ...overrides,
  });
  return { limiter, at(timestamp) { now = timestamp; } };
}

describe("Sliding Window Counter decisions", () => {
  test("accepts exactly capacity requests in the same window", () => {
    const { limiter } = setup();
    expect(limiter.consume("alice")).toEqual({ allowed: true });
    expect(limiter.consume("alice").allowed).toBe(true);
    expect(limiter.consume("alice")).toEqual({ allowed: false });
  });

  test("carries the current count into the previous count at an exact boundary", () => {
    const { limiter, at } = setup();
    limiter.consume("alice");
    limiter.consume("alice");
    at(1000);
    // Weight is still 1 at the boundary: crossing it grants no fresh burst.
    expect(limiter.consume("alice").allowed).toBe(false);
  });

  

  

  

  

  

  

  

  

  

  

  
});

describe("Sliding Window Counter validation", () => {
  const config = { capacity: 2, windowMs: 1000, cleanupInterval: 0 };
  
  
  
  
  
});

describe("Sliding Window Counter cleanup and lifecycle", () => {
  afterEach(() => mock.restore());

  

  

  

  

  
});
