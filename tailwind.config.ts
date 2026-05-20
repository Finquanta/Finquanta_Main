@"
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './user/src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './user/src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './user/src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

export default config
"@ | Out-File ".\tailwind.config.ts" -Encoding UTF8