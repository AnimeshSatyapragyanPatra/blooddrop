// Storage for review documents.
//
// Two backends behind one interface: the local filesystem when running on the
// mock database, and a private Supabase Storage bucket otherwise. Files here
// are short-lived by design — they exist to be looked at once by a reviewer and
// are then purged, so nothing accumulates a pile of identity scans.
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { supabase, MOCK } from "./supabase.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCAL_DIR = process.env.MOCK_UPLOAD_DIR || join(__dirname, "../../.data/uploads");
const BUCKET = process.env.SUPABASE_DOC_BUCKET || "donor-docs";

export const MAX_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 4 * 1024 * 1024); // 4 MB
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Decode and sanity-check a base64 upload before it touches any store. */
export function decodeUpload(dataUrlOrBase64, mimeHint) {
  if (typeof dataUrlOrBase64 !== "string" || !dataUrlOrBase64) {
    return { error: "No file was received." };
  }

  let mime = mimeHint;
  let payload = dataUrlOrBase64;

  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrlOrBase64);
  if (match) {
    mime = match[1];
    payload = match[2];
  }

  if (!ALLOWED_MIME.includes(mime)) {
    return { error: "Upload a JPG, PNG, WEBP or PDF." };
  }

  let buffer;
  try {
    buffer = Buffer.from(payload, "base64");
  } catch {
    return { error: "That file could not be read." };
  }

  if (!buffer.length) return { error: "That file is empty." };
  if (buffer.length > MAX_BYTES) {
    return { error: `Files must be under ${Math.round(MAX_BYTES / (1024 * 1024))} MB.` };
  }

  return { buffer, mime };
}

export async function putDocument(userId, buffer, mime) {
  const path = `${userId}/${randomUUID()}.${EXT[mime] || "bin"}`;

  if (MOCK) {
    const full = join(LOCAL_DIR, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, buffer);
    return { path };
  }

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: mime,
    upsert: false,
  });
  if (error) return { error: error.message };
  return { path };
}

export async function getDocument(path) {
  if (!path) return { error: "This document has been purged." };

  if (MOCK) {
    const full = join(LOCAL_DIR, path);
    if (!existsSync(full)) return { error: "File not found." };
    return { buffer: readFileSync(full) };
  }

  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) return { error: error.message };
  return { buffer: Buffer.from(await data.arrayBuffer()) };
}

/** Called once a reviewer has decided: the decision is kept, the scan is not. */
export async function deleteDocument(path) {
  if (!path) return;
  try {
    if (MOCK) {
      const full = join(LOCAL_DIR, path);
      if (existsSync(full)) unlinkSync(full);
      return;
    }
    await supabase.storage.from(BUCKET).remove([path]);
  } catch (err) {
    console.error("[blooddrop] could not purge document:", err.message);
  }
}
