import { headers } from "next/headers";

/**
 * Builds the app's public base URL (e.g. "https://portal-cliente.vercel.app")
 * from the incoming request headers, so links in emails work correctly
 * both locally and in any deployment without extra env config.
 */
export async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
