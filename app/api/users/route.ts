import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["AGENT", "ADMIN"]);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const users = await db.user.findMany({
    where: { role: "USER" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      username: true,
      email: true,
      _count: {
        select: {
          assignedCustomers: true,
        },
      },
    },
  });

  return NextResponse.json(
    {
      users: users.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        assignedCustomerCount: user._count.assignedCustomers,
      })),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}