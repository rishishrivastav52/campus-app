import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { encodeSession, sessionCookieOptions } from "@/lib/session";

// POST /api/auth -> login. Validates password with bcrypt and sets a
// signed-by-httpOnly mock session cookie (base64 JSON) for role-based access.
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    const token = encodeSession({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    const res = NextResponse.json({
      success: true,
      role: user.role,
      name: user.name,
    });

    const { name: cookieName, ...options } = sessionCookieOptions();
    res.cookies.set(cookieName, token, options);

    return res;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

// DELETE /api/auth -> logout, clears the session cookie.
export async function DELETE() {
  const res = NextResponse.json({ success: true });
  const { name: cookieName } = sessionCookieOptions();
  res.cookies.set(cookieName, "", { path: "/", maxAge: 0 });
  return res;
}
