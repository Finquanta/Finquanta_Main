import { Database } from './database';

/**
 * Where captured documents live.
 *
 * Two drivers behind one interface, chosen by STORAGE_DRIVER:
 *
 *  - `postgres` — the default, and what local development runs on. Needs no
 *    vendor account and no credentials, so this feature can be built and tested
 *    before anyone signs up for anything.
 *  - `s3` — production. Plain S3 API, so Cloudflare R2, S3 and Backblaze are
 *    interchangeable; R2 is the recommendation because its egress is free and
 *    every review popup re-reads the file it is reviewing.
 *
 * The interface is the point. Receipts already live in Postgres BYTEA
 * (see financial/receipt.repository.ts) and that is fine for the occasional
 * PDF stapled to an entry — it does not hold for a feature designed around
 * volume. Binaries in Postgres bloat the table, stream every read through the
 * connection pool, and Neon bills storage well above object-store rates. This
 * keeps that decision reversible instead of baked into every call site.
 */
export interface StoredObject {
  body: Buffer;
  mime: string;
}

export interface StorageDriver {
  put(key: string, body: Buffer, mime: string): Promise<void>;
  get(key: string): Promise<StoredObject>;
  delete(key: string): Promise<void>;
}

/**
 * Development driver. Same medium as transaction_receipts, deliberately — it is
 * a known-good pattern on this stack, and it means no part of this feature is
 * blocked on provisioning a bucket.
 */
export class PostgresBlobDriver implements StorageDriver {
  constructor(private readonly database: Database) {}

  async ensureSchema(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS stored_objects (
        storage_key TEXT PRIMARY KEY,
        mime_type VARCHAR(100) NOT NULL,
        data BYTEA NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
  }

  async put(key: string, body: Buffer, mime: string): Promise<void> {
    await this.database.query(
      `INSERT INTO stored_objects (storage_key, mime_type, data)
            VALUES ($1, $2, $3)
       ON CONFLICT (storage_key) DO UPDATE SET mime_type = EXCLUDED.mime_type, data = EXCLUDED.data`,
      [key, mime, body]
    );
  }

  async get(key: string): Promise<StoredObject> {
    const r = await this.database.query(
      'SELECT mime_type, data FROM stored_objects WHERE storage_key = $1',
      [key]
    );
    if (r.rows.length === 0) throw new Error('Stored object not found');
    return { body: r.rows[0].data as Buffer, mime: r.rows[0].mime_type as string };
  }

  async delete(key: string): Promise<void> {
    await this.database.query('DELETE FROM stored_objects WHERE storage_key = $1', [key]);
  }
}

/** The narrow slice of the S3 client this uses. Declared locally so the server
 * compiles and boots without the SDK present — see the note on the driver. */
interface S3ClientLike {
  send(command: unknown): Promise<{
    Body?: { transformToByteArray(): Promise<Uint8Array> };
    ContentType?: string;
  }>;
}
type S3Module = {
  S3Client: new (config: Record<string, unknown>) => S3ClientLike;
  PutObjectCommand: new (input: Record<string, unknown>) => unknown;
  GetObjectCommand: new (input: Record<string, unknown>) => unknown;
  DeleteObjectCommand: new (input: Record<string, unknown>) => unknown;
};

/**
 * Production driver. S3-compatible, so the vendor is a config change.
 *
 * THE SDK IS NOT A DEPENDENCY OF THIS SERVER, and that is deliberate. The same
 * reasoning is written into council.service.ts and brain.enrich.ts about the AI
 * client: "the server has no AI dependency today and adding one risks the
 * Render build." An 80-package AWS SDK that nothing can exercise until a bucket
 * exists is exactly that risk, taken early and for nothing.
 *
 * So it is loaded BY NAME at runtime. The server builds, boots and runs on the
 * Postgres driver with the package absent; the first thing that needs S3 says
 * plainly what to install. Before switching STORAGE_DRIVER=s3:
 *
 *     cd server && pnpm add @aws-sdk/client-s3
 */
export class S3CompatibleDriver implements StorageDriver {
  private client: S3ClientLike | null = null;
  private mod: S3Module | null = null;

  constructor(
    private readonly config: {
      endpoint: string;
      bucket: string;
      accessKeyId: string;
      secretAccessKey: string;
      region: string;
    }
  ) {}

  private async load(): Promise<S3Module> {
    if (this.mod) return this.mod;
    // Built from parts so the compiler cannot resolve it statically — the whole
    // point is that this file compiles without the package installed.
    const specifier = ['@aws-sdk', 'client-s3'].join('/');
    try {
      this.mod = (await import(specifier)) as S3Module;
    } catch {
      throw new Error(
        'STORAGE_DRIVER=s3 needs the S3 client. Run: cd server && pnpm add @aws-sdk/client-s3'
      );
    }
    return this.mod;
  }

  private async s3(): Promise<S3ClientLike> {
    if (!this.client) {
      const { S3Client } = await this.load();
      this.client = new S3Client({
        endpoint: this.config.endpoint,
        // R2 ignores region entirely, but the SDK refuses to construct without
        // one. 'auto' is what Cloudflare's own documentation uses.
        region: this.config.region,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
      });
    }
    return this.client;
  }

  async put(key: string, body: Buffer, mime: string): Promise<void> {
    const { PutObjectCommand } = await this.load();
    const client = await this.s3();
    await client.send(
      new PutObjectCommand({ Bucket: this.config.bucket, Key: key, Body: body, ContentType: mime })
    );
  }

  async get(key: string): Promise<StoredObject> {
    const { GetObjectCommand } = await this.load();
    const client = await this.s3();
    const out = await client.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: key }));
    if (!out.Body) throw new Error('Stored object not found');
    const bytes = await out.Body.transformToByteArray();
    return { body: Buffer.from(bytes), mime: out.ContentType || 'application/octet-stream' };
  }

  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = await this.load();
    const client = await this.s3();
    await client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }
}

/**
 * Build the driver the environment asks for.
 *
 * Defaults to Postgres rather than S3 on purpose: an unset or half-set
 * STORAGE_DRIVER should fall back to the thing that works without credentials,
 * not to the thing that throws on first upload.
 */
export function createStorageDriver(database: Database): StorageDriver {
  if (process.env.STORAGE_DRIVER !== 's3') return new PostgresBlobDriver(database);

  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  // Fail here, at boot, rather than on the first customer's upload.
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'STORAGE_DRIVER=s3 requires S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.'
    );
  }

  return new S3CompatibleDriver({
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    region: process.env.S3_REGION || 'auto',
  });
}
