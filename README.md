# Wheel2

GDPR-friendly wheel of names for Global AI Community events.

The public GitHub Pages version is a static single-file app. For live QR joins at an event, run the local server on the presenter's laptop so phones on the same Wi-Fi can submit names without a third-party service.

## Local event mode

```powershell
npm install
npm start
```

Open the LAN URL printed by the server, then show the QR code from the presenter screen.

## Firebase live mode

The app uses Firebase Anonymous Auth and Realtime Database. Do not commit service account keys, CI tokens, `.env` files, or Firebase web app config values. For GitHub Pages, store the Firebase web app config JSON in a repository secret named `FIREBASE_WEB_CONFIG`; the deploy workflow injects it into the generated Pages artifact, not the source repo.

```powershell
npm run firebase:login
firebase projects:create <globally-unique-project-id> --display-name "Wheel of Names"
firebase use <project-id>
firebase deploy --only database
```

In the Firebase console, create a Web app, enable Anonymous Authentication, create a Realtime Database, then deploy the rules.

```powershell
gh secret set FIREBASE_WEB_CONFIG --repo Beavis009/Wheel2
```

Paste the Firebase web app config JSON when prompted. The browser still receives this config at runtime, so keep the Realtime Database rules strict and restrict the Firebase web API key to the GitHub Pages domain in Google Cloud if needed.

## Static mode

Open `index.html` directly or use the GitHub Pages deployment. Static mode supports the wheel, local browser storage, manual entry, and bulk paste/import.
