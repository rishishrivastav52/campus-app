import { redirect } from "next/navigation";
import {
  Building2,
  ClipboardList,
  Wrench,
  Users,
  LogOut,
  PlusCircle,
  Package,
  CheckCircle2,
} from "lucide-react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { createIssue, assignIssue, resolveIssue, manageResource, logout } from "@/app/actions";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  ASSIGNED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-purple-100 text-purple-700",
  RESOLVED: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-200 text-gray-600",
};

export default async function DashboardPage() {
  const session = getSession();
  if (!session) redirect("/");

  return (
    <main className="min-h-screen">
      <Header name={session.name} role={session.role} />
      <div className="max-w-6xl mx-auto px-4 py-8">
        {session.role === "STUDENT" && <StudentHub userId={session.id} />}
        {session.role === "ADMIN" && <AdminBoard />}
        {session.role === "STAFF" && <StaffView staffId={session.id} />}
      </div>
    </main>
  );
}

function Header({ name, role }: { name: string; role: string }) {
  return (
    <header className="bg-white border-b sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="text-brand-600" size={22} />
          <span className="font-semibold">Smart Campus System</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-600">
            {name} · <span className="font-medium">{role}</span>
          </span>
          <form action={logout}>
            <button className="flex items-center gap-1 text-gray-500 hover:text-red-600">
              <LogOut size={16} /> Logout
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_STYLES[status] || "bg-gray-100 text-gray-600"}`}>{status}</span>;
}

// ---------------------------------------------------------------------------
// STUDENT HUB
// ---------------------------------------------------------------------------
async function StudentHub({ userId }: { userId: string }) {
  const issues = await prisma.issue.findMany({
    where: { reportedById: userId },
    orderBy: { createdAt: "desc" },
    include: { assignedTo: true },
  });

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="card h-fit">
        <h2 className="font-semibold flex items-center gap-2 mb-4">
          <PlusCircle size={18} className="text-brand-600" /> Report an Issue
        </h2>
        <form action={createIssue} className="space-y-3">
          <input name="title" className="input" placeholder="Issue title" required />
          <textarea name="description" className="input" placeholder="Describe the issue" rows={3} required />
          <input name="location" className="input" placeholder="Location (e.g. Block A, Room 101)" />
          <input name="imageUrl" className="input" placeholder="Image URL (optional)" />
          <button className="btn-primary w-full">Submit Issue</button>
        </form>
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <ClipboardList size={18} className="text-brand-600" /> My Reported Issues
        </h2>
        {issues.length === 0 && <p className="text-sm text-gray-500">No issues reported yet.</p>}
        {issues.map((issue) => (
          <div key={issue.id} className="card">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium">{issue.title}</h3>
              <StatusBadge status={issue.status} />
            </div>
            <p className="text-sm text-gray-600 mt-1">{issue.description}</p>
            {issue.location && <p className="text-xs text-gray-400 mt-1">📍 {issue.location}</p>}
            {issue.assignedTo && (
              <p className="text-xs text-gray-500 mt-1">Assigned to {issue.assignedTo.name}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ADMIN BOARD
// ---------------------------------------------------------------------------
async function AdminBoard() {
  const [issues, staffMembers, resources] = await Promise.all([
    prisma.issue.findMany({ orderBy: { createdAt: "desc" }, include: { reportedBy: true, assignedTo: true } }),
    prisma.user.findMany({ where: { role: "STAFF" } }),
    prisma.resource.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-semibold flex items-center gap-2 mb-4">
          <ClipboardList size={18} className="text-brand-600" /> All Issues
        </h2>
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Reported By</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Assign to Staff</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => (
                <tr key={issue.id} className="border-t">
                  <td className="px-4 py-2 font-medium">{issue.title}</td>
                  <td className="px-4 py-2 text-gray-500">{issue.reportedBy.name}</td>
                  <td className="px-4 py-2"><StatusBadge status={issue.status} /></td>
                  <td className="px-4 py-2">
                    <form action={assignIssue} className="flex items-center gap-2">
                      <input type="hidden" name="issueId" value={issue.id} />
                      <select name="staffId" defaultValue={issue.assignedToId ?? ""} className="input py-1 text-xs">
                        <option value="" disabled>Select staff</option>
                        {staffMembers.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <button className="btn-primary py-1 px-2 text-xs">Assign</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-semibold flex items-center gap-2 mb-4">
          <Wrench size={18} className="text-brand-600" /> Manage Resources
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="card h-fit">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-1">
              <Package size={16} /> Add / Update Resource
            </h3>
            <form action={manageResource} className="space-y-2">
              <input name="id" className="input" placeholder="Resource ID (leave blank to create new)" />
              <input name="name" className="input" placeholder="Name" required />
              <input name="type" className="input" placeholder="Type (Electronics, Furniture...)" required />
              <input name="location" className="input" placeholder="Location" required />
              <input name="quantity" type="number" min={0} defaultValue={1} className="input" placeholder="Quantity" />
              <select name="condition" className="input" defaultValue="GOOD">
                <option value="GOOD">GOOD</option>
                <option value="FAIR">FAIR</option>
                <option value="DAMAGED">DAMAGED</option>
              </select>
              <button className="btn-primary w-full">Save Resource</button>
            </form>
          </div>

          <div className="md:col-span-2 card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-4 py-2">ID</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Location</th>
                  <th className="px-4 py-2">Qty</th>
                  <th className="px-4 py-2">Condition</th>
                </tr>
              </thead>
              <tbody>
                {resources.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2 text-xs text-gray-400">{r.id.slice(0, 8)}…</td>
                    <td className="px-4 py-2 font-medium">{r.name}</td>
                    <td className="px-4 py-2 text-gray-500">{r.type}</td>
                    <td className="px-4 py-2 text-gray-500">{r.location}</td>
                    <td className="px-4 py-2">{r.quantity}</td>
                    <td className="px-4 py-2">{r.condition}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// STAFF VIEW
// ---------------------------------------------------------------------------
async function StaffView({ staffId }: { staffId: string }) {
  const issues = await prisma.issue.findMany({
    where: { assignedToId: staffId, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
    orderBy: { createdAt: "asc" },
    include: { reportedBy: true },
  });

  return (
    <div className="space-y-4">
      <h2 className="font-semibold flex items-center gap-2">
        <Users size={18} className="text-brand-600" /> My Assigned Issues
      </h2>
      {issues.length === 0 && <p className="text-sm text-gray-500">No issues currently assigned to you.</p>}
      {issues.map((issue) => (
        <div key={issue.id} className="card">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-medium">{issue.title}</h3>
              <p className="text-sm text-gray-600 mt-1">{issue.description}</p>
              {issue.location && <p className="text-xs text-gray-400 mt-1">📍 {issue.location}</p>}
              <p className="text-xs text-gray-400 mt-1">Reported by {issue.reportedBy.name}</p>
            </div>
            <StatusBadge status={issue.status} />
          </div>
          <form action={resolveIssue} className="flex items-center gap-2 mt-3 border-t pt-3">
            <input type="hidden" name="issueId" value={issue.id} />
            <input name="comment" className="input" placeholder="Add a work comment (optional)" />
            <button className="btn-primary shrink-0 flex items-center gap-1">
              <CheckCircle2 size={16} /> Resolve
            </button>
          </form>
        </div>
      ))}
    </div>
  );
}
