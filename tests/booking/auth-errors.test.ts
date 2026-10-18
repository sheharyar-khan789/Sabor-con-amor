// Customer-facing auth error messages. Run: npm run test:booking
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeAuthError } from "../../src/lib/auth/errors.ts";

describe("describeAuthError", () => {
  it("maps known Firebase codes to plain messages", () => {
    assert.match(describeAuthError({ code: "auth/user-token-expired" }, "test").message, /sign in again/);
  });

  it("shows the code for unrecognised errors so they can be diagnosed", () => {
    assert.equal(
      describeAuthError({ code: "auth/some-new-code" }, "test").message,
      "Something went wrong. Please try again. (Error: auth/some-new-code)"
    );
    assert.equal(describeAuthError(new Error("x"), "test").message, "Something went wrong. Please try again.");
  });
});
