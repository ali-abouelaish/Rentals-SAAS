import { Card, CardContent } from "@/components/ui/card";

export function EarningsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded-xl bg-muted" />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={`stat-${index}`}>
            <CardContent>
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="mt-3 h-6 w-20 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent>
          <div className="h-56 w-full rounded bg-muted" />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <div className="h-40 w-full rounded bg-muted" />
        </CardContent>
      </Card>
    </div>
  );
}
