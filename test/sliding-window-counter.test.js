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

  test("admits exactly when weighted history leaves room for a whole request", () => {
    const { limiter, at } = setup();
    limiter.consume("alice");
    limiter.consume("alice");
    at(1499);
    expect(limiter.consume("alice").allowed).toBe(false);
    at(1500); // Previous weight = 0.5, estimate = 1; cost 1 fits capacity 2.
    expect(limiter.consume("alice").allowed).toBe(true);
    expect(limiter.consume("alice").allowed).toBe(false);
  });

  test("counts accepted current-window work in addition to weighted history", () => {
    const { limiter, at } = setup({ capacity: 4 });
    for (let i = 0; i < 4; i++) limiter.consume("alice");
    at(1500); // Previous contributes 2, leaving room for exactly 2 new requests.
    expect(limiter.consume("alice").allowed).toBe(true);
    expect(limiter.consume("alice").allowed).toBe(true);
    expect(limiter.consume("alice").allowed).toBe(false);
  });

  test("rejections do not inflate either counter", () => {
    const { limiter, at } = setup();
    limiter.consume("alice");
    limiter.consume("alice");
    for (const time of [100, 900, 1000, 1200, 1499]) {
      at(time);
      expect(limiter.consume("alice").allowed).toBe(false);
    }
    at(1500);
    expect(limiter.consume("alice").allowed).toBe(true);
  });

  test("clears both counters when two windows pass without a request", () => {
    const { limiter, at } = setup();
    limiter.consume("alice");
    limiter.consume("alice");
    at(2000);
    expect(limiter.consume("alice").allowed).toBe(true);
    expect(limiter.consume("alice").allowed).toBe(true);
    expect(limiter.consume("alice").allowed).toBe(false);
  });

  test("clears stale state after a much longer idle period", () => {
    const { limiter, at } = setup({ capacity: 1 });
    limiter.consume("alice");
    at(100_000);
    expect(limiter.consume("alice").allowed).toBe(true);
    expect(limiter.consume("alice").allowed).toBe(false);
  });

  test("aligns windows to time zero rather than the first request", () => {
    const { limiter, at } = setup();
    at(900);
    limiter.consume("alice");
    limiter.consume("alice");
    at(1500);
    expect(limiter.consume("alice").allowed).toBe(true);
    expect(limiter.consume("alice").allowed).toBe(false);
  });

  test("discards the older previous count when advancing one window", () => {
    const { limiter, at } = setup({ capacity: 4 });
    for (let i = 0; i < 4; i++) limiter.consume("alice");
    at(1500);
    limiter.consume("alice"); // Current count 1, previous count 4.
    at(2000); // Only that current count of 1 should carry forward.
    for (let i = 0; i < 3; i++) expect(limiter.consume("alice").allowed).toBe(true);
    expect(limiter.consume("alice").allowed).toBe(false);
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

  test("works at epoch-sized timestamps with a non-power-of-two window", () => {
    const { limiter, at } = setup({ windowMs: 3000 });
    const start = Math.floor(1_800_000_000_000 / 3000) * 3000;
    at(start + 1);
    limiter.consume("alice");
    limiter.consume("alice");
    at(start + 4500);
    expect(limiter.consume("alice").allowed).toBe(true);
    expect(limiter.consume("alice").allowed).toBe(false);
  });

  test("returns decisions without advertising the deferred retry feature", () => {
    const { limiter } = setup({ capacity: 1 });
    expect(limiter.consume("alice")).not.toHaveProperty("retryAfterMs");
    expect(limiter.consume("alice")).not.toHaveProperty("retryAfterMs");
  });
});

describe("Sliding Window Counter validation", () => {
  const config = { capacity: 2, windowMs: 1000, cleanupInterval: 0 };
  test.each([0, -1, 1.5, NaN, Infinity, "2", undefined, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid capacity %p", (capacity) => {
      expect(() => createSlidWinCnt({ ...config, capacity })).toThrow(TypeError);
    },
  );
  test.each([0, -1, 0.5, NaN, Infinity, "1000", undefined, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid window duration %p", (windowMs) => {
      expect(() => createSlidWinCnt({ ...config, windowMs })).toThrow(TypeError);
    },
  );
  test.each([-1, 0.5, NaN, Infinity, "1000", Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid cleanup interval %p", (cleanupInterval) => {
      expect(() => createSlidWinCnt({ ...config, cleanupInterval })).toThrow(TypeError);
    },
  );
  test.each(["", null, undefined, 1])(
    "rejects invalid client key %p without spending quota", (key) => {
      const { limiter } = setup({ capacity: 1 });
      expect(() => limiter.consume(key)).toThrow(TypeError);
      expect(limiter.consume("alice").allowed).toBe(true);
    },
  );
  
});

describe("Sliding Window Counter cleanup and lifecycle", () => {
  afterEach(() => mock.restore());

  

  

  

  

  
});
