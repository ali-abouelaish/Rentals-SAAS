import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="text-center">
        <p className="text-sm font-medium text-navy">{title}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </CardContent>
    </Card>
  );
}
