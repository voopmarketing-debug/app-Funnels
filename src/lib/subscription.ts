/**
 * Whether a business's paid period is currently active. `null` means no
 * subscription window has ever been set on this business — treated as
 * active (not expired) so existing businesses that predate this check, or
 * ones the agency simply hasn't dated yet, aren't locked out by default.
 * Only an EXPLICIT, past `subscriptionEndsAt` blocks access — see
 * dashboard/businesses/[id]/layout.tsx.
 */
export function isSubscriptionActive(subscriptionEndsAt: Date | null): boolean {
  if (!subscriptionEndsAt) return true;
  return subscriptionEndsAt.getTime() >= Date.now();
}
