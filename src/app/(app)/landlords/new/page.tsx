import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { CreateLandlordForm } from "@/features/landlords/ui/CreateLandlordForm";

export default function NewLandlordPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="New landlord" subtitle="Add a landlord or partner" />
      <Card>
        <CardContent className="pt-6">
          <CreateLandlordForm />
        </CardContent>
      </Card>
    </div>
  );
}
