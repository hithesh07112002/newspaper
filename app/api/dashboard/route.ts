import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { currentMonthKey } from "@/lib/date";
import { getDashboardPayload } from "@/lib/server-ledger";
import { monthSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireRole(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const monthValue = request.nextUrl.searchParams.get("month") ?? currentMonthKey();
  const parsed = monthSchema.safeParse({ month: monthValue });

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid month format. Use YYYY-MM." }, { status: 400 });
  }

  try {
    const payload = await getDashboardPayload(parsed.data.month, auth.user);
    return NextResponse.json({ ...payload, viewer: auth.user }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { message: "Dashboard service is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
}
