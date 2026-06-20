"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AvatarCircle } from "@/components/shared/AvatarCircle";
import {
  updateMyProfile,
  uploadAvatar,
  requestPasswordReset,
  updateMyPhone,
  updateMySocialLinks,
} from "../actions/profile";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";

type MeProfileSettingsFormProps = {
  displayName: string;
  avatarUrl?: string | null;
  phone?: string | null;
  contactEmail?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
};

export function MeProfileSettingsForm({
  displayName: initialName,
  avatarUrl,
  phone: initialPhone,
  contactEmail: initialContactEmail,
  facebookUrl: initialFacebook,
  instagramUrl: initialInstagram,
  linkedinUrl: initialLinkedin,
}: MeProfileSettingsFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialName ?? "");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [contactEmail, setContactEmail] = useState(initialContactEmail ?? "");
  const [facebookUrl, setFacebookUrl] = useState(initialFacebook ?? "");
  const [instagramUrl, setInstagramUrl] = useState(initialInstagram ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(initialLinkedin ?? "");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData();
    formData.set("display_name", displayName.trim());
    formData.set("phone", phone.trim());
    formData.set("contact_email", contactEmail.trim());
    formData.set("facebook_url", facebookUrl.trim());
    formData.set("instagram_url", instagramUrl.trim());
    formData.set("linkedin_url", linkedinUrl.trim());

    const [nameResult, phoneResult, socialResult] = await Promise.all([
      updateMyProfile(formData),
      updateMyPhone(formData),
      updateMySocialLinks(formData),
    ]);
    setSaving(false);

    const err = nameResult?.error ?? phoneResult?.error ?? socialResult?.error;
    if (err) { toast.error(err); return; }
    toast.success("Profile updated.");
    router.refresh();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Image must be under 2MB."); return; }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) { toast.error("Use JPEG, PNG, WebP or GIF."); return; }
    setAvatarPreview(URL.createObjectURL(file));
    const formData = new FormData();
    formData.set("avatar", file);
    setSaving(true);
    const result = await uploadAvatar(formData);
    setSaving(false);
    if (result?.error) { toast.error(result.error); return; }
    toast.success("Profile picture updated.");
    router.refresh();
  };

  const handleResetPassword = async () => {
    setResetting(true);
    const result = await requestPasswordReset();
    setResetting(false);
    if (result?.error) {
      const msg = result.error.toLowerCase().includes("rate limit")
        ? "Too many requests — please wait a few minutes before trying again."
        : result.error;
      toast.error(msg);
      return;
    }
    toast.success("Check your email for the reset link.");
  };

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmitProfile} className="space-y-6">
        {/* Basic info */}
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

        {/* Profile picture */}
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

        {/* Contact info */}
        <div className="pt-2 border-t border-border space-y-4">
          <p className="text-sm font-medium text-foreground">Contact details</p>
          <p className="text-xs text-foreground-muted -mt-2">Shown on your public business card.</p>
          <div className="space-y-2">
            <label htmlFor="phone" className="text-sm font-medium text-foreground">
              Phone number
            </label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+44 7700 900000"
              className="max-w-sm"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="contact_email" className="text-sm font-medium text-foreground">
              Public email
            </label>
            <Input
              id="contact_email"
              name="contact_email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="you@example.com"
              className="max-w-sm"
            />
          </div>
        </div>

        {/* Social links */}
        <div className="pt-2 border-t border-border space-y-4">
          <p className="text-sm font-medium text-foreground">Social links</p>
          <p className="text-xs text-foreground-muted -mt-2">Optional. Displayed as icons on your business card.</p>
          <div className="space-y-2">
            <label htmlFor="facebook_url" className="text-sm font-medium text-foreground">
              Facebook URL
            </label>
            <Input
              id="facebook_url"
              name="facebook_url"
              type="url"
              value={facebookUrl}
              onChange={(e) => setFacebookUrl(e.target.value)}
              placeholder="https://facebook.com/yourpage"
              className="max-w-sm"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="instagram_url" className="text-sm font-medium text-foreground">
              Instagram URL
            </label>
            <Input
              id="instagram_url"
              name="instagram_url"
              type="url"
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              placeholder="https://instagram.com/yourhandle"
              className="max-w-sm"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="linkedin_url" className="text-sm font-medium text-foreground">
              LinkedIn URL
            </label>
            <Input
              id="linkedin_url"
              name="linkedin_url"
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/yourprofile"
              className="max-w-sm"
            />
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
