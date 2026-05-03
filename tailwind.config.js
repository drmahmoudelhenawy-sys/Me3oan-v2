/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    "bg-indigo-500/10",
    "text-indigo-400",
    "group-hover:bg-indigo-500",
    "bg-blue-500/10",
    "text-blue-400",
    "group-hover:bg-blue-500",
    "bg-purple-500/10",
    "text-purple-400",
    "group-hover:bg-purple-500",
  ],
  theme: {
    extend: {
      colors: {
        gray: { 750: "#2d3748", 850: "#1a202c", 950: "#0d1117" },
        "card-yellow": "#FCD34D",
        "card-pink": "#F472B6",
        "card-purple": "#A78BFA",
        "card-blue": "#60A5FA",
        "card-green": "#34D399",
        "card-orange": "#FB923C",
      },
      fontFamily: {
        sans: ["Cairo", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
