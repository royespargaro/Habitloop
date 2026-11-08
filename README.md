# InPursuit

InPursuit is a local-first personal execution workspace for life areas, goals, projects, habits, tasks, and reviews.

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and add a Google AI Studio API key to `GEMINI_API_KEY`.
3. Start the app with `npm run dev`.

The app and its `/api/brain-dump` endpoint run on the same origin. The production server serves the Vite build and the same API with `npm run build` followed by `npm start`.

## Free AI Brain Dump

The Brain Dump uses Gemini through a server-side endpoint; the API key is never sent to the browser. Google AI Studio may offer free-tier usage, subject to model, region, and quota availability. Use a key without billing enabled if you cannot risk charges. The app does not switch to a paid provider when a quota is exhausted; it returns an error instead.

Brain Dump notes are sent to Google for parsing. Do not include passwords, API keys, or other credentials. Suggestions stay out of app data until you review and approve them. Other app data remains in browser local storage unless you export it.

Set `GEMINI_MODEL` in `.env` to a model available to your AI Studio project. The default is `gemini-2.5-flash`.