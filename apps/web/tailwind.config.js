/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        discord: {
          dark: '#1e1f22',
          darker: '#111214',
          light: '#2b2d31',
          lighter: '#313338',
          accent: '#5865f2',
          green: '#23a559',
          red: '#da373c',
          yellow: '#f0b232',
        },
      },
    },
  },
  plugins: [],
};
