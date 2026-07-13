import { Database } from '../../infrastructure/database';

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
  /**
   * Money this customer still owes (unpaid invoices). Populated once the
   * invoice module exists; 0 until then.
   */
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

const mapRow = (r: any): Customer => ({
  id: r.id,
  name: r.name,
  email: r.email ?? null,
  phone: r.phone ?? null,
  addressLine1: r.address_line1 ?? null,
  addressLine2: r.address_line2 ?? null,
  city: r.city ?? null,
  region: r.region ?? null,
  postalCode: r.postal_code ?? null,
  country: r.country ?? null,
  notes: r.notes ?? null,
  createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
  outstandingBalance: Number.parseFloat(r.outstanding_balance ?? '0') || 0,
});

export class CustomersRepository {
  constructor(private database: Database) {}

  /** Idempotently create the customers table. Scoped per business. */
  async ensureSchema(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        email VARCHAR(320),
        phone VARCHAR(40),
        address_line1 VARCHAR(200),
        address_line2 VARCHAR(200),
        city VARCHAR(120),
        region VARCHAR(120),
        postal_code VARCHAR(40),
        country VARCHAR(120),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await this.database.query(`CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id, name)`);
  }

  async list(businessId: string): Promise<Customer[]> {
    const result = await this.database.query(
      `SELECT * FROM customers WHERE business_id = $1 ORDER BY name ASC`,
      [businessId]
    );
    return result.rows.map(mapRow);
  }

  async getById(businessId: string, id: string): Promise<Customer | null> {
    const result = await this.database.query(
      `SELECT * FROM customers WHERE business_id = $1 AND id = $2`,
      [businessId, id]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async create(businessId: string, data: CustomerInput): Promise<Customer> {
    const result = await this.database.query(
      `INSERT INTO customers (business_id, name, email, phone, address_line1, address_line2, city, region, postal_code, country, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        businessId, data.name.trim(), data.email ?? null, data.phone ?? null,
        data.addressLine1 ?? null, data.addressLine2 ?? null, data.city ?? null,
        data.region ?? null, data.postalCode ?? null, data.country ?? null, data.notes ?? null,
      ]
    );
    return mapRow(result.rows[0]);
  }

  /** Partial update — only the fields provided are written. */
  async update(businessId: string, id: string, data: Partial<CustomerInput>): Promise<Customer | null> {
    const cols: Record<keyof CustomerInput, string> = {
      name: 'name', email: 'email', phone: 'phone',
      addressLine1: 'address_line1', addressLine2: 'address_line2',
      city: 'city', region: 'region', postalCode: 'postal_code',
      country: 'country', notes: 'notes',
    };

    const set: string[] = [];
    const values: any[] = [];
    let i = 1;
    for (const [key, col] of Object.entries(cols) as [keyof CustomerInput, string][]) {
      const v = data[key];
      if (v !== undefined) {
        set.push(`${col} = $${i++}`);
        values.push(typeof v === 'string' ? v.trim() || null : v);
      }
    }
    if (set.length === 0) return this.getById(businessId, id);

    set.push('updated_at = NOW()');
    values.push(businessId, id);
    const result = await this.database.query(
      `UPDATE customers SET ${set.join(', ')} WHERE business_id = $${i++} AND id = $${i} RETURNING *`,
      values
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async remove(businessId: string, id: string): Promise<boolean> {
    const result = await this.database.query(
      `DELETE FROM customers WHERE business_id = $1 AND id = $2`,
      [businessId, id]
    );
    return (result.rowCount ?? 0) > 0;
  }
}
