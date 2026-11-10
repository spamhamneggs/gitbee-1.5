# Task 6.2: unified frontend session

AuthContext exposes `session`, `setSession` and `loading`. Both SSO and local
sessions use the same identity shape:

```ts
interface Session {
  nim: string;
  name: string;
  email: string;
  activeRole: string;
  roles: string[];
  authMethod: "sso" | "local";
}
```

On mount, the provider requests `GET /api/auth/session` with credentials and
caching disabled. The backend verifies the session signature, expiry and
credential version, checks current role membership for known users, and returns only
identity fields. If current membership, the selected role or the NIM disagrees
with the cookie, the endpoint returns 401 and the user must sign in again. It
does not combine a new role with the old identity. A missing or invalid session
also returns 401. SSO sessions bound to a verified `userId` may keep a Microsoft
email alias that differs from the local account email; local sessions and SSO
sessions without that binding still require a matching email.

Bootstrap has a ten-second request deadline and shows a loading message while
pending. Children mount after the request settles, so successful restoration
supplies identity on their first render. On failure, public content and login
controls remain available with an error message and a Retry button. Installing a
session after successful sign-in clears that error through a stable setter.
Cleanup aborts the request and ignores stale results.

Successful login and role-switch responses include the canonical identity at
`data.session`, alongside the fields older clients expect. Context updates from
that cookie-setting response without a second request. Every login method uses
`POST /api/auth/session/role` with its verified cookie to switch roles, including
SSO sessions restored in a tab with no MSAL account cache. Switching preserves
the authentication method and cookie expiry. AuthContext never stores a Microsoft
token. Logout calls `POST /api/auth/logout`
to expire the configured cookie on the server before clearing context and, for
SSO sessions, signing out through MSAL. This also works with httpOnly cookies.

## Compatibility and rollout

Deploy the backend before the frontend. Existing login and local role-switch
response bodies remain compatible with older frontend versions. New cookies
include `authMethod`; the session endpoint also accepts older cookies, inferring
their method from the existing Microsoft-token claim. SSO students without a
local user row continue to work. No database migration or data rewrite is needed;
rollback consists of restoring the previous application version.

Deletion revokes sessions carrying `userId`. The existing resolver still treats
a missing user as untracked when a legacy cookie has no `userId`, so deletion
revocation is not guaranteed for those cookies. Restricting that fallback to
unprovisioned students is separate work.

Task 5.9 still owns cookie hardening and removing Microsoft tokens from the
backend's legacy login responses and JWTs (GB-04, #26). This change removes client
cookie access from identity loading and logout (AR-02, #41); the Next server proxy
still uses the configured cookie name for its existing navigation guard.

## Verification

`pnpm test` covers session identity, existing and new cookies, cookie-only local
and SSO role switches, canonical login responses, stale membership and identity,
bootstrap timeout/retry, credential revocation, missing/expired/forged sessions,
and server logout with an httpOnly cookie. Session
responses and requests use `no-store`. Tests need no Microsoft account or running
database; the existing optional MySQL suites still require `TEST_DATABASE_URL`.

For a manual check, sign in through either method, switch an assigned role,
reload to confirm identity restoration, and log out. Confirm the cookie is
removed and reloading stays signed out. Repeat with task 5.9's httpOnly cookie
settings when that task lands. For SSO, also switch roles in a new tab with an
empty MSAL cache. With the backend unavailable, confirm bootstrap stops loading
and Retry restores the session when the backend returns.
