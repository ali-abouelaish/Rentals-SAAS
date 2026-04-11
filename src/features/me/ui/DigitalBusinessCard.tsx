"use client";

import { motion } from "framer-motion";
import { Phone, Mail, Globe } from "lucide-react";
import type { PublicCardData } from "../domain/types";

interface DigitalBusinessCardProps {
  data: PublicCardData;
  enquiryUrl: string;
}

function getRoleLabel(role: string): string {
  switch (role.toLowerCase()) {
    case "agent_and_marketing": return "Agent";
    case "marketing_only": return "Marketing";
    case "admin": return "Admin";
    case "super_admin": return "Admin";
    default: return role.charAt(0).toUpperCase() + role.slice(1);
  }
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  );
}

function LinkedinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function handleDownloadVCard(data: PublicCardData) {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${data.displayName}`,
    `TITLE:${getRoleLabel(data.role)}`,
    data.phone ? `TEL;TYPE=CELL:${data.phone}` : null,
    data.contactEmail ? `EMAIL:${data.contactEmail}` : null,
    data.branding.brandName ? `ORG:${data.branding.brandName}` : null,
    data.facebookUrl ? `URL;TYPE=facebook:${data.facebookUrl}` : null,
    data.instagramUrl ? `URL;TYPE=instagram:${data.instagramUrl}` : null,
    data.linkedinUrl ? `URL;TYPE=linkedin:${data.linkedinUrl}` : null,
    `URL:${typeof window !== "undefined" ? window.location.href : ""}`,
    "END:VCARD",
  ]
    .filter(Boolean)
    .join("\r\n");

  const blob = new Blob([lines], { type: "text/vcard;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${data.displayName.replace(/\s+/g, "_")}.vcf`;
  a.click();
}

export function DigitalBusinessCard({ data, enquiryUrl }: DigitalBusinessCardProps) {
  const primary = data.branding.primaryColor ?? "#2a5a7a";
  const secondary = data.branding.secondaryColor ?? "#6BB0D0";
  const hasSocial = data.facebookUrl || data.instagramUrl || data.linkedinUrl || data.phone;

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden p-5">
      {/* ── Background — always use the property photo ── */}
      <div
        className="absolute inset-0 bg-cover bg-center scale-105"
        style={{ backgroundImage: "url(/card-bg.jpg)" }}
      />
      {/* Agent avatar blended on top if available */}
      {data.avatarUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center scale-110 opacity-30"
          style={{ backgroundImage: `url(${data.avatarUrl})`, filter: "blur(24px) saturate(1.3)" }}
        />
      )}
      {/* Vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/25 to-black/55" />

      {/* ── Glass card ── */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full"
        style={{ maxWidth: "27rem" }}
      >
        <div
          className="relative overflow-hidden"
          style={{
            borderRadius: "20px",
            background: "rgba(255, 255, 255, 0.1)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            boxShadow: [
              "0 8px 32px rgba(0, 0, 0, 0.1)",
              "inset 0 1px 0 rgba(255, 255, 255, 0.5)",
              "inset 0 -1px 0 rgba(255, 255, 255, 0.1)",
              "inset 0 0 10px 3px rgba(255, 255, 255, 0.5)",
            ].join(", "),
          }}
        >
          {/* ::before — top edge shimmer */}
          <div
            className="absolute top-0 left-0 right-0 h-px z-10 pointer-events-none"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)" }}
          />
          {/* ::after — left edge shimmer */}
          <div
            className="absolute top-0 left-0 w-px h-full z-10 pointer-events-none"
            style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.8), transparent, rgba(255,255,255,0.3))" }}
          />
          {/* Brand accent line */}
          <div
            className="absolute top-0 left-0 right-0 h-[2px] z-20 pointer-events-none"
            style={{ background: `linear-gradient(90deg, transparent, ${secondary}cc, ${primary}, ${secondary}cc, transparent)` }}
          />

          <div className="relative z-10 flex flex-col items-center px-9 pt-10 pb-10 text-center gap-0">

            {/* Company logo + brand name */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.45 }}
              className="flex flex-col items-center gap-2 mb-9"
            >
              {data.branding.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.branding.logoUrl}
                  alt={data.branding.brandName ?? ""}
                  className="h-20 w-auto object-contain drop-shadow-lg"
                />
              )}
              {data.branding.brandName && (
                <p className="text-white text-sm font-bold tracking-[0.22em] uppercase drop-shadow">
                  {data.branding.brandName}
                </p>
              )}
              <p className="text-white/60 text-[11px] tracking-[0.55em]">★ ★ ★ ★ ★</p>
            </motion.div>


            {/* Agent avatar */}
            {data.avatarUrl && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.18, duration: 0.4 }}
                className="mb-5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={data.avatarUrl}
                  alt={data.displayName}
                  className="h-20 w-20 rounded-full object-cover"
                  style={{
                    border: "2px solid rgba(255,255,255,0.5)",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
                  }}
                />
              </motion.div>
            )}

            {/* Agent name */}
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24, duration: 0.45 }}
              className="text-3xl sm:text-4xl font-bold uppercase tracking-[0.15em] text-white leading-tight mb-3"
            >
              {data.displayName}
            </motion.h1>

            {/* Role */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.28 }}
              className="text-white/85 text-base font-medium tracking-widest uppercase mb-7"
            >
              {getRoleLabel(data.role)}
            </motion.p>

            {/* Thin divider */}
            <div className="w-16 h-px mb-7" style={{ background: "rgba(255,255,255,0.3)" }} />

            {/* Social icons */}
            {hasSocial && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.34 }}
                className="flex items-center gap-4 mb-8"
              >
                {data.facebookUrl && (
                  <a
                    href={data.facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-12 w-12 items-center justify-center rounded-full text-white transition-all hover:scale-110 hover:bg-white/20"
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.15)",
                    }}
                  >
                    <FacebookIcon />
                  </a>
                )}
                {data.instagramUrl && (
                  <a
                    href={data.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-12 w-12 items-center justify-center rounded-full text-white transition-all hover:scale-110 hover:bg-white/20"
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.15)",
                    }}
                  >
                    <InstagramIcon />
                  </a>
                )}
                {data.linkedinUrl && (
                  <a
                    href={data.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-12 w-12 items-center justify-center rounded-full text-white transition-all hover:scale-110 hover:bg-white/20"
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.15)",
                    }}
                  >
                    <LinkedinIcon />
                  </a>
                )}
                {data.phone && (
                  <a
                    href={`https://wa.me/${data.phone.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-12 w-12 items-center justify-center rounded-full text-white transition-all hover:scale-110 hover:bg-white/20"
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.15)",
                    }}
                  >
                    <WhatsAppIcon />
                  </a>
                )}
              </motion.div>
            )}

            {/* Action buttons */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.38, duration: 0.45 }}
              className="flex flex-col w-full gap-3"
            >
              {data.phone && (
                <a
                  href={`tel:${data.phone}`}
                  className="flex w-full items-center gap-4 rounded-2xl px-6 py-4 text-base font-semibold text-white transition-all hover:bg-white/20 active:scale-[0.98]"
                  style={{
                    background: "rgba(255,255,255,0.12)",
                    border: "1px solid rgba(255,255,255,0.25)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <Phone className="h-5 w-5 shrink-0 text-white/80" />
                  <span className="flex-1 text-center tracking-wide">Phone</span>
                </a>
              )}
              {data.contactEmail && (
                <a
                  href={`mailto:${data.contactEmail}`}
                  className="flex w-full items-center gap-4 rounded-2xl px-6 py-4 text-base font-semibold text-white transition-all hover:bg-white/20 active:scale-[0.98]"
                  style={{
                    background: "rgba(255,255,255,0.12)",
                    border: "1px solid rgba(255,255,255,0.25)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <Mail className="h-5 w-5 shrink-0 text-white/80" />
                  <span className="flex-1 text-center tracking-wide">Email</span>
                </a>
              )}
              <a
                href={enquiryUrl}
                className="flex w-full items-center gap-4 rounded-2xl px-6 py-4 text-base font-semibold text-white transition-all hover:bg-white/20 active:scale-[0.98]"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.13)",
                }}
              >
                <Globe className="h-5 w-5 shrink-0 text-white/80" />
                <span className="flex-1 text-center tracking-wide">Send Enquiry</span>
              </a>

              <button
                onClick={() => handleDownloadVCard(data)}
                className="mt-2 text-xs font-medium text-white/55 hover:text-white/90 transition-colors tracking-widest uppercase"
              >
                + Save Contact
              </button>
            </motion.div>

          </div>
        </div>
      </motion.div>
    </main>
  );
}
