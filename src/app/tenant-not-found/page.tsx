import "@/features/site/styles/not-found.css";
import { getPortalDomain } from "@/lib/tenant-host";
import { Arrow } from "@/features/site/ui/icons";
import { NotFoundPanel } from "@/features/site/ui/NotFoundPanel";

export const metadata = {
  title: "Workspace not found",
  robots: { index: false, follow: false },
};

/** Where middleware sends a subdomain that isn't anyone's workspace (a typo, or a closed agency). */
export default function TenantNotFoundPage() {
  const portal = getPortalDomain();
  const apex = portal ? `https://${portal}/` : "/";

  return (
    <NotFoundPanel
      title="We can’t find that workspace."
      message="Check the address for typos, or ask your administrator for your workspace link. The workspace may also have closed."
    >
      <a className="go" href={apex}>
        Go to Harbor
        <Arrow />
      </a>
    </NotFoundPanel>
  );
}
