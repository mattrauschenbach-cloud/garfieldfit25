# Fire Fit

## Quickstart

1. Copy `.env.example` to `.env` and fill in your Firebase values (must be prefixed with `VITE_`).
2. Install deps: `npm i`
3. Run locally: `npm run dev`
4. Netlify:
   - Add the same variables in Site Settings → Environment Variables.
   - Ensure `netlify.toml` is committed (or keep `public/_redirects`) for SPA routing.
   - Build command: `npm run build`, Publish directory: `dist`.

Troubleshooting:
- If you see a blank page after deploying, it’s usually missing env vars or missing SPA redirects.
- The `/diag` page helps verify envs and Firestore rules quickly.


### Local emulators

1. Install Firebase CLI: `npm i -g firebase-tools`
2. Login: `firebase login`
3. Start emulators: `npm run emulators`
   - Firestore: http://localhost:8080
   - Auth: http://localhost:9099
   - Emulator UI: http://localhost:4000

To point the app at emulators in dev, call `connectAuthEmulator` and `connectFirestoreEmulator` **only** when `import.meta.env.DEV === true`.
