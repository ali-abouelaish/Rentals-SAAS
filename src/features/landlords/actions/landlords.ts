"use server";

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole, requireUserProfile } from "@/lib/auth/requireRole";
import { ADMIN_ROLES } from "@/lib/auth/roles";

const execFileAsync = promisify(execFile);

// Same lock file the daily cron scrape uses (see crontab), so an on-demand
// run and the scheduled all-landlords run can never execute concurrently.
const SCRAPER_LOCK_FILE = "/tmp/harborops_scraper.lock";
const SCRAPER_TIMEOUT_MS = 120_000;

function parseLandlordFormData(formData: FormData) {
  const paysCommission = String(formData.get("pays_commission") ?? "yes") === "yes";
  const weDoViewing = String(formData.get("we_do_viewing") ?? "yes") === "yes";
  const amountRaw = String(formData.get("commission_amount_gbp") ?? "");
  const amountValue = Number(amountRaw);
  const commissionAmount = Number.isFinite(amountValue) ? amountValue : 0;
  return {
    name: String(formData.get("name") ?? "").trim(),
    contact: String(formData.get("contact") ?? "").trim() || null,
    billing_address: String(formData.get("billing_address") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    spareroom_profile_url: String(formData.get("spareroom_profile_url") ?? "").trim() || null,
    pays_commission: paysCommission,
    commission_amount_gbp: paysCommission ? commissionAmount : 0,
    commission_term_text: String(formData.get("commission_term_text") ?? "").trim() || null,
    we_do_viewing: weDoViewing,
    profile_notes: String(formData.get("profile_notes") ?? "").trim() || null,
  };
}

export async function createLandlord(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const profile = await requireUserProfile();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required.");

  const payload = parseLandlordFormData(formData);
  const { data, error } = await supabase
    .from("landlords")
    .insert({
      tenant_id: profile.tenant_id,
      name: payload.name,
      contact: payload.contact,
      billing_address: payload.billing_address,
      email: payload.email,
      spareroom_profile_url: payload.spareroom_profile_url,
      pays_commission: payload.pays_commission,
      commission_amount_gbp: payload.commission_amount_gbp,
      commission_term_text: payload.commission_term_text,
      we_do_viewing: payload.we_do_viewing,
      profile_notes: payload.profile_notes,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/landlords");
  redirect(`/landlords/${data.id}`);
}

export async function deleteLandlord(formData: FormData) {
  const supabase = createSupabaseServerClient();
  await requireRole([...ADMIN_ROLES]);
  const landlordId = String(formData.get("landlord_id") ?? "");
  if (!landlordId) throw new Error("Missing landlord id.");

  const { error } = await supabase
    .from("landlords")
    .delete()
    .eq("id", landlordId);
  if (error) throw new Error(error.message);

  revalidatePath("/landlords");
  redirect("/landlords");
}

export async function updateLandlord(formData: FormData) {
  const supabase = createSupabaseServerClient();
  await requireUserProfile();
  const landlordId = String(formData.get("landlord_id") ?? "");
  if (!landlordId) throw new Error("Missing landlord id.");

  const payload = parseLandlordFormData(formData);

  const { error } = await supabase
    .from("landlords")
    .update({
      name: payload.name,
      contact: payload.contact,
      billing_address: payload.billing_address,
      email: payload.email,
      spareroom_profile_url: payload.spareroom_profile_url,
      pays_commission: payload.pays_commission,
      commission_amount_gbp: payload.commission_amount_gbp,
      commission_term_text: payload.commission_term_text,
      we_do_viewing: payload.we_do_viewing,
      profile_notes: payload.profile_notes,
    })
    .eq("id", landlordId);
  if (error) throw new Error(error.message);

  revalidatePath(`/landlords/${landlordId}`);
  revalidatePath("/landlords");
}

export async function runLandlordScraper(landlordId: string) {
  const profile = await requireRole([...ADMIN_ROLES]);
  const supabase = createSupabaseServerClient();

  const { data: landlord, error } = await supabase
    .from("landlords")
    .select("id, name, spareroom_profile_url")
    .eq("id", landlordId)
    .single();
  if (error) throw new Error(error.message);
  if (!landlord.spareroom_profile_url) {
    throw new Error("This landlord has no SpareRoom profile URL set.");
  }

  const pythonBin = path.join(process.cwd(), "venv", "bin", "python");
  const scriptPath = path.join(process.cwd(), "scripts", "OGSCRPAPER.py");

  try {
    const { stdout } = await execFileAsync(
      "flock",
      ["-n", SCRAPER_LOCK_FILE, pythonBin, scriptPath],
      {
        cwd: process.cwd(),
        env: { ...process.env, TENANT_ID: profile.tenant_id, LANDLORD_ID: landlordId },
        timeout: SCRAPER_TIMEOUT_MS,
        maxBuffer: 10 * 1024 * 1024,
      }
    );

    const match = stdout.match(/Successfully posted (\d+) listings/);
    const count = match ? Number(match[1]) : 0;

    revalidatePath(`/landlords/${landlordId}`);
    return {
      count,
      message: `Scraped ${count} listing${count === 1 ? "" : "s"} for ${landlord.name}.`,
    };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string };
    const stdout = (e?.stdout ?? "").trim();
    const stderr = (e?.stderr ?? "").trim();
    if (!stdout && !stderr) {
      throw new Error(
        "The scraper is already running (likely the scheduled daily run) — try again in a few minutes."
      );
    }
    const lastLine = (stderr || stdout).split("\n").filter(Boolean).pop();
    throw new Error(lastLine || "Scraper run failed.");
  }
}
