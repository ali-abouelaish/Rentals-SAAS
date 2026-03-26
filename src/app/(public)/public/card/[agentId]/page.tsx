import { getPublicCardData } from "@/features/me/data/publicCard";
import { DigitalBusinessCard } from "@/features/me/ui/DigitalBusinessCard";

export default async function PublicCardPage({
  params,
}: {
  params: { agentId: string };
}) {
  const data = await getPublicCardData(params.agentId);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-6">
        <p className="text-sm text-slate-400">This business card is not available.</p>
      </div>
    );
  }

  const enquiryUrl = `/public/card-enquiry/${params.agentId}`;

  return <DigitalBusinessCard data={data} enquiryUrl={enquiryUrl} />;
}
