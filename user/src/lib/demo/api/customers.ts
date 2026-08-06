/**
 * Demo mirror of lib/api/customers.ts — same exported names/signatures, backed
 * by sessionStorage instead of apiFetch. Demo pages import from here instead of
 * the real module; no real lib/api/*.ts file is touched.
 */
import { DemoCustomer, DemoState } from '../types';
import { load, save, recordInteraction, assertUnderCap, appendOp, newOpId } from '../store';
import { DemoError } from '../errors';

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

/**
 * What this customer still owes: their invoices that have been sent but not yet
 * paid. Same definition the real module uses — a draft hasn't been billed, and
 * a paid or cancelled invoice is settled.
 */
function outstandingFor(state: DemoState, customerId: string): number {
  const total = state.invoices
    .filter((i) => i.customerId === customerId && i.status === 'sent')
    .reduce((s, i) => s + i.total, 0);
  return Math.round(total * 100) / 100;
}

function toCustomer(c: DemoCustomer, state: DemoState): Customer {
  return { ...c, outstandingBalance: outstandingFor(state, c.id) };
}

export async function listCustomers(): Promise<Customer[]> {
  const state = load();
  return state.customers.map((c) => toCustomer(c, state));
}

export async function getCustomer(id: string): Promise<Customer> {
  const state = load();
  const c = state.customers.find((x) => x.id === id);
  if (!c) throw new DemoError('eCustNF', 'Customer not found');
  return toCustomer(c, state);
}

export async function createCustomer(data: CustomerInput): Promise<Customer> {
  if (!data.name?.trim()) throw new DemoError('eCustName', 'A customer name is required.');
  const state = load();
  assertUnderCap(state);

  const record: DemoCustomer = {
    id: crypto.randomUUID(),
    name: data.name.trim(),
    email: data.email ?? null,
    phone: data.phone ?? null,
    addressLine1: data.addressLine1 ?? null,
    addressLine2: data.addressLine2 ?? null,
    city: data.city ?? null,
    region: data.region ?? null,
    postalCode: data.postalCode ?? null,
    country: data.country ?? null,
    notes: data.notes ?? null,
    createdAt: new Date().toISOString(),
  };
  state.customers.push(record);
  appendOp(state, { opId: newOpId(), kind: 'create', entity: 'customer', entityId: record.id, at: Date.now() });
  recordInteraction(state);
  save(state);
  return toCustomer(record, state);
}

export async function updateCustomer(id: string, data: Partial<CustomerInput>): Promise<Customer> {
  const state = load();
  const idx = state.customers.findIndex((c) => c.id === id);
  if (idx === -1) throw new DemoError('eCustNF', 'Customer not found');
  state.customers[idx] = { ...state.customers[idx], ...data, name: (data.name ?? state.customers[idx].name).trim() };
  recordInteraction(state);
  save(state);
  return toCustomer(state.customers[idx], state);
}

export async function deleteCustomer(id: string): Promise<void> {
  const state = load();
  state.customers = state.customers.filter((c) => c.id !== id);
  recordInteraction(state);
  save(state);
}

/** Multi-line postal address for invoices / display. Same formatting as the real module. */
export function formatAddress(c: Customer): string {
  return [
    c.addressLine1,
    c.addressLine2,
    [c.city, c.region, c.postalCode].filter(Boolean).join(', '),
    c.country,
  ].filter(Boolean).join('\n');
}
