import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireRole(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  return NextResponse.json({ user: auth.user });
}
