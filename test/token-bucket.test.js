import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";

import {createTokenBucket} from "../src/algorithms/token-bucket.js";

describe("capacity test", () => {
  test("capacity 2 allows two immediate requests and rejects the third", () => {
    const limiter = createTokenBucket({
      capacity: 2,
      refillRate: 1,
      clock: () => 0,
      cleanupInterval: 0,
    });

    const first = limiter.consume("alice");
    const second = limiter.consume("alice");
    const third = limiter.consume("alice");

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  })
})

describe("Token Bucket refill", () => {
  test("retains partial tokens and allows a request at the exact refill boundary", () => {
    let now = 0;
    const limiter = createTokenBucket({
      capacity: 1,
      refillRate: 2,
      clock: () => now,
      cleanupInterval: 0,
    });

    expect(limiter.consume("alice")).toEqual({
      allowed: true, remaining: 0, retryAfterMs: 0,
    });

    now = 250;
    expect(limiter.consume("alice")).toEqual({
      allowed: false, remaining: 0.5, retryAfterMs: 250,
    });

    now = 500;
    expect(limiter.consume("alice")).toEqual({
      allowed: true, remaining: 0, retryAfterMs: 0,
    });
  });

  test("repeated rejections do not spend tokens or postpone eligibility", () => {
    let now = 0;
    const limiter = createTokenBucket({
      capacity: 1,
      refillRate: 1,
      clock: () => now,
      cleanupInterval: 0,
    });
    limiter.consume("alice");

    for (const timestamp of [100, 250, 500, 750, 999]) {
      now = timestamp;
      const result = limiter.consume("alice");
      expect(result.allowed).toBe(false);
      // Floating-point calculations can produce tiny representation errors.
      expect(result.remaining).toBeCloseTo(timestamp / 1000, 10);
      // Rounding that error upward may add 1ms; never advertise an early retry.
      expect(result.retryAfterMs).toBeGreaterThanOrEqual(1000 - now);
      expect(result.retryAfterMs).toBeLessThanOrEqual(1001 - now);
    }

    now = 1000;
    expect(limiter.consume("alice").allowed).toBe(true);
  });

  test("a long idle period never refills above capacity", () => {
    let now = 0;
    const limiter = createTokenBucket({
      capacity: 2,
      refillRate: 1,
      clock: () => now,
      cleanupInterval: 0,
    });
    limiter.consume("alice");
    limiter.consume("alice");

    now = 60_000;
    expect(limiter.consume("alice").remaining).toBe(1);
    expect(limiter.consume("alice").remaining).toBe(0);
    expect(limiter.consume("alice").allowed).toBe(false);
  });

  test("supports fractional refill rates", () => {
    let now = 0;
    const limiter = createTokenBucket({
      capacity: 1,
      refillRate: 0.5,
      clock: () => now,
      cleanupInterval: 0,
    });
    limiter.consume("alice");

    now = 1000;
    expect(limiter.consume("alice")).toEqual({
      allowed: false,
      remaining: 0.5,
      retryAfterMs: 1000,
    });
    now = 2000;
    expect(limiter.consume("alice").allowed).toBe(true);
  });

  test("rounds a fractional retry delay up to whole milliseconds", () => {
    let now = 0;
    const limiter = createTokenBucket({
      capacity: 1, refillRate: 3, clock: () => now, cleanupInterval: 0,
    });
    limiter.consume("alice");

    const rejected = limiter.consume("alice");
    expect(rejected.retryAfterMs).toBe(334); // 1000 / 3 = 333.333...ms.
    now = rejected.retryAfterMs;
    expect(limiter.consume("alice").allowed).toBe(true);
  });
});

describe("Token Bucket isolation", () => {
  test("exhausting one client does not affect another", () => {
    const limiter = createTokenBucket({
      capacity: 1, refillRate: 1, clock: () => 0, cleanupInterval: 0,
    });
    expect(limiter.consume("alice").allowed).toBe(true);
    expect(limiter.consume("alice").allowed).toBe(false);
    expect(limiter.consume("bob").allowed).toBe(true);
    expect(limiter.consume("bob").allowed).toBe(false);
  });

  test("separate limiter instances do not share state", () => {
    const config = {
      capacity: 1, refillRate: 1, clock: () => 0, cleanupInterval: 0,
    };
    const first = createTokenBucket(config);
    const second = createTokenBucket(config);

    first.consume("alice");
    expect(first.consume("alice").allowed).toBe(false);
    expect(second.consume("alice").allowed).toBe(true);
  });
});

describe("Token Bucket validation", () => {
  // Table-driven tests repeat the same check with different invalid inputs.
  const validConfig = { capacity: 2, refillRate: 1, cleanupInterval: 0 };

  test.each([0, -1, 1.5, NaN, Infinity, "2", undefined, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid capacity %p",
    (capacity) => {
      expect(() => createTokenBucket({ ...validConfig, capacity }))
        .toThrow("capacity must be a positive safe integer");
    },
  );

  test.each([0, -1, NaN, Infinity, "1", undefined])(
    "rejects invalid refill rate %p",
    (refillRate) => {
      expect(() => createTokenBucket({ ...validConfig, refillRate }))
        .toThrow("refillRate must be a positive finite number");
    },
  );

  test.each([-1, 1.5, NaN, Infinity, "1000", Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid cleanup interval %p",
    (cleanupInterval) => {
      expect(() => createTokenBucket({ ...validConfig, cleanupInterval }))
        .toThrow(TypeError);
    },
  );

  test.each(["", null, undefined, 123, {}])(
    "rejects invalid client key %p without spending quota",
    (key) => {
      const limiter = createTokenBucket({ ...validConfig, clock: () => 0 });
      expect(() => limiter.consume(key)).toThrow("key must be a non-empty string");
      expect(limiter.consume("alice").remaining).toBe(1);
    },
  );

  // Known missing behavior; TODO is not a passing correctness check.
  test.todo("rejects a non-function clock when creating the limiter");
});

describe("Token Bucket cleanup and lifecycle", () => {
  // These tests replace timer functions briefly; do not run them concurrently.
  // A spy records calls and can replace behavior. Restore originals afterward.
  afterEach(() => mock.restore());

  test("cleanupInterval 0 creates no background timer", () => {
    const intervalSpy = spyOn(globalThis, "setInterval");
    const limiter = createTokenBucket({
      capacity: 1, refillRate: 1, cleanupInterval: 0,
    });
    try {
      expect(intervalSpy).not.toHaveBeenCalled();
    } finally {
      limiter.close();
    }
  });

  test("cleanup preserves active quota and allows normal refill after expiration", () => {
    // Capture the private callback instead of waiting for a real interval.
    const intervalSpy = spyOn(globalThis, "setInterval").mockReturnValue({});
    const clearSpy = spyOn(globalThis, "clearInterval").mockImplementation(() => {});
    let now = 0;
    const limiter = createTokenBucket({
      capacity: 2, refillRate: 1, cleanupInterval: 1000, clock: () => now,
    });
    const [sweep, intervalMs] = intervalSpy.mock.calls[0];
    expect(intervalMs).toBe(1000);

    try {
      limiter.consume("alice");
      limiter.consume("alice");
      now = 500;
      limiter.consume("bob");
      limiter.consume("bob");

      now = 2000; // Alice is full; Bob has only 1.5 tokens.
      sweep();
      expect(limiter.consume("alice").remaining).toBe(1);
      expect(limiter.consume("bob").remaining).toBe(0.5);
      expect(limiter.consume("bob")).toEqual({
        allowed: false, remaining: 0.5, retryAfterMs: 500,
      });
    } finally {
      limiter.close();
    }
    expect(clearSpy).toHaveBeenCalledWith(intervalSpy.mock.results[0].value);
  });

  test("close cancels the timer, is repeatable, and does not disable consume", () => {
    const handle = {};
    spyOn(globalThis, "setInterval").mockReturnValue(handle);
    const clearSpy = spyOn(globalThis, "clearInterval").mockImplementation(() => {});
    const limiter = createTokenBucket({
      capacity: 1, refillRate: 1, clock: () => 0,
    });

    limiter.close();
    limiter.close();
    expect(clearSpy).toHaveBeenCalledWith(handle);
    expect(limiter.consume("alice").allowed).toBe(true);
    expect(limiter.consume("alice").allowed).toBe(false);
  });
});
