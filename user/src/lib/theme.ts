/**
 * The dashboard's light/dark palette, in one place.
 *
 * WHY THIS EXISTS, because it is not obvious from the code around it:
 *
 * Tailwind here is configured `darkMode: ["class"]`, which means a `dark:`
 * class only takes effect when a `dark` class sits on an ancestor element.
 * NOTHING IN THIS APP EVER ADDS THAT CLASS — `ThemeContext` only writes React
 * state and localStorage, and never touches the DOM. So every `dark:` variant
 * written anywhere in this codebase is dead: it renders light, always, in both
 * themes. Several dialogs shipped that way and looked hardcoded-light because
 * they effectively were.
 *
 * The pattern that does work, and that most of the app already uses, is an
 * `isDark` boolean chosen in JS. This file is that pattern with the colours
 * agreed once, so two dialogs sitting on top of each other cannot disagree
 * about what "a card" or "muted text" looks like.
 *
 *     const c = themeClasses(isDark);
 *     <div className={`rounded-xl border p-4 ${c.surface} ${c.line}`}>
 *
 * If you find yourself writing `dark:` in a component, that is the bug.
 */

export interface ThemeClasses {
  /** A raised card or dialog body. */
  surface: string;
  /** The page or a recessed panel inside a card. */
  panel: string;
  /** Borders and dividers on a surface. */
  line: string;
  /** Primary text — headings and values. */
  heading: string;
  /** Ordinary body copy. */
  body: string;
  /** Field labels and secondary emphasis. */
  label: string;
  /** De-emphasised text: hints, timestamps, counts. */
  muted: string;
  /** A text input, select or textarea: border, background and text together. */
  input: string;
  /** A row that responds to the pointer. */
  hover: string;
  /** A close button or other quiet icon control. */
  quietControl: string;

  /* Status colours. Text only — pair with the tint below for a banner. */
  warn: string;
  danger: string;
  success: string;

  /** Soft background tints, for callouts. */
  warnTint: string;
  dangerTint: string;
  successTint: string;
  infoTint: string;
}

export function themeClasses(isDark: boolean): ThemeClasses {
  return isDark
    ? {
        surface: 'bg-gray-800',
        panel: 'bg-gray-900',
        line: 'border-gray-700',
        heading: 'text-white',
        body: 'text-gray-300',
        label: 'text-gray-200',
        muted: 'text-gray-400',
        input: 'border-gray-600 bg-gray-700 text-white',
        hover: 'hover:bg-gray-700',
        quietControl: 'text-gray-500 hover:text-gray-300',

        warn: 'text-amber-400',
        danger: 'text-red-400',
        success: 'text-green-300',

        warnTint: 'bg-amber-900/20 border-amber-800',
        dangerTint: 'bg-red-900/20 border-red-800',
        successTint: 'bg-green-900/20 border-green-800',
        infoTint: 'bg-purple-900/20 border-purple-800',
      }
    : {
        surface: 'bg-white',
        panel: 'bg-gray-50',
        line: 'border-gray-200',
        heading: 'text-gray-900',
        body: 'text-gray-600',
        label: 'text-gray-700',
        muted: 'text-gray-500',
        input: 'border-gray-300 bg-white text-gray-900',
        hover: 'hover:bg-gray-50',
        quietControl: 'text-gray-400 hover:text-gray-600',

        warn: 'text-amber-600',
        danger: 'text-red-600',
        success: 'text-green-700',

        warnTint: 'bg-amber-50 border-amber-200',
        dangerTint: 'bg-red-50 border-red-200',
        successTint: 'bg-green-50 border-green-200',
        infoTint: 'bg-purple-50 border-purple-200',
      };
}
