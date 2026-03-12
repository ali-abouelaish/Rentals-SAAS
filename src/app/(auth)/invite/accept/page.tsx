"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function InviteAcceptPage() {
  const searchParams = useSearchParams();
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") || "invite";

  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    if (!token_hash) {
      window.location.href = "/auth/error?reason=missing_token";
      return;
    }

    setLoading(true);

    const res = await fetch("/api/invite/complete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token_hash, type }),
    });

    const data = await res.json();

    if (!res.ok) {
      window.location.href = data.redirectTo || "/auth/error?reason=invalid_or_expired";
      return;
    }

    window.location.href = data.redirectTo || "/invite/set-password";
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">
          You’ve been invited to HarborOps
        </h1>

        <p className="text-sm text-gray-600 mb-6">
          Click below to accept your invitation and continue setting up your account.
        </p>

        <button
          onClick={handleContinue}
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Processing..." : "Continue Invitation"}
        </button>
      </div>
    </div>
  );
}

