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

  test("rejected attempts do not add timestamps or extend the wait", () => {
    const { limiter, at } = setup({ capacity: 1 });
    limiter.consume("alice");
    for (const time of [100, 500, 999]) {
      at(time);
      expect(limiter.consume("alice")).toEqual({
        allowed: false, retryAfterMs: 1000 - time,
      });
    }
    at(1000);
    expect(limiter.consume("alice").allowed).toBe(true);
  });

  test("removes all expired timestamps after a long idle period", () => {
    const { limiter, at } = setup();
    limiter.consume("alice");
    at(100);
    limiter.consume("alice");
    at(10_000);
    expect(limiter.consume("alice").allowed).toBe(true);
    expect(limiter.consume("alice").allowed).toBe(true);
    expect(limiter.consume("alice").allowed).toBe(false);
  });

  test("does not grant a fresh burst just because an aligned window boundary passes", () => {
    const { limiter, at } = setup();
    at(999);
    limiter.consume("alice");
    limiter.consume("alice");
    at(1000);
    expect(limiter.consume("alice")).toEqual({ allowed: false, retryAfterMs: 999 });
  });

  test("keeps clients independent", () => {
    const { limiter } = setup({ capacity: 1 });
    limiter.consume("alice");
    expect(limiter.consume("alice").allowed).toBe(false);
    expect(limiter.consume("bob").allowed).toBe(true);
  });

  test("keeps limiter instances independent", () => {
    const first = setup({ capacity: 1 }).limiter;
    const second = setup({ capacity: 1 }).limiter;
    first.consume("alice");
    expect(first.consume("alice").allowed).toBe(false);
    expect(second.consume("alice").allowed).toBe(true);
  });

  test("rounds fractional retry delays upward", () => {
    const { limiter, at } = setup({ capacity: 1 });
    limiter.consume("alice");
    at(999.25);
    expect(limiter.consume("alice").retryAfterMs).toBe(1);
    at(1000);
    expect(limiter.consume("alice").allowed).toBe(true);
  });

  test("works with real-sized epoch timestamps", () => {
    const { limiter, at } = setup({ capacity: 1 });
    const epoch = 1_800_000_000_000;
    at(epoch);
    limiter.consume("alice");
    at(epoch + 500);
    expect(limiter.consume("alice").retryAfterMs).toBe(500);
    at(epoch + 1000);
    expect(limiter.consume("alice").allowed).toBe(true);
  });
});

describe("Sliding Window Log validation", () => {
  const config = { capacity: 2, windowMs: 1000, cleanupInterval: 0 };
  test.each([0, -1, 1.5, NaN, Infinity, "2", undefined, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid capacity %p", (capacity) => {
      expect(() => createSlidWinLog({ ...config, capacity })).toThrow(TypeError);
    },
  );
  test.each([0, -1, NaN, Infinity, "1000", undefined])(
    "rejects invalid window duration %p", (windowMs) => {
      expect(() => createSlidWinLog({ ...config, windowMs })).toThrow(TypeError);
    },
  );
  test.each([-1])(
    "rejects invalid cleanup interval %p", (cleanupInterval) => {
      expect(() => createSlidWinLog({ ...config, cleanupInterval })).toThrow(TypeError);
    },
  );
  
  
});

describe("Sliding Window Log cleanup and lifecycle", () => {
  afterEach(() => mock.restore());

  

  

  

  

  
});
