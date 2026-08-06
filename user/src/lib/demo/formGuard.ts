/**
 * "Is the visitor part-way through a form right now?"
 *
 * The signup prompt is a full-screen modal whose CTA navigates to /signup. Firing
 * it over a half-filled form throws that form away — the exact loss the prompt
 * exists to prevent. Route checks alone don't catch this: the Add-entry and
 * customer forms are modals that open on ordinary pages, and typing in them
 * records no interaction, so an idle timer fires right through them.
 *
 * A module-level counter rather than context: the prompt polls on a timer from
 * outside the tree the modals live in, so it needs to read this synchronously
 * from anywhere. Counted rather than boolean so two overlapping forms can't have
 * the first one to close clear the flag for both.
 */

let openForms = 0;

export function openDemoForm(): void {
  openForms += 1;
}

export function closeDemoForm(): void {
  openForms = Math.max(0, openForms - 1);
}

export function isDemoFormOpen(): boolean {
  return openForms > 0;
}

/**
 * `useEffect(() => demoFormOpenWhile(isOpen), [isOpen])` — registers while the
 * form is open and unregisters on close or unmount, so navigating away mid-form
 * can't leave the count stuck above zero and suppress the prompt forever.
 */
export function demoFormOpenWhile(isOpen: boolean): (() => void) | undefined {
  if (!isOpen) return undefined;
  openDemoForm();
  return closeDemoForm;
}
