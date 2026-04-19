import { NextRequest, NextResponse } from "next/server";
import {
  getSessionCookieName,
  getSessionCookieOptions,
  revokeAuthSessionFromRequest,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  await revokeAuthSessionFromRequest(request);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(getSessionCookieName(), "", {
    ...getSessionCookieOptions(),
    maxAge: 0,
  });

  return response;
}
