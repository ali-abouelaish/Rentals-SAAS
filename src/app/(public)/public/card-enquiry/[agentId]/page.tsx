import { getPublicCardData } from "@/features/me/data/publicCard";
import { CardEnquiryForm } from "@/features/leads/ui/CardEnquiryForm";

export default async function CardEnquiryPage({
  params,
}: {
  params: { agentId: string };
}) {
  const data = await getPublicCardData(params.agentId);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-6">
        <p className="text-sm text-slate-400">This page is not available.</p>
      </div>
    );
  }

  const primary   = data.branding.primaryColor  ?? "#2a5a7a";
  const secondary = data.branding.secondaryColor ?? "#6BB0D0";

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden p-5">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center scale-105"
        style={{ backgroundImage: "url(/card-bg.jpg)" }}
      />
      {data.avatarUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center scale-110 opacity-30"
          style={{ backgroundImage: `url(${data.avatarUrl})`, filter: "blur(24px) saturate(1.3)" }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/25 to-black/55" />

      {/* Glass card */}
      <div
        className="relative z-10 w-full"
        style={{ maxWidth: "27rem" }}
      >
        <div
          className="relative overflow-hidden"
          style={{
            borderRadius: "20px",
            background: "rgba(255, 255, 255, 0.1)",
            backdropFilter: "blur(17px)",
            WebkitBackdropFilter: "blur(17px)",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            boxShadow: [
              "0 8px 32px rgba(0, 0, 0, 0.1)",
              "inset 0 1px 0 rgba(255, 255, 255, 0.5)",
              "inset 0 -1px 0 rgba(255, 255, 255, 0.1)",
              "inset 0 0 10px 3px rgba(255, 255, 255, 0.5)",
            ].join(", "),
          }}
        >
          {/* Edge shimmers */}
          <div
            className="absolute top-0 left-0 right-0 h-px z-10 pointer-events-none"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)" }}
          />
          <div
            className="absolute top-0 left-0 w-px h-full z-10 pointer-events-none"
            style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.8), transparent, rgba(255,255,255,0.3))" }}
          />
          {/* Brand accent */}
          <div
            className="absolute top-0 left-0 right-0 h-[2px] z-20 pointer-events-none"
            style={{ background: `linear-gradient(90deg, transparent, ${secondary}cc, ${primary}, ${secondary}cc, transparent)` }}
          />

          <CardEnquiryForm
            agentId={data.agentId}
            tenantId={data.tenantId}
            agentName={data.displayName}
            agentAvatarUrl={data.avatarUrl}
            brandName={data.branding.brandName}
            brandLogoUrl={data.branding.logoUrl}
          />
        </div>
      </div>
    </main>
  );
}
