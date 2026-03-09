"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AvatarCircle } from "@/components/shared/AvatarCircle";
import { updateMyProfile, uploadAvatar, requestPasswordReset } from "../actions/profile";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";

type MeProfileSettingsFormProps = {
  displayName: string;
  avatarUrl?: string | null;
};

export function MeProfileSettingsForm({ displayName: initialName, avatarUrl }: MeProfileSettingsFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialName ?? "");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData();
    formData.set("display_name", displayName.trim());
    const result = await updateMyProfile(formData);
    setSaving(false);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Profile updated.");
    router.refresh();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB.");
      return;
    }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      toast.error("Use JPEG, PNG, WebP or GIF.");
      return;
    }
    setAvatarPreview(URL.createObjectURL(file));
    const formData = new FormData();
    formData.set("avatar", file);
    setSaving(true);
    const result = await uploadAvatar(formData);
    setSaving(false);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Profile picture updated.");
    router.refresh();
  };

  const handleResetPassword = async () => {
    setResetting(true);
    const result = await requestPasswordReset();
    setResetting(false);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Check your email for the reset link.");
  };

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmitProfile} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="display_name" className="text-sm font-medium text-foreground">
            Display name
          </label>
          <Input
            id="display_name"
            name="display_name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="max-w-sm"
            required
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-border bg-surface-inset">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Preview" className="h-full w-full object-cover" />
            ) : (
              <AvatarCircle name={displayName || "You"} url={avatarUrl ?? undefined} size={80} />
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Profile picture</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => fileInputRef.current?.click()}
            >
              {saving ? "Uploading..." : "Upload photo"}
            </Button>
            <p className="text-xs text-foreground-muted">JPEG, PNG, WebP or GIF. Max 2MB.</p>
          </div>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save profile
        </Button>
      </form>

      <div className="pt-6 border-t border-border">
        <h4 className="text-sm font-medium text-foreground mb-2">Password</h4>
        <p className="text-sm text-foreground-muted mb-3">
          We&apos;ll send you an email with a link to reset your password.
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={resetting}
          onClick={handleResetPassword}
        >
          {resetting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
          Send reset link
        </Button>
      </div>
    </div>
  );
}
