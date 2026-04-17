import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireRole(request);
  if (!auth.ok) {
    return NextResponse.json(
      { message: auth.message },
      {
        status: auth.status,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      },
    );
  }

  return NextResponse.json(
    { user: auth.user },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
  );
}
