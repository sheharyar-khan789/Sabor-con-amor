// Printed menu-card images for the booking forms' "View menus": every declared
// menu image belongs to exactly one menu, the files exist at their declared
// size, and a renamed / unknown menu gets no image (so a menu is never shown
// with another menu's card). Pure logic + file checks.
//
// Phase 2 (Sabor con Amor): the reference venue's printed menus were removed,
// so src/data/menu.ts currently declares no menus and these checks have no
// entries to iterate. They stay as guards for when Sabor con Amor's own menu
// card is added. Run: npm run test:booking
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { mehndiMenus, printedMenuImage, weddingMenus } from "../../src/data/menu.ts";

/** Width x height from a JPEG's SOF marker. */
function jpegSize(file: string): { width: number; height: number } {
  const d = readFileSync(file);
  let i = 2;
  while (i < d.length) {
    const marker = d[i + 1];
    const len = d.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return { height: d.readUInt16BE(i + 5), width: d.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  throw new Error(`no SOF in ${file}`);
}

describe("printed menu images", () => {
  const declared = [...weddingMenus, ...mehndiMenus].filter((m) => m.image);

  it("no image is shared between two menus", () => {
    const srcs = declared.map((m) => m.image!.src);
    assert.equal(new Set(srcs).size, srcs.length);
  });

  it("each declared image file exists in public/ with the declared size", () => {
    for (const m of declared) {
      const img = m.image!;
      const file = `public${img.src}`;
      assert.ok(existsSync(file), file);
      assert.deepEqual(jpegSize(file), { width: img.width, height: img.height }, file);
    }
  });

  it("a menu gets its own image only under its own id and title; renamed or unknown menus get none", () => {
    assert.equal(printedMenuImage({ id: "custom-1", name: "Custom Menu" }), null);
    for (const m of declared) {
      assert.equal(printedMenuImage({ id: m.id, name: `  ${m.title.toLowerCase()} ` })?.src, m.image!.src, m.id);
      assert.equal(printedMenuImage({ id: m.id, name: `${m.title} Deluxe` }), null, m.id);
      assert.equal(printedMenuImage({ id: `${m.id}-other`, name: m.title }), null, m.id);
    }
  });
});
