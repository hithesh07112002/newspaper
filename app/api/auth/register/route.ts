import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registerSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid registration data" }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ message: "Email already registered" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const approvalStatus =
    parsed.data.role === "DELIVERY_BOY"
      ? "PENDING"
      : "APPROVED";

  const created = await db.user.create({
    data: {
      email,
      username: email,
      passwordHash,
      role: parsed.data.role,
      approvalStatus,
    },
    select: {
      id: true,
      email: true,
      role: true,
      approvalStatus: true,
    },
  });

  const message =
    created.role === "DELIVERY_BOY"
      ? "Registration submitted. Wait for agent approval before login."
      : "Registration successful. You can now log in.";

  return NextResponse.json(
    {
      message,
      user: created,
    },
    { status: 201 },
  );
}
