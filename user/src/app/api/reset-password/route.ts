import { serverApiUrl, fetchWithRetry } from '@/lib/api/client';

export async function POST(request: Request) {
  try {
    const response = await fetchWithRetry(serverApiUrl('/v1/auth/reset-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(await request.json()),
    });

    return new Response(await response.text(), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(
      JSON.stringify({ message: 'The server is waking up. Please try again in a moment.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
