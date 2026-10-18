// Server-side authorization coverage (Phase 4). A static check over the route
// files, so a new admin page or API route can't ship without its guard:
//  - every /admin page calls requireSuperAdmin() itself (a layout check alone
//    does not stop a nested segment rendering — Next.js partial rendering);
//  - every /api/admin route authorizes through adminMutation() or
//    requireSuperAdminApi() (same-origin + verified session + super_admin claim);
//  - every /api/account route verifies the session cookie (helper or Admin SDK) before doing anything;
//  - there is no admin sign-up route.
// Run: npm run test:booking
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

const APP = join(process.cwd(), "src", "app");

function files(dir: string, name: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...files(p, name));
    else if (entry === name) out.push(p);
  }
  return out;
}
const rel = (p: string) => relative(APP, p).replaceAll("\\", "/");

describe("server-side route guards", () => {
  it("every admin page verifies the Super Admin itself", () => {
    const pages = files(join(APP, "(admin)"), "page.tsx");
    assert.ok(pages.length >= 18, `found ${pages.length} admin pages`);
    const missing = pages.filter((p) => !/await requireSuperAdmin\(/.test(readFileSync(p, "utf8"))).map(rel);
    assert.deepEqual(missing, []);
  });

  it("the admin layout also verifies before rendering", () => {
    assert.match(readFileSync(join(APP, "(admin)", "layout.tsx"), "utf8"), /await requireSuperAdmin\(/);
  });

  it("every admin API route authorizes on the server", () => {
    const routes = files(join(APP, "api", "admin"), "route.ts");
    assert.ok(routes.length >= 28, `found ${routes.length} admin routes`);
    const missing = routes.filter((p) => !/\b(adminMutation|requireSuperAdminApi)\(/.test(readFileSync(p, "utf8"))).map(rel);
    assert.deepEqual(missing, []);
  });

  it("every customer account API route verifies the session", () => {
    const routes = files(join(APP, "api", "account"), "route.ts");
    assert.ok(routes.length >= 6, `found ${routes.length} account routes`);
    const missing = routes.filter((p) => !/\b(getSessionUser|verifySession|verifySessionCookie|requireUser)\(/.test(readFileSync(p, "utf8"))).map(rel);
    assert.deepEqual(missing, []);
  });

  it("there is no admin sign-up page or route", () => {
    const all = [...files(APP, "page.tsx"), ...files(APP, "route.ts")].map(rel);
    assert.deepEqual(all.filter((p) => /admin\/(signup|register)/.test(p)), []);
  });
});
