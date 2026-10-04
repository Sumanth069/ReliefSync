import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        relief: {
          blue: "#0284c7",
          green: "#059669",
          amber: "#d97706",
          red: "#dc2626",
          slate: "#334155",
        },
      },
    },
  },
  plugins: [],
};

export default config;
