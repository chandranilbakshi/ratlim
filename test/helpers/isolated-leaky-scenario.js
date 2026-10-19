import { expect } from "bun:test";

// Leaky Bucket currently has detached async processor failures. Isolate each
// scenario so a rejection cannot contaminate unrelated tests or leave them hung.
// Child processes also isolate our replacement Date.now and timer functions.
function createVirtualClock() {
  let now = 0;
  let nextId = 0;
  const timers = new Map();
  Date.now = () => now;
  globalThis.setTimeout = (callback, delay) => {
    const handle = ++nextId;
    timers.set(handle, { callback, due: now + Math.max(0, Math.ceil(delay)) });
    return handle;
  };
  globalThis.clearTimeout = (handle) => timers.delete(handle);

  async function flush() {
    // Our bounded scenarios have short Promise chains. Drain their continuations
    // without advancing virtual time or waiting for real scheduling intervals.
    for (let i = 0; i < 20; i++) await Promise.resolve();
  }

  return {
    get now() { return now; },
    get pendingTimers() { return timers.size; },
    flush,
    async advanceTo(target) {
      if (target < now) throw new Error("Tests must not move time backward");
      await flush();
      let fired = 0;
      while (true) {
        const next = [...timers.entries()]
          .filter(([, timer]) => timer.due <= target)
          .sort((a, b) => a[1].due - b[1].due)[0];
        if (!next) break;
        if (++fired > 1000) throw new Error("Timer loop did not converge");
        const [handle, timer] = next;
        now = timer.due;
        timers.delete(handle);
        timer.callback();
        await flush();
      }
      now = target;
      await flush();
    },
    async fireEarly() {
      const next = timers.entries().next().value;
      if (!next) throw new Error("No timer to fire early");
      timers.delete(next[0]);
      next[1].callback();
      await flush();
    },
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

export function runIsolatedLeakyScenario(scenario) {
  const moduleUrl = new URL("../../src/algorithms/leaky-bucket.js", import.meta.url);
  const source = `
    import assert from "node:assert/strict";
    import { createLeakyBucket } from ${JSON.stringify(moduleUrl.href)};
    ${createVirtualClock.toString()}
    ${deferred.toString()}
    process.on("unhandledRejection", (error) => {
      console.error("Unhandled processor rejection:", error);
      process.exit(1);
    });
    const clock = createVirtualClock();
    await (${scenario.toString()})({ assert, createLeakyBucket, clock, deferred });
    await clock.flush();
    console.log("SCENARIO_PASSED");
  `;

  // Argument arrays avoid shell interpolation. The timeout bounds broken tasks.
  const child = Bun.spawnSync({
    cmd: [process.execPath, "--eval", source],
    timeout: 2000,
    killSignal: "SIGKILL",
    maxBuffer: 128 * 1024,
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = child.stderr.toString() + child.stdout.toString();
  expect(child.exitCode, output).toBe(0);
  expect(output).toContain("SCENARIO_PASSED");
}
