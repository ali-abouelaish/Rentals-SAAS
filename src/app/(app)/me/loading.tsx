export default function MeLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="rounded-bento bg-surface-card shadow-bento h-28" />
      <div className="rounded-bento bg-surface-card shadow-bento h-14" />
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 w-20 rounded-lg bg-surface-inset" />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="rounded-bento bg-surface-card shadow-bento h-24" />
        ))}
      </div>
      <div className="rounded-bento bg-surface-card shadow-bento h-64" />
      <div className="rounded-bento bg-surface-card shadow-bento h-48" />
    </div>
  );
}
