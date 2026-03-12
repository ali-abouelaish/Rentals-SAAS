import { Card, CardContent } from "@/components/ui/card";

export default function AdminLoading() {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-8">
          <div className="h-6 w-56 animate-pulse rounded bg-surface-inset" />
          <div className="mt-3 h-4 w-80 animate-pulse rounded bg-surface-inset" />
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Card key={idx}>
            <CardContent className="py-6">
              <div className="h-4 w-20 animate-pulse rounded bg-surface-inset" />
              <div className="mt-3 h-8 w-16 animate-pulse rounded bg-surface-inset" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

