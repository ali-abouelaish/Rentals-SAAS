"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { saveTenantBrandingAction, uploadTenantLogoAction } from "../actions/admin";
import type { TenantBrandingSettings } from "../domain/types";

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const hex = value.startsWith("#") ? value : "#" + value;
  const safeHex = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : "#0B2F59";
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={safeHex}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-border p-0.5 bg-surface-inset"
          aria-label={`${label} color picker`}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#0B2F59"
          className="font-mono text-sm"
        />
      </div>
    </div>
  );
}

export function TenantBrandingForm({
  tenantId,
  initial,
  tenantName
}: {
  tenantId: string;
  tenantName: string;
  initial: TenantBrandingSettings | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [brandName, setBrandName] = useState(initial?.brand_name ?? tenantName);
  const [logoUrl, setLogoUrl] = useState(initial?.logo_url ?? "");
  const [primaryColor, setPrimaryColor] = useState(initial?.primary_color ?? "#0B2F59");
  const [secondaryColor, setSecondaryColor] = useState(initial?.secondary_color ?? "#6BB0D0");
  const [accentColor, setAccentColor] = useState(initial?.accent_color ?? "#4FD1FF");
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">(initial?.theme_mode ?? "light");
  const [fontFamily, setFontFamily] = useState(initial?.font_family ?? "");

  const previewStyle = useMemo(
    () => ({
      background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
      borderColor: accentColor
    }),
    [primaryColor, secondaryColor, accentColor]
  );

  const onSave = () => {
    startTransition(async () => {
      const result = await saveTenantBrandingAction({
        tenantId,
        brandName,
        logoUrl,
        primaryColor,
        secondaryColor,
        accentColor,
        themeMode,
        fontFamily
      });
      if (!result.ok) {
        toast.error("Unable to save branding", { description: result.error });
        return;
      }
      toast.success("Branding saved");
      router.refresh();
    });
  };

  const onLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadTenantLogoAction(tenantId, formData);
    setUploadingLogo(false);
    if (result.ok && result.url) {
      setLogoUrl(result.url);
      toast.success("Logo uploaded");
      router.refresh();
    } else {
      toast.error(result.error ?? "Upload failed");
    }
    e.target.value = "";
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Brand Name</label>
            <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Tenant Logo</label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                onChange={onLogoUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingLogo}
                onClick={() => logoInputRef.current?.click()}
              >
                {uploadingLogo ? "Uploading…" : "Upload logo"}
              </Button>
              <span className="text-xs text-foreground-muted">or paste URL below</span>
            </div>
            <Input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://… or upload above"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ColorRow label="Primary" value={primaryColor} onChange={setPrimaryColor} />
            <ColorRow label="Secondary" value={secondaryColor} onChange={setSecondaryColor} />
            <ColorRow label="Accent" value={accentColor} onChange={setAccentColor} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Theme Mode"
              value={themeMode}
              onChange={(value: string) => setThemeMode(value as "light" | "dark" | "system")}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "System" }
              ]}
            />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Font (optional)</label>
              <Input
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                placeholder="Inter"
              />
            </div>
          </div>
          <Button onClick={onSave} disabled={isPending}>
            Save Branding
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <p className="text-sm font-medium text-foreground mb-3">Live Preview</p>
          <div
            className="rounded-xl border p-5 text-white shadow-lg min-h-[190px]"
            style={previewStyle}
          >
            <div className="flex items-center gap-3">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="Brand logo"
                  className="h-10 w-10 rounded-md bg-white/90 object-contain p-1"
                />
              ) : (
                <div className="h-10 w-10 rounded-md bg-white/20" />
              )}
              <div>
                <p
                  className="text-lg font-semibold"
                  style={fontFamily ? { fontFamily } : undefined}
                >
                  {brandName || tenantName}
                </p>
                <p className="text-xs text-white/80">Tenant Portal Preview</p>
              </div>
            </div>
            <div className="mt-6 rounded-lg bg-white/15 px-3 py-2 text-xs">
              Theme: {themeMode} | Accent: {accentColor}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

