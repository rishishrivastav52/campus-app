import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { encodeSession, sessionCookieOptions } from "@/lib/session";

// POST /api/signup -> Student or Staff self-signup only. Admin has no
// signup path; the single admin account only exists via prisma/seed.ts.
export async function POST(req: NextRequest) {
  try {
    const { name, email, password, role } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email and password are required." }, { status: 400 });
    }
    if (role !== "STUDENT" && role !== "STAFF") {
      return NextResponse.json({ error: "Invalid role. Sign up as Student or Staff only." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashed, role },
    });

    const token = encodeSession({ id: user.id, name: user.name, email: user.email, role: user.role });
    const res = NextResponse.json({ success: true, role: user.role, name: user.name });
    const { name: cookieName, ...options } = sessionCookieOptions();
    res.cookies.set(cookieName, token, options);
    return res;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
