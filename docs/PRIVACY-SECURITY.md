# Privacy and security

| Requirement | Implementation | Verified by |
|---|---|---|
| Explicit consent | Health data is accepted by `PUT /api/profile` only when `health_data` consent is recorded (checkbox in onboarding/profile). Online OCR requires `cloud_ocr` consent; scan history requires `scan_history`; the food diary requires `food_log` (turning it off deletes the diary). All default **off** for new accounts. | API tests “refuses to store health data without explicit consent”, “online OCR requires consent” |
| Secure authentication | scrypt (N=16384, r=8, p=1) password hashes; ≥10-char passwords; 32-byte random session tokens in an `HttpOnly; SameSite=Lax; Secure` (production) cookie; DB stores only SHA-256 of the token; 7-day expiry; uniform login errors with constant-work hashing for unknown users; rate limiting on login/registration; password re-entry to delete the account | API tests (auth, rate limit, account deletion) |
| User-controlled editing and deletion | Edit any field; dated profile history; delete profile (also withdraws consent); delete individual scans or all history; turning history off deletes it; delete account (cascades everything) | API + e2e scenario 7 |
| Encryption in transit | HTTPS in production (HSTS header); Secure cookies | `next.config.mjs` headers; deployment guide |
| Encryption at rest | AES-256-GCM per record for profile, profile history, scans, comparisons, food-diary entries and diary settings (only the entry’s date is stored in clear, to query by day); the GCM additional data binds each ciphertext to its owner and purpose (`profile:<userId>`), so a row moved to another user cannot be decrypted; key `FD_DATA_KEY` from the environment (required in production) | unit test (AAD binding), API test (plaintext marker absent from DB file) |
| Per-user access control | No endpoint accepts a user id from the client; the id comes from the session; every query is `WHERE user_id = ?`; private pages are checked server-side | API test “user B cannot read, delete or list user A's data”; e2e scenario 7 |
| No public exposure of health profiles | No sharing feature, no public routes for personal data, `Cache-Control: no-store` on API responses, the service worker never caches `/api/*` or private pages | code review; `public/sw.js` |
| No health data in analytics logs | There is no analytics. Server error logs record only method, path and error type — never request bodies. `FD_DEBUG_ERRORS=1` (local debugging only) adds stack traces, still without bodies | API test scans the server log for a health-data marker |
| Data export and account deletion | `GET /api/account/export` (decrypted JSON download), `DELETE /api/account` | API test |
| Privacy-first defaults | All optional processing off; username instead of required email; on-device OCR is the default; no third-party scripts or fonts (fonts self-hosted); strict CSP; `Permissions-Policy` allows only the camera | headers in `next.config.mjs` |
| No health data in browser storage | The profile is fetched after login and held in React state only. `localStorage` is not used; one non-sensitive cookie (`fd_lang`) stores the language | code review (`grep localStorage` finds none) |
| Cloud OCR rules | Keys/URLs only on the server; consent prompt explains that the photo leaves the device, goes to the FoodDecode OCR server, is processed in memory and discarded; the OCR service writes nothing to disk and logs nothing; on-device OCR always available | `services/ocr-server/server.py`, scan screen |
| CSRF / XSS | `SameSite=Lax` cookies + Origin check on all mutating requests; JSON-only bodies with size limits; React escaping; CSP `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'` | API test “blocks cross-site requests” |

**Medical documents.** The app does not accept uploads of medical documents, so no extracted medical information is ever assumed correct. Limits are entered by the user, with an explicit “my doctor or dietitian advised this” flag.

**Known gaps** (see LIMITATIONS): in-memory rate limiting (per process), no email-based account recovery (by design: no email collected), no 2FA, key rotation is manual.
