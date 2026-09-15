import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/hooks/context/LanguageContext';
import AuthShell from '@/components/auth/AuthShell';

/**
 * The layout every customer auth screen shares. The two things worth pinning:
 * the brand panel is the same everywhere, and its moving decoration never
 * reaches assistive technology.
 */

const renderShell = (wide = false) =>
  render(
    <LanguageProvider>
      <AuthShell wide={wide}>
        <p>form goes here</p>
      </AuthShell>
    </LanguageProvider>
  );

describe('AuthShell', () => {
  it('renders the form it is given', () => {
    renderShell();
    expect(screen.getByText('form goes here')).toBeTruthy();
  });

  it('shows the brand tagline', () => {
    renderShell();
    expect(screen.getByText('One brain for your business')).toBeTruthy();
  });

  it('hides the animated blobs from assistive technology', () => {
    renderShell();
    const blobs = screen.getByTestId('auth-blobs');
    expect(blobs.getAttribute('aria-hidden')).toBe('true');
  });

  it('turns the animation off for people who ask for reduced motion', () => {
    renderShell();
    const blobs = screen.getByTestId('auth-blobs').children;
    expect(blobs.length).toBe(3);
    for (const blob of Array.from(blobs)) {
      expect(blob.className).toContain('motion-reduce:animate-none');
    }
  });

  it('gives sign up a wider form column than log in', () => {
    const { container, unmount } = renderShell(false);
    expect(container.querySelector('.max-w-\\[360px\\]')).toBeTruthy();
    unmount();
    const wide = renderShell(true);
    expect(wide.container.querySelector('.max-w-\\[420px\\]')).toBeTruthy();
  });
});
