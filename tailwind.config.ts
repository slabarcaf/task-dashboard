import type { Config } from "tailwindcss";

/**
 * Colours come from the CSS variables in `globals.css`, so a theme swap is a
 * variable swap and no class name has to change. Written as `var(--x)` rather
 * than as channel triplets: we never need Tailwind's `/opacity` syntax on these
 * (the palette already ships soft variants like `--brand-soft`), and plain
 * variables stay readable in the browser inspector.
 *
 * The numbered `brand` ramp below is the *old* palette. It is still referenced
 * by the screens that have not been redesigned yet; it goes away with the last
 * of them. New work uses the token names.
 */
const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        raised: "var(--raised)",
        sunken: "var(--sunken)",
        ink: {
          DEFAULT: "var(--ink)",
          2: "var(--ink-2)",
          3: "var(--ink-3)"
        },
        line: {
          DEFAULT: "var(--line)",
          2: "var(--line-2)"
        },
        amber: {
          DEFAULT: "var(--amber)",
          soft: "var(--amber-soft)"
        },
        ok: {
          DEFAULT: "var(--ok)",
          soft: "var(--ok-soft)"
        },
        late: {
          DEFAULT: "var(--late)",
          soft: "var(--late-soft)"
        },
        night: {
          1: "var(--night-1)",
          2: "var(--night-2)"
        },
        brand: {
          DEFAULT: "var(--brand)",
          ink: "var(--brand-ink)",
          soft: "var(--brand-soft)",
          // Retired ramp — see the note above.
          50: "#f4f8ff",
          100: "#dfe9ff",
          200: "#bfd3ff",
          300: "#90b3ff",
          400: "#628fff",
          500: "#3f6df4",
          600: "#2f57d8",
          700: "#2546ae",
          800: "#213d89",
          900: "#203866"
        }
      },
      fontFamily: {
        // Bound to the CSS variables next/font sets on <html> in layout.tsx.
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"]
      },
      borderRadius: {
        // Added under their own names on purpose: overriding Tailwind's `sm`/
        // `lg`/`xl` would silently resize every corner in the screens that have
        // not been redesigned yet.
        chip: "999px",
        field: "8px",
        card: "12px",
        panel: "18px",
        hero: "26px"
      },
      boxShadow: {
        card: "var(--shadow)",
        float: "var(--shadow-lg)"
      }
    }
  },
  plugins: []
};

export default config;
