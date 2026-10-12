import { describe, expect, test } from "bun:test";

describe("project setup", () => {
  test("runs JavaScript ES module tests with Bun", () => {
    expect(import.meta.url.startsWith("file:")).toBe(true);
  });
});
