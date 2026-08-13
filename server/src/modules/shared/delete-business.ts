import { Database } from '../../infrastructure/database';

/**
 * Permanently deletes one business and everything under it — invoices, ledger,
 * customers, groups, brain nodes, council sessions. Returns true if a business
 * row was actually removed.
 *
 * This is the workspace-scoped sibling of `deleteUserAccount`, and it exists
 * for the same reason that one does: the teardown needs an explicit order, and
 * putting that order in a caller is how it ends up wrong in the second caller.
 *
 * The ledger must be torn down by hand first. `accounts` cascades from
 * `businesses`, but `journal_lines.account_id` is ON DELETE RESTRICT — a
 * deliberate guard stopping anyone dropping a chart-of-accounts row that still
 * has postings against it. Postgres does not order a cascade, so if it reaches
 * `accounts` before `journal_entries` the RESTRICT aborts the whole delete:
 *
 *   update or delete on table "accounts" violates foreign key constraint
 *   "journal_lines_account_id_fkey" on table "journal_lines"
 *
 * Deleting the entries first takes their lines with them (that FK does
 * cascade), leaving `accounts` unreferenced and free to go.
 *
 * NOTE for anyone testing this: a workspace with an empty ledger deletes
 * cleanly even if the ordering is wrong. Only a business with posted
 * transactions exercises the RESTRICT.
 */
export async function deleteBusinessCascade(
  database: Database,
  businessId: string
): Promise<boolean> {
  // One transaction, so a failure part-way cannot leave a business stripped of
  // its financial history but still standing — the split this guards against.
  return database.transaction(async (client) => {
    await client.query('DELETE FROM journal_entries WHERE business_id = $1', [businessId]);
    const result = await client.query('DELETE FROM businesses WHERE id = $1', [businessId]);
    return (result.rowCount ?? 0) > 0;
  });
}
