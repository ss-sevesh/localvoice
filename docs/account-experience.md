# Local Voice account experience

## Design and scope

Use the supplied purple desert as the shared visual reference. Preserve the voice
workspace's dark surfaces, lavender controls, typography and reduced-motion support.
Build order: public landing page → local accounts → authenticated voice workspace.

- Landing: one clear headline and primary action, a voice conversation preview,
  three product benefits, a short explanation and accessible navigation. No invented
  testimonials, pricing, cloud integrations or usage statistics.
- Accounts: dedicated sign-up and login screens with visible labels, password
  visibility, inline errors and pending states. Email identifies a local account;
  it is not verified and no email is sent. Passwords are never stored as plaintext.
- Workspace: preserve existing voice behavior; require a server session for its
  WebSocket. Refresh restores the session; logout revokes it and stops the microphone.
- Responsive: no horizontal overflow at 320, 768, 1024 or 1440 pixels. Keyboard
  navigation and reduced-motion preferences work throughout.

## Architecture and security

Keep React/Vite and FastAPI. Use hash routes so both static production serving and
the dev server support deep links without a new router dependency. Store account
records and hashed, expiring session identifiers in ignored `data/accounts.sqlite3`.
Use scrypt password hashes with random salts, parameterized SQL, HttpOnly/SameSite
cookies, same-origin checks and bounded login attempts. This app stays on loopback;
public hosting, password recovery and multi-machine accounts are outside this scope.

API: `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/session`,
`POST /api/auth/logout`. Auth responses expose only the user's name and email.
Invalid credentials use a generic error. Sessions last seven days and logout deletes
the server record. Unauthenticated voice sockets close with code 1008.

Implementation references: [Starlette cookie options](https://starlette.dev/responses/),
[Python scrypt](https://docs.python.org/3/library/hashlib.html#hashlib.scrypt), and
[Python SQLite transaction handling](https://docs.python.org/3/library/sqlite3.html#how-to-use-the-connection-context-manager).

## Verification and delivery

1. Test registration, duplicate accounts, invalid credentials, persistence, expiry,
   logout, cross-origin rejection and unauthenticated socket rejection with pytest.
2. Test route transitions, form errors and session handling with Vitest.
3. Run existing backend/frontend checks and voice scenarios after adapting their
   setup to authenticated sessions. Verify screenshots and accessibility in Chrome.
4. Review staged changes for secrets and local data. Commit and push to a new private
   GitHub repository (private is the conservative default for unpublished work).

Commands: `.venv/Scripts/python.exe -m pytest -q`,
`.venv/Scripts/ruff.exe check app tests scripts`, and, in `frontend`,
`npm run test -- --run`, `npm run lint`, `npm run build`, `npx playwright test`.
