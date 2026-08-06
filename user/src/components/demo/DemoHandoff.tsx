'use client';

import { useEffect } from 'react';
import { stashForSignup } from '@/lib/demo/migrate';

/**
 * Mounted on the signup page. If the visitor arrived from the Try-It Demo, their
 * session is copied out of sessionStorage (which dies with the tab) into
 * localStorage, ready for the dashboard to replay into the new account.
 *
 * Doing it here rather than on each link means every route into signup is
 * covered — the banner, the top bar, the trigger prompt, the sidebar's
 * account-only items, or typing the URL. No-op when there's no demo session.
 *
 * What it writes is deliberately *provisional*: landing on /signup is not the
 * same as completing a signup, and the dashboard will not replay a stash that
 * no account has claimed. `bindStashToUser` in the signup form claims it the
 * moment registration actually succeeds.
 */
export default function DemoHandoff() {
  useEffect(() => { stashForSignup(); }, []);
  return null;
}
