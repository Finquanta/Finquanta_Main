/**
 * The colour map the demo pages share, mirroring the `colors` object the real
 * dashboard builds inline. Keeping it in one place means the demo's pages stay
 * consistent with each other when the theme is toggled.
 */
export function demoColors(isDark: boolean) {
  return {
    bg: isDark ? 'bg-gray-900' : 'bg-white',
    page: isDark ? 'bg-gray-900' : 'bg-gray-50',
    card: isDark ? 'bg-gray-800 text-white border border-gray-700' : 'bg-white text-gray-900 border border-gray-200',
    topbar: isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
    heading: isDark ? 'text-white' : 'text-gray-900',
    text: isDark ? 'text-gray-300' : 'text-gray-700',
    subtext: isDark ? 'text-gray-400' : 'text-gray-500',
    input: isDark
      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
      : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400',
    tableRow: isDark ? 'divide-gray-700 text-gray-300' : 'divide-gray-100 text-gray-700',
    tableHead: isDark ? 'text-gray-500 border-gray-700' : 'text-gray-600 border-gray-200',
    buttonBg: isDark ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-100 text-gray-900 border-gray-300',
    divider: isDark ? 'border-gray-700' : 'border-gray-200',
    hoverRow: isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50',
  };
}

export type DemoColors = ReturnType<typeof demoColors>;
