export function InvalidLink() {
  return (
    <main className="min-h-screen bg-[#f4f4f7] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900 mb-3">This link is no longer valid</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          Your preferences link has expired or was changed. Please contact your letting agent and
          they can send you a fresh link.
        </p>
      </div>
    </main>
  );
}
