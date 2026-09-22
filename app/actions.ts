"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// 1. CREATE ISSUE — Student reports a new campus issue (optional image URL)
// ---------------------------------------------------------------------------
export async function createIssue(formData: FormData) {
  const session = getSession();
  if (!session) throw new Error("Not authenticated.");

  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const location = String(formData.get("location") || "").trim();
  const imageUrl = String(formData.get("imageUrl") || "").trim();

  if (!title || !description) throw new Error("Title and description are required.");

  await prisma.issue.create({
    data: {
      title,
      description,
      location: location || null,
      imageUrl: imageUrl || null,
      reportedById: session.id,
      status: "PENDING",
    },
  });

  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// 2. ASSIGN ISSUE — Admin assigns an issue to a Staff member
// ---------------------------------------------------------------------------
export async function assignIssue(formData: FormData) {
  const session = getSession();
  if (!session || session.role !== "ADMIN") throw new Error("Only admins can assign issues.");

  const issueId = String(formData.get("issueId") || "");
  const staffId = String(formData.get("staffId") || "");
  if (!issueId || !staffId) throw new Error("Issue and staff member are required.");

  await prisma.issue.update({
    where: { id: issueId },
    data: { assignedToId: staffId, status: "ASSIGNED" },
  });

  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// 3. RESOLVE ISSUE — Staff marks an issue resolved and logs a work comment
// ---------------------------------------------------------------------------
export async function resolveIssue(formData: FormData) {
  const session = getSession();
  if (!session || session.role !== "STAFF") throw new Error("Only staff can resolve issues.");

  const issueId = String(formData.get("issueId") || "");
  const comment = String(formData.get("comment") || "").trim();
  if (!issueId) throw new Error("Issue id is required.");

  await prisma.$transaction([
    prisma.issue.update({
      where: { id: issueId },
      data: { status: "RESOLVED" },
    }),
    ...(comment
      ? [
          prisma.comment.create({
            data: { text: comment, issueId, userId: session.id },
          }),
        ]
      : []),
  ]);

  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// 4. MANAGE RESOURCE — Admin creates or updates a college equipment resource
// ---------------------------------------------------------------------------
export async function manageResource(formData: FormData) {
  const session = getSession();
  if (!session || session.role !== "ADMIN") throw new Error("Only admins can manage resources.");

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const type = String(formData.get("type") || "").trim();
  const location = String(formData.get("location") || "").trim();
  const quantity = parseInt(String(formData.get("quantity") || "1"), 10) || 1;
  const condition = String(formData.get("condition") || "GOOD");

  if (!name || !type || !location) throw new Error("Name, type and location are required.");

  if (id) {
    await prisma.resource.update({
      where: { id },
      data: { name, type, location, quantity, condition },
    });
  } else {
    await prisma.resource.create({
      data: { name, type, location, quantity, condition },
    });
  }

  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// EXTRA — logout helper used by the dashboard header
// ---------------------------------------------------------------------------
export async function logout() {
  const { cookies } = await import("next/headers");
  const { redirect } = await import("next/navigation");
  cookies().set("campus_session", "", { path: "/", maxAge: 0 });
  redirect("/");
}
