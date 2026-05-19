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

The app uses Firebase Anonymous Auth and Realtime Database. Do not commit service account keys, CI tokens, `.env` files, or Firebase web app config values. Paste the Firebase web app config into the presenter UI at runtime; it is stored only in that browser and encoded into the QR join link for that event.

```powershell
npm run firebase:login
firebase projects:create <globally-unique-project-id> --display-name "Wheel of Names"
firebase use <project-id>
firebase deploy --only database
```

In the Firebase console, create a Web app, enable Anonymous Authentication, create a Realtime Database, then deploy the rules.

## Static mode

Open `index.html` directly or use the GitHub Pages deployment. Static mode supports the wheel, local browser storage, manual entry, and bulk paste/import.
