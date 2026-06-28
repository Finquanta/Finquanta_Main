import { apiFetch } from './client';

export interface SubscribeResult {
  subscribed: boolean;
  alreadySubscribed: boolean;
}

/** Save a newsletter subscriber. Public — no auth required. */
export async function subscribeNewsletter(
  email: string,
  source: 'newsletter' | 'hero' = 'newsletter'
): Promise<SubscribeResult> {
  return apiFetch<SubscribeResult>('/v1/newsletter/subscribe', {
    method: 'POST',
    body: JSON.stringify({ email, source }),
  });
}
