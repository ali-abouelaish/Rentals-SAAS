import { Users2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { getTeamMembers, type TeamMemberStatus } from "@/features/team/data/team";
import { InviteTeamMemberDialog } from "@/features/team/ui/InviteTeamMemberDialog";
import { TeamMemberActions } from "@/features/team/ui/TeamMemberActions";

const STATUS_LABELS: Record<TeamMemberStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-success/15 text-success" },
  pending: { label: "Invite pending", className: "bg-amber-500/15 text-amber-600" },
  disabled: { label: "Deactivated", className: "bg-error/15 text-error" }
};

function roleLabel(role: string): string {
  if (!role) return "—";
  return role
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default async function TeamSettingsPage() {
  const profile = await requireRole([...ADMIN_ROLES]);
  const members = await getTeamMembers(profile.tenant_id);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Team"
        subtitle="Invite colleagues and manage who can access this account."
        action={<InviteTeamMemberDialog />}
      />

      <p className="text-sm text-foreground-secondary">
        Showing <span className="font-medium text-foreground">{members.length}</span>{" "}
        {members.length === 1 ? "member" : "members"}. Invited users receive an email to set their
        own password.
      </p>

      {members.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users2 className="mx-auto mb-3 h-12 w-12 text-foreground-muted" />
            <p className="text-foreground-secondary">No team members yet.</p>
            <p className="mt-1 text-sm text-foreground-muted">
              Use “Invite user” to add your first colleague.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const status = STATUS_LABELS[member.status];
                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium text-foreground">
                        {member.display_name}
                      </TableCell>
                      <TableCell>{member.email ?? "—"}</TableCell>
                      <TableCell>{roleLabel(member.role)}</TableCell>
                      <TableCell>
                        <Badge className={`border-transparent ${status.className}`}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <TeamMemberActions member={member} isSelf={member.id === profile.id} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
