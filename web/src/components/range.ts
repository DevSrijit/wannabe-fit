import "server-only";
import { cookies } from "next/headers";
import { RANGE_COOKIE, RANGE_OPTIONS } from "./range-options";

/**
 * The range for a page. The URL wins; otherwise the cookie the segmented control
 * wrote on the last click, so the choice follows the reader across tabs.
 */
export async function resolveDays(param: string | string[] | undefined, fallback = 30): Promise<number> {
  const ok = (v: number) => (RANGE_OPTIONS as readonly number[]).includes(v);
  const fromUrl = Number(Array.isArray(param) ? param[0] : param);
  if (ok(fromUrl)) return fromUrl;
  const fromCookie = Number((await cookies()).get(RANGE_COOKIE)?.value);
  return ok(fromCookie) ? fromCookie : fallback;
}
