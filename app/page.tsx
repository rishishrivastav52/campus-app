"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, LogIn, UserPlus, Loader2 } from "lucide-react";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("STUDENT");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const url = mode === "login" ? "/api/auth" : "/api/signup";
      const body = mode === "login" ? { email, password } : { name, email, password, role };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setLoading(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-6">
          <Building2 className="text-brand-600" size={28} />
          <h1 className="text-lg font-bold">Smart Campus System</h1>
        </div>

        <div className="flex rounded-lg border border-gray-300 overflow-hidden mb-4 text-sm">
          <button
            type="button"
            onClick={() => { setMode("login"); setError(""); }}
            className={`flex-1 py-2 font-medium ${mode === "login" ? "bg-brand-600 text-white" : "bg-white text-gray-600"}`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); setError(""); }}
            className={`flex-1 py-2 font-medium ${mode === "signup" ? "bg-brand-600 text-white" : "bg-white text-gray-600"}`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {mode === "signup" && (
            <div>
              <label className="text-sm font-medium text-gray-700">Full Name</label>
              <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-gray-700">Email</label>
            <input className="input mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Password</label>
            <input className="input mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {mode === "signup" && (
            <div>
              <label className="text-sm font-medium text-gray-700">I am a</label>
              <select className="input mt-1" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="STUDENT">Student</option>
                <option value="STAFF">Staff</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">Admin accounts are created by the college, not via signup.</p>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={16} /> : mode === "login" ? <LogIn size={16} /> : <UserPlus size={16} />}
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
          {mode === "login" && (
            <div className="text-xs text-gray-500 pt-2 border-t space-y-0.5">
              <p>Admin demo account (password: password123)</p>
              <p>admin@college.edu</p>
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
