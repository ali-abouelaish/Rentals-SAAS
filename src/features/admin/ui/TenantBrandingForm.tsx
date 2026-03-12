"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { saveTenantBrandingAction } from "../actions/admin";
import type { TenantBrandingSettings } from "../domain/types";

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

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Brand Name</label>
            <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Logo URL</label>
            <Input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Primary</label>
              <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Secondary</label>
              <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Accent</label>
              <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
            </div>
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

