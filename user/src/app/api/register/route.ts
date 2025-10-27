export async function GET() {
  return new Response(
    JSON.stringify({ status: "ok" }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

export async function POST(request: Request) {
  // TODO: implement actual registration logic
  return new Response(
    JSON.stringify({ message: "Register endpoint not implemented" }),
    { status: 501, headers: { "Content-Type": "application/json" } }
  );
}

