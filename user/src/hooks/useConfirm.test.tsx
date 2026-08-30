import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '@/hooks/context/LanguageContext';
import { useConfirm } from '@/hooks/useConfirm';

/**
 * The confirmation that stands in front of every destructive action.
 *
 * Three of these are behaviours that are awkward to click and were wrong:
 * dismissing a dialog while its action is still running (it looked cancelled
 * but the delete carried on), a backdrop click escaping into a parent modal's
 * own close handler (which discarded the editor behind it), and an action that
 * fails needing to leave the question on screen.
 */

const wrap = (ui: React.ReactNode) => render(<LanguageProvider>{ui}</LanguageProvider>);

/** A never-settling promise, to hold the dialog in its busy state. */
const pending = () => new Promise<void>(() => {});

describe('useConfirm', () => {
  it('runs the action on confirm and closes', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    function H() {
      const { ask, dialog } = useConfirm(false);
      return (
        <>
          <button onClick={() => ask({ title: 'Delete this?', body: 'Gone forever.', onConfirm })}>go</button>
          {dialog}
        </>
      );
    }
    wrap(<H />);

    await user.click(screen.getByRole('button', { name: 'go' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));

    expect(onConfirm).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('does not run the action on cancel', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    function H() {
      const { ask, dialog } = useConfirm(false);
      return (
        <>
          <button onClick={() => ask({ title: 'Delete this?', body: 'x', onConfirm })}>go</button>
          {dialog}
        </>
      );
    }
    wrap(<H />);

    await user.click(screen.getByRole('button', { name: 'go' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cannot be dismissed while the action is running', async () => {
    // Buttons were already disabled when busy, but Escape and the backdrop were
    // not — so the dialog vanished as if cancelled while the delete ran on.
    const user = userEvent.setup();
    function H() {
      const { ask, dialog } = useConfirm(false);
      return (
        <>
          <button onClick={() => ask({ title: 'Delete this?', body: 'x', onConfirm: pending })}>go</button>
          {dialog}
        </>
      );
    }
    wrap(<H />);

    await user.click(screen.getByRole('button', { name: 'go' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));

    // Busy: the confirm button shows the working label.
    await screen.findByRole('button', { name: 'Working…' });

    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const backdrop = screen.getByRole('dialog').parentElement!;
    await user.click(backdrop);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('a backdrop click does not reach a parent modal behind it', async () => {
    // AddNodeModal closes itself on a backdrop click. The confirmation renders
    // inside it, so without stopPropagation, dismissing the confirm also tore
    // down the editor and discarded unsaved edits.
    const user = userEvent.setup();
    const parentClose = vi.fn();
    function H() {
      const { ask, dialog } = useConfirm(false);
      return (
        <div onClick={parentClose} data-testid="parent-modal">
          <button onClick={(e) => { e.stopPropagation(); ask({ title: 'Delete node?', body: 'x', onConfirm: vi.fn() }); }}>
            go
          </button>
          {dialog}
        </div>
      );
    }
    wrap(<H />);

    await user.click(screen.getByRole('button', { name: 'go' }));
    const backdrop = (await screen.findByRole('dialog')).parentElement!;
    await user.click(backdrop);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(parentClose).not.toHaveBeenCalled();
  });

  it('closes on Escape when idle', async () => {
    const user = userEvent.setup();
    function H() {
      const { ask, dialog } = useConfirm(false);
      return (
        <>
          <button onClick={() => ask({ title: 'Delete this?', body: 'x', onConfirm: vi.fn() })}>go</button>
          {dialog}
        </>
      );
    }
    wrap(<H />);

    await user.click(screen.getByRole('button', { name: 'go' }));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  describe('keepOpenOnError', () => {
    const failing = () => Promise.reject(new Error('Could not delete this entry.'));

    it('keeps the question up and prints the failure', async () => {
      const user = userEvent.setup();
      function H() {
        const { ask, dialog } = useConfirm(false);
        return (
          <>
            <button onClick={() => ask({ title: 'Delete this entry?', body: 'x', keepOpenOnError: true, onConfirm: failing })}>go</button>
            {dialog}
          </>
        );
      }
      wrap(<H />);

      await user.click(screen.getByRole('button', { name: 'go' }));
      await user.click(await screen.findByRole('button', { name: 'Confirm' }));

      expect(await screen.findByText('Could not delete this entry.')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('closes on failure by default, so the caller reports it', async () => {
      const user = userEvent.setup();
      function H() {
        const { ask, dialog } = useConfirm(false);
        return (
          <>
            <button onClick={() => ask({ title: 'Delete this?', body: 'x', onConfirm: failing })}>go</button>
            {dialog}
          </>
        );
      }
      wrap(<H />);

      await user.click(screen.getByRole('button', { name: 'go' }));
      await user.click(await screen.findByRole('button', { name: 'Confirm' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });
  });

  describe('focus', () => {
    // `aria-modal` tells a screen reader the rest of the page is inert. Without
    // a trap that is a lie: Tab walks onto buttons behind the overlay that the
    // reader cannot see but can still activate.
    const Harness = () => {
      const { ask, dialog } = useConfirm(false);
      return (
        <>
          <button onClick={() => ask({ title: 'Delete this?', body: 'x', onConfirm: vi.fn() })}>go</button>
          <button>behind the dialog</button>
          {dialog}
        </>
      );
    };

    it('moves into the dialog when it opens', async () => {
      const user = userEvent.setup();
      wrap(<Harness />);
      await user.click(screen.getByRole('button', { name: 'go' }));
      await screen.findByRole('dialog');
      expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus();
    });

    it('wraps forward instead of escaping to the page behind', async () => {
      const user = userEvent.setup();
      wrap(<Harness />);
      await user.click(screen.getByRole('button', { name: 'go' }));
      await screen.findByRole('dialog');

      await user.tab();
      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
      // Cancel is the last control, so the next Tab must come back round.
      await user.tab();
      expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus();
      expect(screen.getByRole('button', { name: 'behind the dialog' })).not.toHaveFocus();
    });

    it('wraps backward too', async () => {
      const user = userEvent.setup();
      wrap(<Harness />);
      await user.click(screen.getByRole('button', { name: 'go' }));
      await screen.findByRole('dialog');

      await user.tab({ shift: true });
      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    });

    it('goes back where it came from when the dialog closes', async () => {
      const user = userEvent.setup();
      wrap(<Harness />);
      const opener = screen.getByRole('button', { name: 'go' });
      await user.click(opener);
      await screen.findByRole('dialog');
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(opener).toHaveFocus();
    });
  });

  it('gives the dialog an accessible name from its title', async () => {
    const user = userEvent.setup();
    function H() {
      const { ask, dialog } = useConfirm(false);
      return (
        <>
          <button onClick={() => ask({ title: 'Delete the workspace?', body: 'x', onConfirm: vi.fn() })}>go</button>
          {dialog}
        </>
      );
    }
    wrap(<H />);

    await user.click(screen.getByRole('button', { name: 'go' }));
    expect(await screen.findByRole('dialog', { name: 'Delete the workspace?' })).toBeInTheDocument();
  });
});
