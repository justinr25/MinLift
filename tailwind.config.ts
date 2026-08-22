import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        canvas: "#FFFFFF",
        surface: {
          DEFAULT: "#F4F4F6",
          subtle: "#FAFAFA",
        },
        border: {
          subtle: "#E5E7EB",
          dashed: "#D1D5DB",
          focus: "#000000",
        },
        primary: {
          DEFAULT: "#000000",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#6B7280",
        },
        muted: {
          DEFAULT: "#9CA3AF",
        },
        danger: {
          DEFAULT: "#EF4444",
        },
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        full: "9999px",
      },
      fontFamily: {
        mono: ["Courier", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
