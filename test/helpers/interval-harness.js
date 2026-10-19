import { spyOn } from "bun:test";

// Replace repeating timers with callbacks a test can invoke explicitly.
// Tests using this helper must restore mocks and must not run concurrently.
export function installIntervalHarness() {
  const scheduled = [];
  const setIntervalSpy = spyOn(globalThis, "setInterval").mockImplementation(
    (callback, delay) => {
      const handle = { callback, delay, active: true };
      scheduled.push(handle);
      return handle;
    },
  );
  const clearIntervalSpy = spyOn(globalThis, "clearInterval").mockImplementation(
    (handle) => { handle.active = false; },
  );

  return {
    scheduled,
    setIntervalSpy,
    clearIntervalSpy,
    tick() {
      for (const handle of scheduled) {
        if (handle.active) handle.callback();
      }
    },
  };
}
