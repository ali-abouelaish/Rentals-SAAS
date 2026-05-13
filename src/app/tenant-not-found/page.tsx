import Link from "next/link";

export const metadata = {
  title: "Workspace not found — Harbor Ops",
  robots: { index: false, follow: false },
};

export default function TenantNotFoundPage() {
  const apex = process.env.APP_PORTAL_DOMAIN
    ? `https://${process.env.APP_PORTAL_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "")}`
    : "/";

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-6 py-16">
      <div className="max-w-md w-full text-center">
        <p className="text-7xl font-bold tracking-tight text-slate-300">404</p>
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">
          Workspace not found
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          We couldn&apos;t find a Harbor Ops workspace at this address. The
          subdomain may be misspelled, or the workspace may no longer exist.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Check the URL for typos, or ask your administrator for the correct
          workspace link.
        </p>
        <Link
          href={apex}
          className="mt-8 inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
        >
          Go to Harbor Ops →
        </Link>
      </div>
    </main>
  );
}
