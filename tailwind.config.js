/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./*.{js,jsx}",
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./contexts/**/*.{js,jsx}",
    "./hooks/**/*.{js,jsx}",
    "./lib/**/*.{js,jsx}",
    "./api/**/*.{js,jsx}",
    "./utils/**/*.{js,jsx}",
    "./data/**/*.{js,jsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1440px",
      },
    },
    extend: {
      fontFamily: {
        // Body: Helvetica Neue (brand spec)
        sans: ["var(--font-sans)", "sans-serif"],
        // Display / Headings: Syne ExtraBold 800 (brand spec)
        serif: ["var(--font-heading)", "sans-serif"],
        heading: ["var(--font-heading)", "sans-serif"],
      },
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
        // ── CardPop Brand Palette ───────────────────────────────────────
        brand: {
          red:        "#CE1126",   // CardPop Red
          charcoal:   "#1F2937",   // Charcoal
          silver:     "#C4CED4",   // Soft Silver
          lightgrey:  "#F5F7FA",   // Light Grey
          white:      "#FFFFFF",   // Cloud White
        },
      },
      borderRadius: {
        // Brand-spec named radii (use these on components)
        button: "var(--radius-button)",   // 6px
        input:  "var(--radius-input)",    // 8px
        card:   "var(--radius-card)",     // 12px
        pill:   "var(--radius-pill)",     // 999px
        // shadcn/ui compat aliases
        lg: "var(--radius)",              // 12px
        md: "calc(var(--radius) - 4px)", // 8px
        sm: "calc(var(--radius) - 6px)", // 6px
      },
      minHeight: {
        touch: "44px",   // minimum touch target (brand spec)
      },
      minWidth: {
        touch: "44px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
