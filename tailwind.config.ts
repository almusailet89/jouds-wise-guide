import type { Config } from "tailwindcss";

export default {
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
      screens: { "2xl": "1400px" },
    },
    extend: {
      /* JOOD semantic color tokens */
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          glow: "hsl(var(--primary-glow))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
          glow: "hsl(var(--secondary-glow))",
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
        /* Direct JOOD palette — full ramp so every shade renders */
        jood: {
          teal: {
            900: "hsl(var(--jood-teal-900))",
            800: "hsl(var(--jood-teal-800))",
            700: "hsl(var(--jood-teal-700))",
            600: "hsl(var(--jood-teal-600))",
            500: "hsl(var(--jood-teal-500))",
            400: "hsl(var(--jood-teal-400))",
            300: "hsl(var(--jood-teal-300))",
            50:  "hsl(var(--jood-teal-50))",
          },
          gold: {
            900: "hsl(var(--jood-gold-900))",
            800: "hsl(var(--jood-gold-800))",
            700: "hsl(var(--jood-gold-700))",
            600: "hsl(var(--jood-gold-600))",
            500: "hsl(var(--jood-gold-500))",
            400: "hsl(var(--jood-gold-400))",
            300: "hsl(var(--jood-gold-300))",
            200: "hsl(var(--jood-gold-200))",
            100: "hsl(var(--jood-gold-100))",
            50:  "hsl(var(--jood-gold-50))",
          },
          cream: "hsl(var(--jood-cream))",
          ink:   "hsl(var(--jood-ink))",
          muted: "hsl(var(--jood-muted))",
          ok:    "hsl(var(--jood-ok))",
          warn:  "hsl(var(--jood-warn))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },

      /* Spacing scale: 4px base */
      spacing: {
        "4.5": "1.125rem",
        "18": "4.5rem",
        "22": "5.5rem",
        "26": "6.5rem",
      },

      /* Radius per spec: sm=8, md=12, lg=16, xl=24, pill=9999 */
      borderRadius: {
        sm:   "0.5rem",
        DEFAULT: "0.75rem",
        md:   "0.75rem",
        lg:   "1rem",
        xl:   "1.5rem",
        "2xl": "1.5rem",
        pill: "9999px",
      },

      fontFamily: {
        sans:    ["Inter", "system-ui", "sans-serif"],
        arabic:  ["IBM Plex Sans Arabic", "Tajawal", "sans-serif"],
        display: ["Playfair Display", "serif"],
        tajawal: ["Tajawal", "sans-serif"],
        mono:    ["JetBrains Mono", "monospace"],
      },

      backgroundImage: {
        "gradient-hero":      "var(--gradient-hero)",
        "gradient-gold":      "var(--gradient-gold)",
        "gradient-luxury":    "var(--gradient-luxury)",
        "gradient-primary":   "var(--gradient-primary)",
        "gradient-secondary": "var(--gradient-secondary)",
      },

      boxShadow: {
        luxury:  "var(--shadow-luxury)",
        gold:    "var(--shadow-gold)",
        elegant: "var(--shadow-elegant)",
        card:    "var(--shadow-card)",
      },

      transitionTimingFunction: {
        luxury:   "cubic-bezier(0.4, 0, 0.2, 1)",
        smooth:   "cubic-bezier(0.4, 0, 0.2, 1)",
        entrance: "cubic-bezier(0.22, 1, 0.36, 1)",
      },

      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "200% center" },
          "100%": { backgroundPosition: "-200% center" },
        },
        "avatar-breathe": {
          "0%, 100%": { transform: "scale(1.000)" },
          "50%":      { transform: "scale(1.012)" },
        },
        "islamic-rotate": {
          from: { transform: "rotate(0deg)" },
          to:   { transform: "rotate(360deg)" },
        },
        entrance: {
          from: { opacity: "0", transform: "translateY(24px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "gold-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 hsl(var(--jood-gold-500) / 0.4)" },
          "50%":      { boxShadow: "0 0 0 12px hsl(var(--jood-gold-500) / 0)" },
        },
      },

      animation: {
        "accordion-down":  "accordion-down 0.2s ease-out",
        "accordion-up":    "accordion-up 0.2s ease-out",
        shimmer:           "shimmer 3.2s linear infinite",
        "avatar-breathe":  "avatar-breathe 4.5s ease-in-out infinite",
        "islamic-rotate":  "islamic-rotate 60s linear infinite",
        entrance:          "entrance 600ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "gold-pulse":      "gold-pulse 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
