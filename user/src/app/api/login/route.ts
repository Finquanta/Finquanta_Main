import { serverApiUrl } from '@/lib/api/client';

export async function GET() {
  return new Response(
    JSON.stringify({ status: "ok" }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

export async function POST(request: Request) {
  const response = await fetch(serverApiUrl('/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(await request.json())
  });

  return new Response(await response.text(), {
    status: response.status,
    headers: { "Content-Type": "application/json" }
  });
}

