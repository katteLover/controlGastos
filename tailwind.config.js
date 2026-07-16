/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // Rutas si NO usas carpeta src/
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    
    // Rutas si SÍ usas carpeta src/
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
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