import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from '@/hooks/context/LanguageContext';
import { usePrompt } from '@/hooks/usePrompt';

/**
 * The chained-question contract, which is what renaming a Brain category needs.
 *
 * This is the bug that made the whole exercise worth it: `submit` awaited
 * `onSubmit` and then closed unconditionally, so a callback that opened the
 * NEXT question had it wiped a moment later. Renaming asked for a name, then
 * silently did nothing — no error, no second dialog, no save.
 *
 * It could not be caught by reading types and it could not be clicked without a
 * login, so it is pinned here instead.
 */

const wrap = (ui: React.ReactNode) => render(<LanguageProvider>{ui}</LanguageProvider>);

/** Mirrors brain/page.tsx renameCategory: ask for a name, then for a role. */
function RenameHarness({ onSaved }: { onSaved?: (v: string[]) => void } = {}) {
  const { askFor, dialog } = usePrompt(false);
  const [saved, setSaved] = useState<string[] | null>(null);

  const start = () =>
    askFor({
      title: 'Rename this category',
      label: 'Name',
      defaultValue: 'Marketing',
      onSubmit: (name) =>
        askFor({
          title: 'What is this part of the business for?',
          label: 'Role',
          defaultValue: '',
          onSubmit: (role) => {
            setSaved([name, role]);
            onSaved?.([name, role]);
          },
        }),
    });

  return (
    <>
      <button onClick={start}>rename</button>
      <div data-testid="saved">{saved ? saved.join('|') : 'nothing saved'}</div>
      {dialog}
    </>
  );
}

describe('usePrompt', () => {
  it('asks the second question when onSubmit chains another', async () => {
    const user = userEvent.setup();
    wrap(<RenameHarness />);

    await user.click(screen.getByRole('button', { name: 'rename' }));
    expect(await screen.findByText('Rename this category')).toBeInTheDocument();

    const name = screen.getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Growth');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // The regression: this second dialog never appeared.
    expect(await screen.findByText('What is this part of the business for?')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Role'), 'Owns demand');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByTestId('saved')).toHaveTextContent('Growth|Owns demand'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes after a single, unchained question', async () => {
    const user = userEvent.setup();
    function Single() {
      const { askFor, dialog } = usePrompt(false);
      const [value, setValue] = useState('');
      return (
        <>
          <button onClick={() => askFor({ title: 'One', label: 'Name', onSubmit: setValue })}>go</button>
          <div data-testid="v">{value}</div>
          {dialog}
        </>
      );
    }
    wrap(<Single />);

    await user.click(screen.getByRole('button', { name: 'go' }));
    await user.type(await screen.findByLabelText('Name'), 'x');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByTestId('v')).toHaveTextContent('x'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the question open and shows why when onSubmit throws', async () => {
    const user = userEvent.setup();
    function Failing() {
      const { askFor, dialog } = usePrompt(false);
      return (
        <>
          <button onClick={() => askFor({
            title: 'One', label: 'Name',
            onSubmit: () => { throw new Error('Server said no'); },
          })}>go</button>
          {dialog}
        </>
      );
    }
    wrap(<Failing />);

    await user.click(screen.getByRole('button', { name: 'go' }));
    await user.type(await screen.findByLabelText('Name'), 'x');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Server said no')).toBeInTheDocument();
    // Still open, and what was typed is still there.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('x');
  });

  it('validates before calling onSubmit', async () => {
    const user = userEvent.setup();
    function Validated() {
      const { askFor, dialog } = usePrompt(false);
      const [called, setCalled] = useState(false);
      return (
        <>
          <button onClick={() => askFor({
            title: 'One', label: 'Name',
            validate: (v) => (v.trim() ? null : 'Enter a name.'),
            onSubmit: () => setCalled(true),
          })}>go</button>
          <div data-testid="called">{String(called)}</div>
          {dialog}
        </>
      );
    }
    wrap(<Validated />);

    await user.click(screen.getByRole('button', { name: 'go' }));
    await user.click(await screen.findByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Enter a name.')).toBeInTheDocument();
    expect(screen.getByTestId('called')).toHaveTextContent('false');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('labels the input, so it is reachable by name', async () => {
    // The field had no htmlFor/id pairing, so screen readers got nothing.
    const user = userEvent.setup();
    function Single() {
      const { askFor, dialog } = usePrompt(false);
      return (
        <>
          <button onClick={() => askFor({ title: 'One', label: 'Months from today', onSubmit: () => {} })}>go</button>
          {dialog}
        </>
      );
    }
    wrap(<Single />);
    await user.click(screen.getByRole('button', { name: 'go' }));
    expect(await screen.findByLabelText('Months from today')).toBeInTheDocument();
  });
});
