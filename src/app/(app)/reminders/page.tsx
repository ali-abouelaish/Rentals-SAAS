import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireFeature } from "@/lib/entitlements/requireFeature";
import {
  getRemindersInbox,
  type ReminderTab,
} from "@/features/automations/data/queries";
import { MESSAGE_ENTITY_TYPES, type MessageEntityType } from "@/features/automations/domain/types";
import { AddReminderDialog } from "@/features/automations/ui/AddReminderDialog";
import { RemindersInbox } from "@/features/automations/ui/RemindersInbox";
import { ConnectMailboxNotice } from "@/features/email-providers/ui/ConnectMailboxNotice";

const TAB_KEYS: ReminderTab[] = ["pending", "queued", "sent", "failed", "dismissed"];

export default async function RemindersPage({
  searchParams,
}: {
  searchParams?: { tab?: string; entity?: string };
}) {
  const profile = await requireRole([...ADMIN_ROLES]);
  await requireFeature("automations");

  const tab: ReminderTab = TAB_KEYS.includes(searchParams?.tab as ReminderTab)
    ? (searchParams?.tab as ReminderTab)
    : "pending";
  const entityType = MESSAGE_ENTITY_TYPES.includes(
    searchParams?.entity as MessageEntityType
  )
    ? (searchParams?.entity as MessageEntityType)
    : undefined;

  const rows = await getRemindersInbox(profile.tenant_id, { tab, entityType });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Reminders</h1>
          <p className="text-xs text-foreground-secondary">
            Internal reminders for your team plus every scheduled email — pending, queued,
            sent, and failed, in one inbox.
          </p>
        </div>
        <AddReminderDialog />
      </div>

      <ConnectMailboxNotice tenantId={profile.tenant_id} />

      <RemindersInbox rows={rows} tab={tab} entityFilter={entityType} />
    </div>
  );
}
