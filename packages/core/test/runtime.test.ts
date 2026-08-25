import { describe, expect, it } from "vitest";
import { numericEnv, serviceNameSchema } from "../src/runtime.js";

describe("HubOrder runtime helpers", () => {
  it("accepts only known services", () => {
    expect(serviceNameSchema.safeParse("wumpus").success).toBe(true);
    expect(serviceNameSchema.safeParse("unknown-bot").success).toBe(false);
  });

  it("uses the numeric fallback when no value is configured", () => {
    delete process.env.HUBORDER_TEST_PORT;
    expect(numericEnv("HUBORDER_TEST_PORT", 3100)).toBe(3100);
  });
});
