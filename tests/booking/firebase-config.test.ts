// Firebase web config read from environment variables. Run: npm run test:booking
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeAuthDomain } from "../../src/lib/firebase/config.ts";

describe("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN normalisation", () => {
  it("keeps a bare host unchanged", () => {
    assert.equal(normalizeAuthDomain("example-project.firebaseapp.com"), "example-project.firebaseapp.com");
  });

  it("removes a pasted scheme, trailing slash and whitespace", () => {
    assert.equal(normalizeAuthDomain(" https://example-project.firebaseapp.com/\n"), "example-project.firebaseapp.com");
  });

  it("treats empty values as unset", () => {
    assert.equal(normalizeAuthDomain(undefined), undefined);
    assert.equal(normalizeAuthDomain("   "), undefined);
  });
});
