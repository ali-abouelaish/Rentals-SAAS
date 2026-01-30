import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--bg)",
        card: "var(--card)",
        foreground: "var(--text)",
        navy: "var(--navy)",
        graphite: "var(--graphite)",
        gold: "var(--gold)",
        muted: "var(--muted)"
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.25rem"
      },
      boxShadow: {
        soft: "0 8px 30px rgba(28, 42, 57, 0.08)"
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        heading: ["var(--font-poppins)", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
