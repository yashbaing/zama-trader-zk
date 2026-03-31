/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#06080d",
          secondary: "#0c1018",
          tertiary: "#121824",
          elevated: "#182033",
          hover: "#1e2a42",
        },
        accent: {
          cyan: "#00e5ff",
          emerald: "#00e676",
          violet: "#b388ff",
          amber: "#ffd740",
          rose: "#ff5252",
        },
        text: {
          primary: "#e8edf5",
          secondary: "#8898b5",
          muted: "#5a6a8a",
        },
        border: {
          subtle: "#1a2236",
          medium: "#243049",
          bright: "#2d3f66",
        },
        success: "#00e676",
        danger: "#ff5252",
      },
      fontFamily: {
        display: ['"DM Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', '"Fira Code"', "monospace"],
        body: ['"DM Sans"', "system-ui", "sans-serif"],
      },
      fontSize: {
        "2xs": "0.65rem",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1rem",
      },
      boxShadow: {
        glow: "0 0 20px rgba(0, 229, 255, 0.15)",
        "glow-lg": "0 0 40px rgba(0, 229, 255, 0.2)",
        "inner-glow": "inset 0 1px 0 rgba(255,255,255,0.05)",
      },
      animation: {
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-mesh":
          "radial-gradient(at 20% 80%, rgba(0,229,255,0.08) 0%, transparent 50%), radial-gradient(at 80% 20%, rgba(179,136,255,0.06) 0%, transparent 50%)",
      },
    },
  },
  plugins: [],
};
