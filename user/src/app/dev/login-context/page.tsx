import { notFound } from "next/navigation";
import LoginContextDevClient from "./client";

/**
 * Demo page showcasing the login context integration. Relocated from /demo when
 * that URL became the Try-It Demo Mode feature — this internal dev/QA tool has
 * no other consumers (confirmed) and isn't linked from anywhere in the app.
 *
 * "Unlinked" is not the same as "not shipped": the route was still built and
 * served in production, reachable by anyone who guessed the URL. It stays fully
 * usable in local dev and 404s in production, so QA keeps the tool without it
 * being part of the public surface.
 *
 * A server component on purpose — the check has to run before the page is
 * served, not in the browser after it has already been sent.
 */
export default function LoginContextDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <LoginContextDevClient />;
}
