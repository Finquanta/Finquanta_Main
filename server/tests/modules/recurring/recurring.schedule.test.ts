import { addPeriods, nextDue } from '../../../src/modules/recurring/recurring.types';
import { seriesKeyOf } from '../../../src/modules/recurring/recurring.repository';

const none = new Set<string>();

describe('recurring — the schedule', () => {
  it('advances a month', () => {
    // The case this feature was asked for: paid on the 20th of August.
    expect(addPeriods('2026-08-20', 'monthly', 1)).toBe('2026-09-20');
    expect(addPeriods('2026-08-20', 'monthly', 4)).toBe('2026-12-20');
  });

  it('rolls over the year', () => {
    expect(addPeriods('2026-11-20', 'monthly', 3)).toBe('2027-02-20');
    expect(addPeriods('2026-08-20', 'yearly', 1)).toBe('2027-08-20');
  });

  it('clamps to the end of a short month WITHOUT drifting afterwards', () => {
    // The whole reason occurrences are counted from the anchor rather than
    // stepped from the previous one: February must not pull the schedule to
    // the 28th permanently.
    expect(addPeriods('2026-01-31', 'monthly', 1)).toBe('2026-02-28');
    expect(addPeriods('2026-01-31', 'monthly', 2)).toBe('2026-03-31');
    expect(addPeriods('2026-01-31', 'monthly', 3)).toBe('2026-04-30');
  });

  it('handles a leap February', () => {
    expect(addPeriods('2028-01-31', 'monthly', 1)).toBe('2028-02-29');
  });

  it('asks once the date has come round', () => {
    expect(nextDue({
      firstDate: '2026-08-20', lastDate: '2026-08-20', recurrence: 'monthly',
      today: '2026-09-20', skipped: none,
    })).toBe('2026-09-20');
  });

  it('does not ask early', () => {
    expect(nextDue({
      firstDate: '2026-08-20', lastDate: '2026-08-20', recurrence: 'monthly',
      today: '2026-09-19', skipped: none,
    })).toBeNull();
  });

  it('does not ask again for something already recorded', () => {
    expect(nextDue({
      firstDate: '2026-08-20', lastDate: '2026-09-20', recurrence: 'monthly',
      today: '2026-09-25', skipped: none,
    })).toBeNull();
  });

  it('asks about the OLDEST outstanding period, one at a time', () => {
    // Three months behind. Being asked three near-identical questions at once
    // is how people learn to dismiss the prompt without reading it.
    expect(nextDue({
      firstDate: '2026-08-20', lastDate: '2026-08-20', recurrence: 'monthly',
      today: '2026-11-25', skipped: none,
    })).toBe('2026-09-20');
  });

  it('moves past a period that was declined', () => {
    // A "no" writes no transaction, so without the skip record this same
    // question would come back on every page load forever.
    expect(nextDue({
      firstDate: '2026-08-20', lastDate: '2026-08-20', recurrence: 'monthly',
      today: '2026-11-25', skipped: new Set(['2026-09-20']),
    })).toBe('2026-10-20');
  });

  it('goes quiet when every outstanding period was declined', () => {
    expect(nextDue({
      firstDate: '2026-08-20', lastDate: '2026-08-20', recurrence: 'monthly',
      today: '2026-10-25',
      skipped: new Set(['2026-09-20', '2026-10-20']),
    })).toBeNull();
  });

  it('goes quiet for a series nobody has recorded in years', () => {
    // Without this it would offer February 1990 as the outstanding occurrence,
    // since technically every month since is missing.
    expect(nextDue({
      firstDate: '1990-01-15', lastDate: '1990-01-15', recurrence: 'monthly',
      today: '2026-08-28', skipped: none,
    })).toBeNull();
  });

  it('still asks about a series only a few months behind', () => {
    // The boundary that matters: late is not the same as abandoned.
    expect(nextDue({
      firstDate: '2026-02-20', lastDate: '2026-05-20', recurrence: 'monthly',
      today: '2026-08-28', skipped: none,
    })).toBe('2026-06-20');
  });

  it('allows a yearly series a longer silence than a monthly one', () => {
    // 13 months since the last entry: dead for something billed monthly,
    // perfectly normal for something billed once a year.
    expect(nextDue({
      firstDate: '2025-07-20', lastDate: '2025-07-20', recurrence: 'monthly',
      today: '2026-08-28', skipped: none,
    })).toBeNull();
    expect(nextDue({
      firstDate: '2025-07-20', lastDate: '2025-07-20', recurrence: 'yearly',
      today: '2026-08-28', skipped: none,
    })).toBe('2026-07-20');
  });

  it('treats income and expense of the same name as different series', () => {
    // Otherwise a client paying "Acme" and a bill from "Acme" collide, and
    // confirming one would silence the other.
    expect(seriesKeyOf('income', 'Acme', 'monthly'))
      .not.toBe(seriesKeyOf('expense', 'Acme', 'monthly'));
  });

  it('ignores case and padding in a name', () => {
    expect(seriesKeyOf('expense', '  Claude Code ', 'monthly'))
      .toBe(seriesKeyOf('expense', 'claude code', 'monthly'));
  });
});
