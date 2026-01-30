import { Card, CardContent } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  helper
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
        <p className="text-2xl font-semibold text-navy">{value}</p>
        {helper ? <p className="text-xs text-gray-500">{helper}</p> : null}
      </CardContent>
    </Card>
  );
}
