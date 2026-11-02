/**
 * Exact infrastructure hosts that must remain reachable during account authentication.
 * Shared by runtime matching and native interception; never applies to descendant hosts.
 * @since 1.1.1
 */
export const ProtectionBypassHosts: readonly string[] = [ 'accounts.youtube.com' ];
