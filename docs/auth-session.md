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
identity fields. All session guards reject stale membership, selected roles,
NIMs and local email addresses with 401, so the user must sign in again. SSO and
local login use the same role and NIM rules for matched database accounts;
unrecognized account roles return 403 without issuing a cookie. An SSO login
with no matching database account takes its NIM from Atlantis; if the lookup
fails or times out (503) or returns no NIM (403), no cookie is issued, rather
than a session with an empty NIM. The backend
does not combine a new role with the old identity. A missing or invalid session
also returns 401. Every rejection from `/auth/session` expires any presented
session cookie, including httpOnly cookies. SSO sessions bound to a verified
`userId` may keep a Microsoft email alias that differs from the local account
email; local sessions and SSO sessions without that binding still require a
matching email.

Bootstrap has a ten-second request deadline using `AbortController` and a timer,
including browsers without `AbortSignal.any` or `AbortSignal.timeout`. Public
content and MSAL mount immediately. Header identity controls and the student and
lecturer pages wait for restoration; protected content stays gated when signed
out. On failure, public content and login controls remain available with an
error message and a Retry button. Installing or clearing a session through the
stable setter aborts any pending bootstrap, clears its error, and ignores late
results. Cleanup cancels the request, timer and abort listener.

Successful login and role-switch responses include the canonical identity at
`data.session`, alongside the fields older clients expect. Context updates from
that cookie-setting response without a second request. Every login method uses
`POST /api/auth/session/role` with its verified cookie to switch roles, including
SSO sessions restored in a tab with no MSAL account cache. Switching preserves
the authentication method and cookie expiry. The legacy `/auth/login-local/role`
route uses the same handler and expiry rule, retaining its response fields.
AuthContext never stores a Microsoft token. Logout calls `POST /api/auth/logout`
to expire the configured cookie on the server before clearing context and, for
SSO sessions, signing out through MSAL. This also works with httpOnly cookies.
The logout request has a ten-second deadline. Until task 5.9, if the backend is
unreachable, the header can remove a readable cookie locally and finish sign-out.
It keeps the session and shows an error if it cannot remove that cookie. A
Microsoft sign-out failure after app logout is reported outside the signed-in
popover, which is already gone.

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
cookie access from identity loading (AR-02, #41), retaining `js-cookie` only for
the temporary offline logout fallback; the Next server proxy still uses the
configured cookie name for its existing navigation guard.

## Verification

`pnpm test` covers session identity, existing and new cookies, cookie-only local
and SSO role switches, canonical login responses, stale membership and identity,
bootstrap timeout/retry/cancellation, older browser abort APIs, credential
revocation, missing/expired/forged sessions, server logout with an httpOnly cookie,
and the header's role switch and logout controls with mocked hooks. Session
responses and requests use `no-store`. Tests need no Microsoft account or running
database; the existing optional MySQL suites still require `TEST_DATABASE_URL`.

For a manual check, sign in through either method, switch an assigned role,
reload to confirm identity restoration, and log out. Confirm the cookie is
removed and reloading stays signed out. Repeat with task 5.9's httpOnly cookie
settings when that task lands. For SSO, also switch roles in a new tab with an
empty MSAL cache. With the backend unavailable, confirm bootstrap stops loading
and Retry restores the session when the backend returns.
