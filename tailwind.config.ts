import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#EEEDE6",
        card: "#F8F7F2",
        ink: "#1C1F1B",
        "ink-soft": "#5B5F58",
        line: "#D9D7CB",
        moss: {
          DEFAULT: "#3F6B47",
          soft: "#E4EBE1",
        },
        amber: {
          DEFAULT: "#B07C2C",
          soft: "#F3E7D2",
        },
        rust: {
          DEFAULT: "#A3462E",
          soft: "#F2DFD8",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "3px",
        DEFAULT: "4px",
        md: "6px",
      },
    },
  },
  plugins: [],
};

export default config;
