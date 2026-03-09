export default function AppLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-48 rounded-lg bg-surface-inset" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-32 rounded-xl bg-surface-inset" />
        <div className="h-32 rounded-xl bg-surface-inset" />
      </div>
      <div className="h-64 rounded-xl bg-surface-inset" />
    </div>
  );
}
