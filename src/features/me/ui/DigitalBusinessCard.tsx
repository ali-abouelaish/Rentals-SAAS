"use client";

import { motion } from "framer-motion";
import { Phone, Mail, Globe, MessageCircle } from "lucide-react";
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
  const hasSocial = data.facebookUrl || data.instagramUrl || data.linkedinUrl;

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
              {data.phone && (
                <a
                  href={`https://wa.me/${data.phone.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center gap-4 rounded-2xl px-6 py-4 text-base font-semibold text-white transition-all hover:bg-white/20 active:scale-[0.98]"
                  style={{
                    background: "rgba(255,255,255,0.12)",
                    border: "1px solid rgba(255,255,255,0.25)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <MessageCircle className="h-5 w-5 shrink-0 text-white/80" />
                  <span className="flex-1 text-center tracking-wide">WhatsApp</span>
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
