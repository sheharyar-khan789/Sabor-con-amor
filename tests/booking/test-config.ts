// TEST-ONLY business configurations. The numbers and menus here are test
// fixtures, never the venue's prices or menus; the real configuration starts
// unpriced and (until Sabor con Amor confirms its menus) has no menus.
import { DEFAULT_CONFIG, type BusinessConfig, type MenuConfig, type PricingSettings, type ServiceConfig } from "../../src/lib/config/business-config.ts";

const fixtureMenu = (n: number): MenuConfig => ({
  id: `w${n}`,
  name: `Test Menu ${n}`,
  description: "",
  active: true,
  sortOrder: n,
  pricingMode: null,
  price: null,
  items: ["Test Dish A", "Test Dish B"].map((name, j) => ({
    id: `w${n}-i${j + 1}`,
    name,
    description: "",
    category: "",
    active: true,
    sortOrder: j + 1,
  })),
  version: 0,
});

/** Neutral menu fixtures (ids w1–w3, unpriced) for tests that exercise menu logic. */
export const FIXTURE_MENUS: MenuConfig[] = [1, 2, 3].map(fixtureMenu);

/** DEFAULT_CONFIG plus the fixture menus. */
export const MENU_FIXTURE_CONFIG: BusinessConfig = { ...structuredClone(DEFAULT_CONFIG), menus: structuredClone(FIXTURE_MENUS) };

/** MENU_FIXTURE_CONFIG with the given pricing (and optional extra changes). */
export function testConfig(pricing: Partial<PricingSettings>, over: Partial<BusinessConfig> = {}): BusinessConfig {
  return {
    ...structuredClone(MENU_FIXTURE_CONFIG),
    ...over,
    pricing: { ...DEFAULT_CONFIG.pricing, smallEventSurcharge: null, serviceChargePercent: null, ...pricing },
  };
}

export function testService(id: string, over: Partial<ServiceConfig> = {}): ServiceConfig {
  return {
    id,
    name: id,
    description: "",
    category: "other",
    active: true,
    sortOrder: 1,
    pricingMode: "fixed",
    price: 1000,
    version: 1,
    ...over,
  };
}
