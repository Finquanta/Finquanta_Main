import { apiFetch } from './client';

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  notes: string | null;
  createdAt: string | null;
  /** Unpaid invoice total. Wired up with the invoice module. */
  outstandingBalance: number;
}

export interface CustomerInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  notes?: string | null;
}

export async function listCustomers(): Promise<Customer[]> {
  return apiFetch<Customer[]>('/v1/customers');
}

export async function getCustomer(id: string): Promise<Customer> {
  return apiFetch<Customer>(`/v1/customers/${id}`);
}

export async function createCustomer(data: CustomerInput): Promise<Customer> {
  return apiFetch<Customer>('/v1/customers', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateCustomer(id: string, data: Partial<CustomerInput>): Promise<Customer> {
  return apiFetch<Customer>(`/v1/customers/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteCustomer(id: string): Promise<void> {
  await apiFetch(`/v1/customers/${id}`, { method: 'DELETE' });
}

/** Multi-line postal address for invoices / display. */
export function formatAddress(c: Customer): string {
  return [
    c.addressLine1,
    c.addressLine2,
    [c.city, c.region, c.postalCode].filter(Boolean).join(', '),
    c.country,
  ].filter(Boolean).join('\n');
}
