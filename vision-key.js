// Embedded Google Cloud Vision API key.
//
// When this is set, the app works with zero setup — no sign-in, no pasting.
// Before committing a key here, restrict it in the Google Cloud console:
//   1. Application restriction: Websites → https://lbranigan.github.io/*
//   2. API restriction: Cloud Vision API only
//   3. Quotas → Cloud Vision API → cap "Requests per day" (e.g. 200)
// Leave empty ('') to fall back to a key the user pastes on the setup
// screen, which is then saved on their device (localStorage).
export const VISION_API_KEY = '';
