// Where the admin app is mounted, derived from the host serving the page:
// on the admin subdomain (admin.<domain>) it lives at "/" so URLs are clean
// (admin.vershipgo.com/dashboard); everywhere else (main domain, Replit
// staging, localhost) it keeps its historical "/admin" prefix.
//
// All in-app navigation targets must be built as `${ADMIN_BASE}/<page>` —
// never a hard-coded "/admin/<page>" — so the same build works on both hosts.
export const IS_ADMIN_HOST = /^admin\./i.test(window.location.hostname);
export const ADMIN_BASE = IS_ADMIN_HOST ? "" : "/admin";
