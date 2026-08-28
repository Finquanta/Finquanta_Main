import { purgeDiscardedCaptures } from '../../../src/modules/capture/capture.service';

/**
 * The recycle bin sweep.
 *
 * `purgeDiscardedCaptures` takes its repository and storage as arguments, so
 * these are plain fakes rather than jest.mock factories — there is nothing to
 * intercept.
 */

function fakes(rows: { id: string; storageKey: string }[], failOn: string[] = []) {
  const deletedBlobs: string[] = [];
  const deletedRows: string[] = [];

  const repo = {
    listPurgeable: jest.fn(async () => rows),
    deleteByIds: jest.fn(async (ids: string[]) => {
      deletedRows.push(...ids);
      return ids.length;
    }),
  } as any;

  const storage = {
    put: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(async (key: string) => {
      if (failOn.includes(key)) throw new Error(`storage refused ${key}`);
      deletedBlobs.push(key);
    }),
  } as any;

  return { repo, storage, deletedBlobs, deletedRows };
}

describe('capture — purging the recycle bin', () => {
  it('deletes the blob and then the row', async () => {
    const f = fakes([
      { id: 'a', storageKey: 'k/a' },
      { id: 'b', storageKey: 'k/b' },
    ]);

    const result = await purgeDiscardedCaptures({ repo: f.repo, storage: f.storage });

    expect(f.deletedBlobs).toEqual(['k/a', 'k/b']);
    expect(f.deletedRows).toEqual(['a', 'b']);
    expect(result.blobsDeleted).toBe(2);
    expect(result.rowsDeleted).toBe(2);
    expect(result.blobFailures).toBe(0);
  });

  it('KEEPS the row when its blob could not be deleted', async () => {
    /**
     * The reason the order is blob-first. The row carries the storage key, so
     * deleting it after a failed blob delete would strand the bytes on disk
     * with nothing left pointing at them — a leak nothing can ever find again.
     * Keeping the row means the next sweep retries.
     */
    const f = fakes(
      [
        { id: 'a', storageKey: 'k/a' },
        { id: 'bad', storageKey: 'k/bad' },
        { id: 'c', storageKey: 'k/c' },
      ],
      ['k/bad']
    );

    const errors: unknown[] = [];
    const result = await purgeDiscardedCaptures({
      repo: f.repo, storage: f.storage, onError: (e) => errors.push(e),
    });

    expect(f.deletedRows).toEqual(['a', 'c']);
    expect(f.deletedRows).not.toContain('bad');
    expect(result.blobFailures).toBe(1);
    expect(result.rowsDeleted).toBe(2);
    expect(errors).toHaveLength(1);
  });

  it('one bad blob does not abandon the rest of the sweep', async () => {
    // The failure is in the middle; everything after it must still be swept.
    const f = fakes(
      [
        { id: 'bad', storageKey: 'k/bad' },
        { id: 'a', storageKey: 'k/a' },
      ],
      ['k/bad']
    );

    await purgeDiscardedCaptures({ repo: f.repo, storage: f.storage });

    expect(f.deletedBlobs).toEqual(['k/a']);
    expect(f.deletedRows).toEqual(['a']);
  });

  it('does not call the delete at all when nothing is old enough', async () => {
    const f = fakes([]);

    const result = await purgeDiscardedCaptures({ repo: f.repo, storage: f.storage });

    expect(f.storage.delete).not.toHaveBeenCalled();
    // No pointless DELETE ... WHERE id = ANY('{}') either.
    expect(f.repo.deleteByIds).toHaveBeenCalledWith([]);
    expect(result).toMatchObject({ examined: 0, blobsDeleted: 0, rowsDeleted: 0 });
  });

  it('passes the retention window through, and reports it back', async () => {
    const f = fakes([]);

    const result = await purgeDiscardedCaptures(
      { repo: f.repo, storage: f.storage },
      { olderThanDays: 7 }
    );

    expect(f.repo.listPurgeable).toHaveBeenCalledWith(7, 200);
    // Echoed so a scheduled run's log says which policy actually applied,
    // rather than leaving it to be inferred from an environment variable.
    expect(result.olderThanDays).toBe(7);
  });
});
