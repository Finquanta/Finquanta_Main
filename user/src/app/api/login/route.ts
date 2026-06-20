import { serverApiUrl, fetchWithRetry } from '@/lib/api/client';

export async function GET() {
  return new Response(
    JSON.stringify({ status: "ok" }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

export async function POST(request: Request) {
  try {
    const response = await fetchWithRetry(serverApiUrl('/v1/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(await request.json())
    });

    return new Response(await response.text(), {
      status: response.status,
      headers: { "Content-Type": "application/json" }
    });
  } catch {
    // Backend unreachable (e.g. still waking) — return a clear 503 so the UI can
    // tell the user to retry, rather than falling through to demo mode.
    return new Response(
      JSON.stringify({ message: 'The server is waking up. Please try again in a moment.' }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}

