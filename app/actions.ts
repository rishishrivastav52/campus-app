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
// 2b. START WORK — Staff moves an issue from ASSIGNED to IN_PROGRESS
// ---------------------------------------------------------------------------
export async function startWork(formData: FormData) {
  const session = getSession();
  if (!session || session.role !== "STAFF") throw new Error("Only staff can start work on issues.");

  const issueId = String(formData.get("issueId") || "");
  if (!issueId) throw new Error("Issue id is required.");

  await prisma.issue.update({
    where: { id: issueId, assignedToId: session.id },
    data: { status: "IN_PROGRESS" },
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
// 5. REQUEST RESOURCE — Student requests a quantity of a resource
// ---------------------------------------------------------------------------
export async function requestResource(formData: FormData) {
  const session = getSession();
  if (!session || session.role !== "STUDENT") throw new Error("Only students can request resources.");

  const resourceId = String(formData.get("resourceId") || "");
  const customName = String(formData.get("customName") || "").trim();
  const quantity = parseInt(String(formData.get("quantity") || "1"), 10) || 1;
  if ((!resourceId && !customName) || quantity < 1) {
    throw new Error("Pick a resource or name one, plus a valid quantity.");
  }

  await prisma.resourceRequest.create({
    data: {
      resourceId: resourceId || null,
      customName: resourceId ? null : customName,
      studentId: session.id,
      quantity,
      status: "PENDING",
    },
  });

  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// 6. REVIEW RESOURCE REQUEST — Admin approves or rejects a pending request
// ---------------------------------------------------------------------------
export async function reviewResourceRequest(formData: FormData) {
  const session = getSession();
  if (!session || session.role !== "ADMIN") throw new Error("Only admins can review resource requests.");

  const requestId = String(formData.get("requestId") || "");
  const decision = String(formData.get("decision") || "");
  if (!requestId || (decision !== "APPROVED" && decision !== "REJECTED")) {
    throw new Error("A valid decision is required.");
  }

  await prisma.resourceRequest.update({ where: { id: requestId }, data: { status: decision } });
  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// 7. REQUEST RETURN — Student marks an approved resource as returned
// ---------------------------------------------------------------------------
export async function requestReturn(formData: FormData) {
  const session = getSession();
  if (!session || session.role !== "STUDENT") throw new Error("Only students can request a return.");

  const requestId = String(formData.get("requestId") || "");
  await prisma.resourceRequest.update({
    where: { id: requestId, studentId: session.id },
    data: { status: "RETURN_REQUESTED" },
  });
  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// 8. CONFIRM RETURN — Admin confirms the resource was actually returned
// ---------------------------------------------------------------------------
export async function confirmReturn(formData: FormData) {
  const session = getSession();
  if (!session || session.role !== "ADMIN") throw new Error("Only admins can confirm returns.");

  const requestId = String(formData.get("requestId") || "");
  await prisma.resourceRequest.update({ where: { id: requestId }, data: { status: "RETURNED" } });
  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// 9. REMOVE STAFF — Admin removes a staff account (unassigns their issues first)
// ---------------------------------------------------------------------------
export async function removeStaff(formData: FormData) {
  const session = getSession();
  if (!session || session.role !== "ADMIN") throw new Error("Only admins can remove staff.");

  const staffId = String(formData.get("staffId") || "");
  if (!staffId) throw new Error("Staff id is required.");

  await prisma.$transaction([
    prisma.issue.updateMany({
      where: { assignedToId: staffId },
      data: { assignedToId: null, status: "PENDING" },
    }),
    prisma.comment.deleteMany({ where: { userId: staffId } }),
    prisma.user.delete({ where: { id: staffId, role: "STAFF" } }),
  ]);

  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// 10. CLOSE ISSUE — Admin closes a resolved issue for good
// ---------------------------------------------------------------------------
export async function closeIssue(formData: FormData) {
  const session = getSession();
  if (!session || session.role !== "ADMIN") throw new Error("Only admins can close issues.");

  const issueId = String(formData.get("issueId") || "");
  await prisma.issue.update({ where: { id: issueId, status: "RESOLVED" }, data: { status: "CLOSED" } });
  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// 11. CANCEL RESOURCE REQUEST — Student cancels their own still-pending request
// ---------------------------------------------------------------------------
export async function cancelResourceRequest(formData: FormData) {
  const session = getSession();
  if (!session || session.role !== "STUDENT") throw new Error("Only students can cancel their own requests.");

  const requestId = String(formData.get("requestId") || "");
  await prisma.resourceRequest.delete({ where: { id: requestId, studentId: session.id, status: "PENDING" } });
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
