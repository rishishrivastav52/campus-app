import Link from "next/link";
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
  PlayCircle,
  AlertTriangle,
  Clock,
  Loader,
  MessageSquare,
} from "lucide-react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  createIssue,
  assignIssue,
  resolveIssue,
  manageResource,
  startWork,
  requestResource,
  reviewResourceRequest,
  requestReturn,
  confirmReturn,
  removeStaff,
  closeIssue,
  cancelResourceRequest,
  logout,
} from "@/app/actions";
import { UserX, XCircle } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  ASSIGNED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-purple-100 text-purple-700",
  RESOLVED: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-200 text-gray-600",
};

const ALL_STATUSES = ["PENDING", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"];

const REQ_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  RETURN_REQUESTED: "bg-blue-100 text-blue-700",
  RETURNED: "bg-gray-200 text-gray-600",
};
function ReqBadge({ status }: { status: string }) {
  return <span className={`badge ${REQ_STYLES[status] || "bg-gray-100 text-gray-600"}`}>{status.replace("_", " ")}</span>;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const session = getSession();
  if (!session) redirect("/");

  const statusFilter = ALL_STATUSES.includes(String(searchParams.status)) ? searchParams.status! : undefined;

  return (
    <main className="min-h-screen">
      <Header name={session.name} role={session.role} />
      <div className="max-w-6xl mx-auto px-4 py-8">
        {session.role === "STUDENT" && <StudentHub userId={session.id} statusFilter={statusFilter} />}
        {session.role === "ADMIN" && <AdminBoard statusFilter={statusFilter} />}
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

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="card flex items-center gap-3 py-4">
      <div className={`rounded-lg p-2 ${tone}`}>{icon}</div>
      <div>
        <p className="text-xl font-semibold leading-none">{value}</p>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  );
}

function StatusFilterBar({ current }: { current?: string }) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <Link
        href="/dashboard"
        className={`badge border ${!current ? "bg-brand-600 text-white border-brand-600" : "bg-white text-gray-600 border-gray-300"}`}
      >
        All
      </Link>
      {ALL_STATUSES.map((s) => (
        <Link
          key={s}
          href={`/dashboard?status=${s}`}
          className={`badge border ${current === s ? "bg-brand-600 text-white border-brand-600" : "bg-white text-gray-600 border-gray-300"}`}
        >
          {s}
        </Link>
      ))}
    </div>
  );
}

function CommentTrail({ comments }: { comments: { id: string; text: string; createdAt: Date; user: { name: string } }[] }) {
  if (comments.length === 0) return null;
  return (
    <div className="mt-3 border-t pt-3 space-y-2">
      <p className="text-xs font-medium text-gray-500 flex items-center gap-1">
        <MessageSquare size={13} /> Work log
      </p>
      {comments.map((c) => (
        <div key={c.id} className="text-xs bg-gray-50 rounded-md px-2.5 py-1.5">
          <span className="font-medium text-gray-700">{c.user.name}:</span>{" "}
          <span className="text-gray-600">{c.text}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// STUDENT HUB
// ---------------------------------------------------------------------------
async function StudentHub({ userId, statusFilter }: { userId: string; statusFilter?: string }) {
  const [issues, resources, myRequests] = await Promise.all([
    prisma.issue.findMany({
      where: { reportedById: userId, ...(statusFilter ? { status: statusFilter as any } : {}) },
      orderBy: { createdAt: "desc" },
      include: { assignedTo: true, comments: { include: { user: true }, orderBy: { createdAt: "asc" } } },
    }),
    prisma.resource.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.resourceRequest.findMany({
      where: { studentId: userId },
      orderBy: { createdAt: "desc" },
      include: { resource: true },
    }),
  ]);

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
        <StatusFilterBar current={statusFilter} />
        {issues.length === 0 && <p className="text-sm text-gray-500">No issues found for this filter.</p>}
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
            <CommentTrail comments={issue.comments} />
          </div>
        ))}
      </div>

      <div className="card h-fit">
        <h2 className="font-semibold flex items-center gap-2 mb-4">
          <Package size={18} className="text-brand-600" /> Request a Resource
        </h2>
        <form action={requestResource} className="space-y-2 mb-4">
          <select name="resourceId" className="input">
            <option value="">— or pick from stock —</option>
            {resources.map((r) => (
              <option key={r.id} value={r.id}>{r.name} ({r.quantity} available)</option>
            ))}
          </select>
          <input name="customName" className="input" placeholder="Not in stock? Type the item name instead" />
          <div className="flex items-center gap-2">
            <input name="quantity" type="number" min={1} defaultValue={1} className="input w-20" />
            <button className="btn-primary shrink-0">Request</button>
          </div>
        </form>

        <h3 className="text-sm font-semibold text-gray-600 mb-2">My Requests</h3>
        {myRequests.length === 0 && <p className="text-sm text-gray-500">No resource requests yet.</p>}
        <div className="space-y-2">
          {myRequests.map((req) => (
            <div key={req.id} className="border rounded-lg px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {req.resource?.name || `${req.customName} (not in stock)`} × {req.quantity}
                </span>
                <ReqBadge status={req.status} />
              </div>
              {req.status === "PENDING" && (
                <form action={cancelResourceRequest} className="mt-2">
                  <input type="hidden" name="requestId" value={req.id} />
                  <button className="text-xs text-red-600 flex items-center gap-1">
                    <XCircle size={13} /> Cancel request
                  </button>
                </form>
              )}
              {req.status === "APPROVED" && (
                <>
                  <p className="text-xs text-gray-500 mt-1">📍 Pick up at: {req.resource?.location ?? "Contact admin"}</p>
                  <form action={requestReturn} className="mt-2">
                    <input type="hidden" name="requestId" value={req.id} />
                    <button className="btn-primary py-1 px-2 text-xs">I've returned this</button>
                  </form>
                </>
              )}
              {req.status === "RETURN_REQUESTED" && (
                <p className="text-xs text-gray-400 mt-1">Waiting for admin to confirm your return.</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ADMIN BOARD
// ---------------------------------------------------------------------------
async function AdminBoard({ statusFilter }: { statusFilter?: string }) {
  const [issues, staffMembers, resources, counts, resourceRequests] = await Promise.all([
    prisma.issue.findMany({
      where: statusFilter ? { status: statusFilter as any } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        reportedBy: true,
        assignedTo: true,
        comments: { include: { user: true }, orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.user.findMany({ where: { role: "STAFF" } }),
    prisma.resource.findMany({ orderBy: { createdAt: "desc" } }),
    Promise.all(
      ALL_STATUSES.map((s) => prisma.issue.count({ where: { status: s as any } }))
    ),
    prisma.resourceRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: { student: true, resource: true },
    }),
  ]);

  const [pending, assigned, inProgress, resolved, closed] = counts;

  return (
    <div className="space-y-8">
      <section>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard label="Pending" value={pending} icon={<AlertTriangle size={18} className="text-amber-600" />} tone="bg-amber-50" />
          <StatCard label="Assigned" value={assigned} icon={<Clock size={18} className="text-blue-600" />} tone="bg-blue-50" />
          <StatCard label="In Progress" value={inProgress} icon={<Loader size={18} className="text-purple-600" />} tone="bg-purple-50" />
          <StatCard label="Resolved" value={resolved} icon={<CheckCircle2 size={18} className="text-green-600" />} tone="bg-green-50" />
          <StatCard label="Closed" value={closed} icon={<ClipboardList size={18} className="text-gray-600" />} tone="bg-gray-100" />
        </div>

        <h2 className="font-semibold flex items-center gap-2 mb-3">
          <ClipboardList size={18} className="text-brand-600" /> All Issues
        </h2>
        <StatusFilterBar current={statusFilter} />
        <div className="space-y-3">
          {issues.length === 0 && <p className="text-sm text-gray-500">No issues found for this filter.</p>}
          {issues.map((issue) => (
            <div key={issue.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium">{issue.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Reported by {issue.reportedBy.name}</p>
                </div>
                <StatusBadge status={issue.status} />
              </div>
              <p className="text-sm text-gray-600 mt-2">{issue.description}</p>
              <div className="flex flex-wrap items-center gap-2 mt-3 border-t pt-3">
                <form action={assignIssue} className="flex items-center gap-2">
                  <input type="hidden" name="issueId" value={issue.id} />
                  <select name="staffId" defaultValue={issue.assignedToId ?? ""} className="input py-1 text-xs w-auto">
                    <option value="" disabled>Select staff</option>
                    {staffMembers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <button className="btn-primary py-1 px-3 text-xs">Assign</button>
                </form>
                {issue.status === "RESOLVED" && (
                  <form action={closeIssue}>
                    <input type="hidden" name="issueId" value={issue.id} />
                    <button className="py-1 px-3 text-xs rounded-lg border border-gray-300 text-gray-600">Close Issue</button>
                  </form>
                )}
              </div>
              <CommentTrail comments={issue.comments} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-semibold flex items-center gap-2 mb-4">
          <Users size={18} className="text-brand-600" /> Staff Accounts
        </h2>
        <div className="card">
          {staffMembers.length === 0 && <p className="text-sm text-gray-500">No staff accounts yet.</p>}
          <div className="space-y-2">
            {staffMembers.map((s) => (
              <div key={s.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-gray-500">{s.email}</p>
                </div>
                <form action={removeStaff}>
                  <input type="hidden" name="staffId" value={s.id} />
                  <button className="text-xs text-red-600 flex items-center gap-1">
                    <UserX size={14} /> Remove
                  </button>
                </form>
              </div>
            ))}
          </div>
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
                    <td className="px-4 py-2">
                      <span className={r.quantity < 5 ? "text-red-600 font-semibold" : ""}>{r.quantity}</span>
                      {r.quantity < 5 && (
                        <span className="badge bg-red-100 text-red-700 ml-2 py-0.5 px-1.5">Low stock</span>
                      )}
                    </td>
                    <td className="px-4 py-2">{r.condition}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-x-auto p-0 mt-6">
          <h3 className="text-sm font-semibold px-4 pt-4 pb-2 flex items-center gap-1">
            <Users size={16} /> Resource Requests
          </h3>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2">Student ID</th>
                <th className="px-4 py-2">Student</th>
                <th className="px-4 py-2">Resource</th>
                <th className="px-4 py-2">Qty</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {resourceRequests.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-3 text-gray-500">No resource requests yet.</td></tr>
              )}
              {resourceRequests.map((req) => (
                <tr key={req.id} className="border-t">
                  <td className="px-4 py-2 text-xs text-gray-400">{req.studentId.slice(0, 8)}…</td>
                  <td className="px-4 py-2">{req.student.name}</td>
                  <td className="px-4 py-2">{req.resource?.name || `${req.customName} (not in stock)`}</td>
                  <td className="px-4 py-2">{req.quantity}</td>
                  <td className="px-4 py-2"><ReqBadge status={req.status} /></td>
                  <td className="px-4 py-2">
                    {req.status === "PENDING" && (
                      <form action={reviewResourceRequest} className="flex gap-1">
                        <input type="hidden" name="requestId" value={req.id} />
                        <button name="decision" value="APPROVED" className="btn-primary py-1 px-2 text-xs">Approve</button>
                        <button name="decision" value="REJECTED" className="py-1 px-2 text-xs rounded-lg border border-red-300 text-red-600">Reject</button>
                      </form>
                    )}
                    {req.status === "RETURN_REQUESTED" && (
                      <form action={confirmReturn}>
                        <input type="hidden" name="requestId" value={req.id} />
                        <button className="btn-primary py-1 px-2 text-xs">Confirm Return</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    include: { reportedBy: true, comments: { include: { user: true }, orderBy: { createdAt: "asc" } } },
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

          {issue.status === "ASSIGNED" && (
            <form action={startWork} className="mt-3 border-t pt-3">
              <input type="hidden" name="issueId" value={issue.id} />
              <button className="btn-primary flex items-center gap-1">
                <PlayCircle size={16} /> Start Work
              </button>
            </form>
          )}

          {issue.status === "IN_PROGRESS" && (
            <form action={resolveIssue} className="flex items-center gap-2 mt-3 border-t pt-3">
              <input type="hidden" name="issueId" value={issue.id} />
              <input name="comment" className="input" placeholder="Add a work comment (optional)" />
              <button className="btn-primary shrink-0 flex items-center gap-1">
                <CheckCircle2 size={16} /> Resolve
              </button>
            </form>
          )}

          <CommentTrail comments={issue.comments} />
        </div>
      ))}
    </div>
  );
}
