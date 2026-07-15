/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
  "./app/**/*.{js,ts,jsx,tsx,mdx}",        // <-- Crucial para la carpeta app/
  "./components/**/*.{js,ts,jsx,tsx,mdx}", // <-- Para tus componentes reutilizables
  "./lib/**/*.{js,ts,jsx,tsx,mdx}",        // <-- En caso de que uses clases en utils.ts
],
  theme: {
    extend: {
      colors: {
        emerald: {
          50: '#F0FDF4',   // Fondo modo claro [cite: 76]
          500: '#14B8A6',  // Secundario [cite: 75]
          700: '#0F766E',  // Primario [cite: 74]
        },
        dark: {
          bg: '#1A1A2E',   // Fondo modo oscuro [cite: 76]
          card: '#161625',
          text: '#F9FAFB'
        }
      },
    },
  },
  plugins: [],
}