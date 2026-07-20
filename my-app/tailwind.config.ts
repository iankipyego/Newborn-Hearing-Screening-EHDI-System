import type { Config } from 'tailwindcss';

const config: Config = {
  // Content auto-detection is the v4 default, but keeping this
  // ensures the dashboard components directory is scanned
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
};

export default config;