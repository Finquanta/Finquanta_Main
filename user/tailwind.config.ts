
import type { Config } from "tailwindcss";
const {
  default: flattenColorPalette,
} = require("tailwindcss/lib/util/flattenColorPalette");

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        /**
         * Finquanta brand tokens. The same values as the transactional email
         * shell (server/src/infrastructure/email-template.ts), so the web and
         * the inbox look like one product. `fq-card` is deliberately distinct
         * from shadcn's `card` above.
         */
        fq: {
          dark: "#05040A",
          green: "#3AD542",
          ink: "#0F1210",
          slate: "#6B7570",
          bg: "#FAFAF6",
          card: "#FFFFFF",
          "card-alt": "#F3F4F1",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      /**
       * Ambient brand motion. Every one animates `transform` / `opacity` only, so
       * it runs on the compositor with no layout or paint work, and every element
       * using them also carries `motion-reduce:animate-none`.
       */
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        scroll: {
          to: {
            transform: "translate(calc(-50% - 0.5rem))",
          },
        },
        // Three drifts with different paths so the auth blobs never visibly sync.
        "blob-drift-1": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) scale(1)" },
          "33%": { transform: "translate3d(60px, -40px, 0) scale(1.1)" },
          "66%": { transform: "translate3d(-30px, 30px, 0) scale(0.94)" },
        },
        "blob-drift-2": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) scale(1)" },
          "40%": { transform: "translate3d(-70px, 30px, 0) scale(0.92)" },
          "75%": { transform: "translate3d(40px, 50px, 0) scale(1.08)" },
        },
        "blob-drift-3": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) scale(1.05)" },
          "50%": { transform: "translate3d(50px, -60px, 0) scale(0.9)" },
        },
        // Moves exactly one dot-grid cell, so the loop point is invisible.
        "dot-drift": {
          from: { transform: "translate3d(0, 0, 0)" },
          to: { transform: "translate3d(24px, 24px, 0)" },
        },
        "glow-breathe": {
          "0%, 100%": { transform: "scale(1)", opacity: "0.55" },
          "50%": { transform: "scale(1.12)", opacity: "0.85" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "100%": { transform: "scale(1.7)", opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        scroll:
          "scroll var(--animation-duration, 40s) var(--animation-direction, forwards) linear infinite",
        "blob-drift-1": "blob-drift-1 17s ease-in-out infinite",
        "blob-drift-2": "blob-drift-2 13s ease-in-out infinite",
        "blob-drift-3": "blob-drift-3 20s ease-in-out infinite",
        "dot-drift": "dot-drift 18s linear infinite",
        "glow-breathe": "glow-breathe 7s ease-in-out infinite",
        "pulse-ring": "pulse-ring 2.4s cubic-bezier(0, 0, 0.2, 1) infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), addVariablesForColors],
} satisfies Config;

function addVariablesForColors({ addBase, theme }: any) {
  let allColors = flattenColorPalette(theme("colors"));
  let newVars = Object.fromEntries(
    Object.entries(allColors).map(([key, val]) => [`--${key}`, val])
  );

  addBase({
    ":root": newVars,
  });
}

export default config;
