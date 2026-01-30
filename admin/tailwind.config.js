/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0B1020',
        surface: '#121A2F',
        primary: '#6C5CE7',
        accent: '#00D2D3',
        text: '#EAF0FF',
        textMuted: '#A9B4D0',
        danger: '#FF5C7A',
        success: '#2EE59D',
        warning: '#FFA940',
      },
    },
  },
  plugins: [],
};
