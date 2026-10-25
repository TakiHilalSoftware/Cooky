/**
 * One trial per person (PRD §3.7). Pure rules, shared by the server and its
 * tests: which addresses count as the same inbox, so a `+tag` or a dotted
 * Gmail address can't unlock a second trial.
 */

/** Providers that ignore dots in the local part, mapped to their canonical domain. */
const DOTLESS_DOMAINS: Record<string, string> = { "gmail.com": "gmail.com", "googlemail.com": "gmail.com" };

/** The inbox an address delivers to, as far as the trial is concerned. */
export function trialInbox(email: string): string {
  const address = email.trim().toLowerCase();
  const at = address.lastIndexOf("@");
  if (at <= 0) return address;
  const domain = address.slice(at + 1);
  // Sub-addressing (`name+anything@`) reaches the same inbox on nearly every provider.
  let local = address.slice(0, at).split("+")[0]!;
  const canonical = DOTLESS_DOMAINS[domain];
  if (canonical) local = local.replaceAll(".", "");
  return `${local}@${canonical ?? domain}`;
}
