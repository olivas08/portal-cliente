import { createClient } from "@supabase/supabase-js";

const BUCKET = "order-documents";

/**
 * Lazily creates a Supabase Storage client using the service-role key
 * (server-only — never expose this key to the browser). Returns null
 * when the env vars aren't configured yet, so callers can surface a
 * clear setup error instead of an opaque crash.
 */
function getStorageClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

const NOT_CONFIGURED_MESSAGE =
  "Armazenamento de anexos não configurado (defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY).";

export async function uploadDocumentFile(
  storageKey: string,
  file: Buffer,
  contentType: string
) {
  const client = getStorageClient();
  if (!client) throw new Error(NOT_CONFIGURED_MESSAGE);

  const { error } = await client.storage
    .from(BUCKET)
    .upload(storageKey, file, { contentType, upsert: false });
  if (error) {
    throw new Error(`Falha ao carregar o ficheiro: ${error.message}`);
  }
}

export async function deleteDocumentFile(storageKey: string) {
  const client = getStorageClient();
  if (!client) return; // Nothing to clean up if storage isn't configured.
  await client.storage.from(BUCKET).remove([storageKey]);
}

export async function getDocumentDownloadUrl(
  storageKey: string,
  expiresInSeconds = 60
) {
  const client = getStorageClient();
  if (!client) throw new Error(NOT_CONFIGURED_MESSAGE);

  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrl(storageKey, expiresInSeconds);
  if (error || !data) {
    throw new Error("Não foi possível gerar o link de transferência.");
  }
  return data.signedUrl;
}
