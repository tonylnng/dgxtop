/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b1020",
        panel: "#121a30",
        panel2: "#1a2340",
        line: "#28324f",
        accent: "#22d3ee",   // cyan-400
        good: "#34d399",     // emerald-400
        warn: "#fbbf24",     // amber-400
        bad:  "#f87171",     // red-400
        muted: "#94a3b8",    // slate-400
      },
      fontFamily: {
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
