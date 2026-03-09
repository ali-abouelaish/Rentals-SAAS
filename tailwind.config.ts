import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      /* ── Colors — all mapped to CSS variables ─── */
      colors: {
        /* Surfaces */
        surface: {
          app: "var(--surface-app)",
          ground: "var(--surface-ground)",
          card: "var(--surface-card)",
          elevated: "var(--surface-elevated)",
          inset: "var(--surface-inset)",
          highlight: "var(--surface-highlight)",
        },

        /* Brand Primary */
        brand: {
          DEFAULT: "var(--brand-primary)",
          hover: "var(--brand-primary-hover)",
          fg: "var(--brand-primary-fg)",
          subtle: "var(--brand-primary-subtle)",
          muted: "var(--brand-primary-muted)",
        },

        /* Brand Accent */
        accent: {
          DEFAULT: "var(--brand-accent)",
          hover: "var(--brand-accent-hover)",
          fg: "var(--brand-accent-fg)",
          subtle: "var(--brand-accent-subtle)",
          muted: "var(--brand-accent-muted)",
        },

        /* Sidebar */
        sidebar: {
          DEFAULT: "var(--sidebar-bg)",
          text: "var(--sidebar-text)",
          "text-active": "var(--sidebar-text-active)",
          hover: "var(--sidebar-hover)",
          "active-bg": "var(--sidebar-active-bg)",
          "active-fg": "var(--sidebar-active-fg)",
          border: "var(--sidebar-border)",
          "glass-bg": "var(--sidebar-glass-bg)",
        },

        /* Text */
        foreground: {
          DEFAULT: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          inverse: "var(--text-inverse)",
          link: "var(--text-link)",
        },

        /* Borders */
        border: {
          DEFAULT: "var(--border-default)",
          muted: "var(--border-muted)",
          strong: "var(--border-strong)",
          ring: "var(--border-ring)",
        },

        /* Status */
        success: {
          DEFAULT: "var(--status-success)",
          fg: "var(--status-success-fg)",
          bg: "var(--status-success-bg)",
          border: "var(--status-success-border)",
        },
        warning: {
          DEFAULT: "var(--status-warning)",
          fg: "var(--status-warning-fg)",
          bg: "var(--status-warning-bg)",
          border: "var(--status-warning-border)",
        },
        error: {
          DEFAULT: "var(--status-error)",
          fg: "var(--status-error-fg)",
          bg: "var(--status-error-bg)",
          border: "var(--status-error-border)",
        },
        info: {
          DEFAULT: "var(--status-info)",
          fg: "var(--status-info-fg)",
          bg: "var(--status-info-bg)",
          border: "var(--status-info-border)",
        },
        pending: {
          DEFAULT: "var(--status-pending)",
          fg: "var(--status-pending-fg)",
          bg: "var(--status-pending-bg)",
          border: "var(--status-pending-border)",
        },

        /* Harbor landing page palette */
        harbor: {
          navy: "#103E73",
          "navy-deep": "#0B2F59",
          "light-blue": "#6EC1E4",
          "sky-blue": "#8ED3F4",
          "bg-gray": "#F5F7FA",
          white: "#FFFFFF",
          "text-neutral": "#334155",
        },
      },

      /* ── Border Radius ────────────────────────── */
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        bento: "var(--radius-bento)",
        full: "var(--radius-full)",
      },

      /* ── Shadows ──────────────────────────────── */
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
        bento: "var(--shadow-bento)",
        "bento-hover": "var(--shadow-bento-hover)",
        glow: "var(--shadow-glow)",
      },

      /* ── Typography ───────────────────────────── */
      fontFamily: {
        sans: ["var(--font-sans)"],
        heading: ["var(--font-heading)"],
      },

      /* ── Animations ───────────────────────────── */
      animation: {
        enter: "enter var(--duration-slow) var(--ease-default) forwards",
        "fade-in": "fadeIn var(--duration-base) var(--ease-default) forwards",
        "slide-up": "slideUp var(--duration-slow) var(--ease-default) forwards",
        "slide-down": "slideDown var(--duration-slow) var(--ease-default) forwards",
        "scale-in": "scaleIn var(--duration-base) var(--ease-default) forwards",
        shimmer: "shimmer 2s linear infinite",
        "pulse-subtle": "pulseSubtle 2s ease-in-out infinite",
      },
      keyframes: {
        enter: {
          "0%": { opacity: "0", transform: "scale(0.96) translateY(8px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulseSubtle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },

      /* ── Transitions ──────────────────────────── */
      transitionDuration: {
        fast: "var(--duration-fast)",
        base: "var(--duration-base)",
        slow: "var(--duration-slow)",
        slower: "var(--duration-slower)",
      },
      transitionTimingFunction: {
        default: "var(--ease-default)",
        spring: "var(--ease-spring)",
      },
    },
  },
  plugins: [],
};

export default config;
