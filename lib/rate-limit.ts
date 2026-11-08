import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { publicRateLimits } from "@/db/schema";
import { lookupHash } from "@/lib/crypto";

/**
 * Counts one attempt for `key` in a fixed window and says whether it's
 * within `limit`. Keys are hashed, so phone numbers and IP addresses are
 * never stored. Works across serverless instances because the counter
 * lives in Postgres.
 */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  now: Date = new Date(),
): Promise<boolean> {
  const hashed = lookupHash("rate-limit", key);
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);
  const [row] = await db
    .insert(publicRateLimits)
    .values({ key: hashed, count: 1, resetAt })
    .onConflictDoUpdate({
      target: publicRateLimits.key,
      set: {
        count: sql`case when ${publicRateLimits.resetAt} <= ${now} then 1 else ${publicRateLimits.count} + 1 end`,
        resetAt: sql`case when ${publicRateLimits.resetAt} <= ${now} then ${resetAt} else ${publicRateLimits.resetAt} end`,
      },
    })
    .returning({ count: publicRateLimits.count });
  return row.count <= limit;
}
