import type { Config } from "tailwindcss";

// Reference-project design tokens (Noir + champagne gold) still style the public
// site and admin. The Sabor con Amor design system (imperial / brass / status
// below + the `.theme-sabor` scope in globals.css) styles the customer area
// (auth + /account) from Phase 3; other areas move over in later phases.
// Neutral tokens (surface / ink / line / gold text) are CSS variables set in
// globals.css: light values on :root, dark values inside `.theme-noir`, so a
// whole area (e.g. the admin sign-in card) switches palette without touching
// its components. `gold.DEFAULT` is text-safe gold for the current theme
// (#8C6A2E on light, #C2A36B on noir); `gold.light` is the muted champagne
// accent for dark surfaces; `gold.container` is for thin decorative rules.
const v = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: v("surface"),
          low: v("surface-low"),
          mid: v("surface-mid"),
          high: v("surface-high"),
          highest: v("surface-highest"),
        },
        ink: { DEFAULT: v("ink"), soft: v("ink-soft"), muted: v("ink-muted") },
        gold: {
          DEFAULT: v("gold"),
          light: "#c2a36b",
          soft: "#d3b985",
          container: "#c2a36b",
          pale: "#f7f2e7",
        },
        noir: {
          DEFAULT: "#0e0e10",
          800: "#17171a",
          700: "#202024",
          600: "#2e2e33",
        },
        whatsapp: { DEFAULT: "#25d366", hover: "#1ebe5b", ink: "#052e16", dark: "#128c7e" },
        // Calendar availability dots (>=3:1 on their surfaces).
        slot: { free: "#15803d", booked: "#b91c1c", held: "#d97706", "free-on-dark": "#22c55e", "booked-on-dark": "#ef4444" },
        state: { success: "#15803d", danger: "#b91c1c", warning: "#b45309", info: "#1d4ed8" },
        line: { DEFAULT: v("line"), strong: v("line-strong"), dark: "rgba(255,255,255,0.08)" },
        night: "#0e0e10",
        // Sabor con Amor design system (design/stitch/design_system/DESIGN.md).
        // Separate names so the reference palette above (and Tailwind's own
        // emerald-* classes already in use) keep working until each area is
        // rebuilt. Applied with the `.theme-sabor` scope in globals.css.
        imperial: { DEFAULT: "#0f2e24", deep: "#001811", soft: "#184235", fixed: "#c8eadb", tint: "#e7f4ee" },
        brass: { DEFAULT: "#c5a059", light: "#dfbd78", deep: "#9a7736", text: "#775a19", container: "#fed488", pale: "#fbf3e0" },
        status: {
          confirmed: "#134e39",
          "confirmed-bg": "#e7f4ee",
          pending: "#92600e",
          "pending-bg": "#fef6e7",
          review: "#1d4e89",
          "review-bg": "#edf4fc",
          cancelled: "#8a2424",
          "cancelled-bg": "#fdf0f0",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      fontSize: {
        eyebrow: ["0.75rem", { lineHeight: "1rem", letterSpacing: "0.22em" }],
        label: ["0.75rem", { lineHeight: "1rem", letterSpacing: "0.14em" }],
      },
      // Restrained corners: controls 6–8 px, cards 10–14 px.
      borderRadius: { DEFAULT: "0.25rem", md: "0.375rem", lg: "0.5rem", xl: "0.625rem", "2xl": "0.75rem", "3xl": "0.875rem" },
      maxWidth: { content: "1320px" },
      spacing: { 13: "3.25rem", 18: "4.5rem", 22: "5.5rem" },
      transitionDuration: { 400: "400ms", 600: "600ms", 900: "900ms" },
      transitionTimingFunction: { elegant: "cubic-bezier(0.16, 1, 0.3, 1)" },
      backgroundImage: {
        // Feature bands: noir with a very soft gold glow.
        band: "radial-gradient(120% 90% at 100% 0%, rgba(194,163,107,0.08), transparent 55%), linear-gradient(135deg, #17171a 0%, #0e0e10 65%)",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(14,14,16,0.04)",
        lift: "0 2px 4px rgba(14,14,16,0.05), 0 18px 40px -28px rgba(14,14,16,0.35)",
        frame: "0 30px 80px -30px rgba(0,0,0,0.65)",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        heroZoom: {
          "0%": { transform: "scale(1.08)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        // `both` fill keeps elements hidden during their delay (no flicker).
        "fade-up": "fadeUp 0.9s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fadeIn 1.2s ease-out both",
        "hero-zoom": "heroZoom 2.4s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
};
export default config;
