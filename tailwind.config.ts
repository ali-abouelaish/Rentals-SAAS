import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Primary Brand - Navy
        brand: {
          50: "#f0f4f8",
          100: "#d9e2ec",
          200: "#bcccdc",
          300: "#9fb3c8",
          400: "#829ab1",
          500: "#627d98",
          600: "#486581",
          700: "#334e68",
          800: "#243b53",
          DEFAULT: "#14213d",
          900: "#102a43",
          950: "#0b1c2e"
        },
        // Accent - Gold
        accent: {
          50: "#fffdf0",
          100: "#fef9c3",
          200: "#fef08a",
          300: "#fde047",
          400: "#facc15",
          DEFAULT: "#d4a00d",
          500: "#eab308",
          600: "#ca8a04",
          700: "#a16207",
          800: "#854d0e",
          900: "#713f12",
          foreground: "#ffffff"
        },
        // Sidebar
        sidebar: {
          DEFAULT: "#0f172a",
          border: "rgba(255,255,255,0.08)",
          hover: "rgba(255,255,255,0.05)",
          active: "#d4a00d",
          text: "#94a3b8",
          textActive: "#ffffff"
        },
        // Surfaces - Layered backgrounds
        surface: {
          50: "#fafbfc",
          100: "#f8fafc",
          200: "#f1f5f9",
          300: "#e2e8f0",
          400: "#cbd5e1",
          DEFAULT: "#f1f5f9"
        },
        // Semantic colors
        muted: "#e2e8f0",
        border: "#e2e8f0"
      },
      borderRadius: {
        lg: "0.625rem",
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem"
      },
      boxShadow: {
        sm: "0 1px 2px rgba(0, 0, 0, 0.05)",
        soft: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
        card: "0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03)",
        premium: "0 10px 40px -10px rgba(0, 0, 0, 0.08)",
        hover: "0 8px 25px -5px rgba(0, 0, 0, 0.1)",
        glow: "0 0 20px rgba(212, 160, 13, 0.3)",
        "inner-soft": "inset 0 2px 4px rgba(0, 0, 0, 0.02)"
      },
      backgroundImage: {
        "gradient-brand": "linear-gradient(135deg, #14213d 0%, #0f172a 100%)",
        "gradient-accent": "linear-gradient(135deg, #d4a00d 0%, #facc15 100%)",
        "gradient-surface": "linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)",
        "gradient-tinted": "linear-gradient(135deg, #ffffff 0%, #f0f4ff 100%)",
        "gradient-warm": "linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)",
        "gradient-header": "linear-gradient(90deg, #14213d 0%, #1e3a5f 100%)",
        glass: "linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.4) 100%)"
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        heading: ["var(--font-poppins)", "system-ui", "sans-serif"]
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }]
      },
      spacing: {
        "4.5": "1.125rem",
        "5.5": "1.375rem",
        "18": "4.5rem",
        "22": "5.5rem"
      },
      animation: {
        enter: "enter 0.3s ease-out forwards",
        "fade-in": "fadeIn 0.2s ease-out forwards",
        "slide-up": "slideUp 0.3s ease-out forwards",
        "pulse-subtle": "pulseSubtle 2s ease-in-out infinite",
        "scale-in": "scaleIn 0.2s ease-out forwards"
      },
      keyframes: {
        enter: {
          "0%": { opacity: "0", transform: "scale(0.96) translateY(10px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" }
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        pulseSubtle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" }
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" }
        }
      },
      transitionDuration: {
        "150": "150ms",
        "250": "250ms"
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)"
      }
    }
  },
  plugins: []
};

export default config;
