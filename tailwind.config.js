/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"] },
      colors: {
        primary: { DEFAULT: "#2F80ED", hover: "#1F6FD8", soft: "#EAF2FD" },
        card: "#F5F6F8",
        line: "#E5E7EB",
        ink: { DEFAULT: "#111827", muted: "#6B7280" },
      },
    },
  },
  plugins: [],
};
