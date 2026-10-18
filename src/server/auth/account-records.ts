import "server-only";

import { LEGAL_VERSIONS } from "@config/legal";
import { audit } from "@/server/audit/audit";
import { getDb } from "@/server/db/client";
import { consents, profiles } from "@/server/db/schema";

import { clientIp, requestLocale } from "./request-info";

/**
 * Everything a new account needs besides the auth rows: a profile in the
 * visitor's language, the accepted legal versions and an audit entry. Runs for
 * every sign-up path (email and OAuth), in one transaction.
 *
 * Email sign-up can't reach this point without ticking the consent box (the
 * action's schema requires it). OAuth buttons sit under the same consent line,
 * so continuing with Google means accepting it.
 */
export async function createAccountRecords(
  user: { id: string; name: string },
  headers: Pick<Headers, "get"> | null,
): Promise<void> {
  await getDb().transaction(async (tx) => {
    await tx
      .insert(profiles)
      .values({ userId: user.id, displayName: user.name, locale: requestLocale(headers) })
      .onConflictDoNothing();
    await tx.insert(consents).values([
      { userId: user.id, document: "terms", version: LEGAL_VERSIONS.terms },
      { userId: user.id, document: "privacy", version: LEGAL_VERSIONS.privacy },
    ]);
    await audit(tx, {
      actorId: user.id,
      action: "auth.signup",
      targetType: "user",
      targetId: user.id,
      ip: clientIp(headers),
    });
  });
}
