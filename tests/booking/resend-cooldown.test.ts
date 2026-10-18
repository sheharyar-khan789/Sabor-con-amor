// Verification-email cooldown (account page Resend button). Run: npm run test:booking
// Node has no localStorage, so this exercises the in-memory fallback.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatCountdown,
  formatWait,
  startVerificationCooldown,
  VERIFICATION_COOLDOWN_SECONDS,
  VERIFICATION_RATE_LIMITED_SECONDS,
  verificationCooldownLeft,
} from "../../src/lib/auth/resend-cooldown.ts";

describe("verification resend cooldown", () => {
  it("is zero for an account that has not been sent anything", () => {
    assert.equal(verificationCooldownLeft("never-sent"), 0);
  });

  it("counts down from the requested length, per account", () => {
    startVerificationCooldown("a", VERIFICATION_COOLDOWN_SECONDS);
    startVerificationCooldown("b", VERIFICATION_RATE_LIMITED_SECONDS);
    assert.equal(verificationCooldownLeft("a"), VERIFICATION_COOLDOWN_SECONDS);
    assert.equal(verificationCooldownLeft("b"), VERIFICATION_RATE_LIMITED_SECONDS);
  });

  it("formats waits for messages and button labels", () => {
    assert.equal(formatWait(45), "45 seconds");
    assert.equal(formatWait(60), "1 minute");
    assert.equal(formatWait(300), "5 minutes");
    assert.equal(formatWait(270), "4 minutes 30 seconds");
    assert.equal(formatCountdown(300), "5:00");
    assert.equal(formatCountdown(9), "0:09");
  });
});
