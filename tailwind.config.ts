import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#6366f1",
          50: "#eef2ff",
          100: "#e0e7ff",
          500: "#6366f1",
          600: "#5b5bd6",
          700: "#4f46e5",
        },
        ink: {
          900: "#0f172a",
          700: "#334155",
          500: "#64748b",
          300: "#cbd5e1",
          100: "#f1f5f9",
          50: "#f8fafc",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.04), 0 1px 1px rgba(15,23,42,0.03)",
        pop: "0 8px 24px rgba(15,23,42,0.08)",
      },
      borderRadius: { xl2: "14px" },
    },
  },
  plugins: [],
};
export default config;
