import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/hooks/context/LanguageContext';
import InvoiceTemplate from '@/components/user_dashboard/invoices/InvoiceTemplate';
import type { Invoice } from '@/lib/api/invoices';
import type { BusinessProfile } from '@/lib/api/business';

/**
 * The business block at the top of a customer's invoice.
 *
 * Registration and tax numbers are optional, and many invoices legally need the
 * tax (VAT) number, so the two things worth pinning are: a filled-in number
 * prints WITH its label, and a blank one prints nothing at all — no dangling
 * "Tax No." on a sole trader's invoice.
 */

const invoice = {
  number: 'INV-0042',
  issueDate: '2026-09-01',
  dueDate: '2026-09-30',
  items: [],
  subtotal: 100,
  tax: 0,
  taxRate: 0,
  total: 100,
  currency: 'USD',
} as unknown as Invoice;

const renderWith = (business: BusinessProfile) =>
  render(
    <LanguageProvider>
      <InvoiceTemplate invoice={invoice} business={business} customer={null} />
    </LanguageProvider>
  );

describe('InvoiceTemplate business header', () => {
  it('prints the registration and tax numbers with their labels', () => {
    // Numbers chosen so neither is a substring of the other: a regex for one
    // must not also match the other's line.
    renderWith({ businessName: 'Acme Trading', registrationNumber: '87654321', taxNumber: 'GB123456789' });

    const reg = screen.getByText(/87654321/);
    const tax = screen.getByText(/GB123456789/);
    expect(reg.textContent).toContain('Reg. No.');
    expect(tax.textContent).toContain('Tax No.');
  });

  it('prints neither line when both are missing', () => {
    renderWith({ businessName: 'Acme Trading' });
    expect(screen.queryByText(/Reg\. No\./)).toBeNull();
    expect(screen.queryByText(/Tax No\./)).toBeNull();
  });

  it('treats a whitespace-only value as missing', () => {
    renderWith({ businessName: 'Acme Trading', registrationNumber: '   ', taxNumber: '' });
    expect(screen.queryByText(/Reg\. No\./)).toBeNull();
    expect(screen.queryByText(/Tax No\./)).toBeNull();
  });

  it('prints one without the other', () => {
    renderWith({ businessName: 'Acme Trading', taxNumber: 'GB123456789' });
    expect(screen.getByText(/GB123456789/).textContent).toContain('Tax No.');
    expect(screen.queryByText(/Reg\. No\./)).toBeNull();
  });
});
