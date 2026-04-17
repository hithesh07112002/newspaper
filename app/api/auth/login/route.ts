import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { createAuthToken, getSessionCookieName } from "@/lib/auth";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validators";

const FIXED_AGENT_ID = "AGENT001";
const FIXED_AGENT_PASSWORD = "AGENT@123";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid credentials" }, { status: 400 });
  }

  const { identifier, password } = parsed.data;
  const normalizedIdentifier = identifier.trim().toLowerCase();

  if (
    normalizedIdentifier === FIXED_AGENT_ID.toLowerCase() &&
    password === FIXED_AGENT_PASSWORD
  ) {
    const token = await createAuthToken({
      userId: "fixed-agent",
      username: FIXED_AGENT_ID,
      role: "AGENT",
    });

    const response = NextResponse.json({
      user: {
        id: "fixed-agent",
        username: FIXED_AGENT_ID,
        email: "agent@fixed.local",
        role: "AGENT",
        approvalStatus: "APPROVED",
      },
    });

    response.cookies.set(getSessionCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  }

  const user = await db.user.findFirst({
    where: {
      OR: [{ email: normalizedIdentifier }, { username: normalizedIdentifier }],
    },
  });

  if (!user) {
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
  }

  if (user.role === "AGENT") {
    return NextResponse.json(
      { message: "Agent must use fixed ID and password" },
      { status: 401 },
    );
  }

  if (user.role === "DELIVERY_BOY" && user.approvalStatus !== "APPROVED") {
    const approvalMessage =
      user.approvalStatus === "REJECTED"
        ? "Delivery boy registration was rejected by agent"
        : "Delivery boy account is pending approval";
    return NextResponse.json({ message: approvalMessage }, { status: 403 });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
  }

  const token = await createAuthToken({
    userId: user.id,
    username: user.username,
    role: user.role,
  });

  const response = NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      approvalStatus: user.approvalStatus,
    },
  });

  response.cookies.set(getSessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
