/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        gray: { 750: "#2d3748", 850: "#1a202c", 950: "#0d1117" },
        'card-yellow': '#FCD34D',
        'card-pink': '#F472B6',
        'card-purple': '#A78BFA',
        'card-blue': '#60A5FA',
        'card-green': '#34D399',
        'card-orange': '#FB923C',
      },
      fontFamily: {
        sans: ['Cairo', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
