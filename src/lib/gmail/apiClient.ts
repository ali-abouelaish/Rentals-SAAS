import { google, gmail_v1 } from "googleapis";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { encryptToken, decryptToken } from "./encrypt";
import { getOAuthClient } from "./oauthClient";

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

export type GmailMessage = {
  messageId: string;
  from: string;
  subject: string;
  body: string;
};

async function getStoredConnection(tenantId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("tenant_gmail_connections")
    .select("access_token, refresh_token, token_expiry")
    .eq("tenant_id", tenantId)
    .single();

  if (error || !data) throw new Error(`No Gmail connection for tenant ${tenantId}`);
  return data;
}

export async function getGmailClientForTenant(tenantId: string): Promise<gmail_v1.Gmail> {
  const admin = createSupabaseAdminClient();
  const conn = await getStoredConnection(tenantId);

  const oauthClient = getOAuthClient();
  oauthClient.setCredentials({
    access_token: decryptToken(conn.access_token),
    refresh_token: decryptToken(conn.refresh_token),
  });

  const expiry = new Date(conn.token_expiry).getTime();
  const needsRefresh = expiry - Date.now() < TOKEN_REFRESH_BUFFER_MS;

  if (needsRefresh) {
    const { credentials } = await oauthClient.refreshAccessToken();
    const newAccessToken = credentials.access_token!;
    const newExpiry = new Date(credentials.expiry_date ?? Date.now() + 3600 * 1000);

    await admin
      .from("tenant_gmail_connections")
      .update({
        access_token: encryptToken(newAccessToken),
        token_expiry: newExpiry.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId);

    oauthClient.setCredentials({ access_token: newAccessToken });
  }

  return google.gmail({ version: "v1", auth: oauthClient });
}

export async function fetchMessagesByHistoryId(
  client: gmail_v1.Gmail,
  historyId: string
): Promise<string[]> {
  const messageIds: string[] = [];

  try {
    const res = await client.users.history.list({
      userId: "me",
      startHistoryId: historyId,
      historyTypes: ["messageAdded"],
    });

    const records = res.data.history ?? [];
    for (const record of records) {
      for (const msg of record.messagesAdded ?? []) {
        if (msg.message?.id) {
          messageIds.push(msg.message.id);
        }
      }
    }
  } catch {
    // historyId may be too old; caller should handle full sync fallback
  }

  return messageIds;
}

/**
 * Return the mailbox's current historyId. Used as a valid cursor for the push
 * webhook when a watch wasn't (or couldn't be) registered.
 */
export async function getMailboxHistoryId(client: gmail_v1.Gmail): Promise<string> {
  const res = await client.users.getProfile({ userId: "me" });
  return res.data.historyId ?? "";
}

/**
 * Scan the mailbox with a Gmail search query (e.g. `from:(rightmove.co.uk OR
 * zoopla.co.uk) newer_than:30d`) and return matching message ids. Unlike
 * `fetchMessagesByHistoryId` (which only reports incremental changes since a
 * historyId), this does an actual search, so it can pull existing mail — the
 * basis of a reliable manual "Sync now" that doesn't depend on push delivery.
 */
export async function fetchInboxMessageIds(
  client: gmail_v1.Gmail,
  opts: { query?: string; max?: number } = {}
): Promise<string[]> {
  const max = opts.max ?? 200;
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const res = await client.users.messages.list({
      userId: "me",
      q: opts.query,
      maxResults: Math.min(100, max - ids.length),
      pageToken,
    });
    for (const m of res.data.messages ?? []) {
      if (m.id) ids.push(m.id);
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken && ids.length < max);

  return ids;
}

export async function fetchMessage(
  client: gmail_v1.Gmail,
  messageId: string
): Promise<GmailMessage | null> {
  try {
    const res = await client.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const msg = res.data;
    const headers = msg.payload?.headers ?? [];
    const from = headers.find((h) => h.name?.toLowerCase() === "from")?.value ?? "";
    const subject = headers.find((h) => h.name?.toLowerCase() === "subject")?.value ?? "";

    const body = extractBody(msg.payload);

    return { messageId, from, subject, body };
  } catch {
    return null;
  }
}

function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";

  // Prefer text/html part
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf8");
  }

  // Plain text fallback
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf8");
  }

  // Recurse into multipart
  if (payload.parts) {
    // Try html first
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        return Buffer.from(part.body.data, "base64url").toString("utf8");
      }
    }
    // Plain text fallback
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64url").toString("utf8");
      }
    }
    // Recurse deeper
    for (const part of payload.parts) {
      const result = extractBody(part);
      if (result) return result;
    }
  }

  return "";
}

export async function watchInbox(
  client: gmail_v1.Gmail,
  topicName: string
): Promise<{ historyId: string; expiration: string }> {
  const res = await client.users.watch({
    userId: "me",
    requestBody: {
      topicName,
      labelIds: ["INBOX"],
    },
  });

  return {
    historyId: res.data.historyId ?? "",
    expiration: res.data.expiration ?? "",
  };
}
