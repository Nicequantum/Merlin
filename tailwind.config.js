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
        'benz-dark': '#0a0a0a',
        'benz-surface': '#1c1c1e',
        'benz-surface-2': '#2c2c2e',
        'benz-accent': '#0a84ff',
      },
    },
  },
  plugins: [],
};