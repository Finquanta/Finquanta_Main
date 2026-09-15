import { AsyncLocalStorage } from 'async_hooks';

/**
 * Who the current request is for, carried through everything it awaits.
 *
 * Exists for the books history: its database triggers record who made each
 * change, and a trigger can only learn that from the connection it runs on.
 * `Database` reads this to tag writes made while serving a signed-in request.
 *
 * Opened per request by an onRequest hook in routes/api.ts; filled in by
 * `authenticate` once the token is verified.
 */
export interface RequestContext {
  userId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export const currentActor = (): string | undefined => requestContext.getStore()?.userId;
