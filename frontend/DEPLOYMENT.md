# Vercel and Power Automate

Set the Vercel project's Root Directory to `frontend`, framework to Vite,
build command to `npm run build`, and output directory to `dist`.
The `api/poles.ts` Node.js function is deployed alongside the frontend.

Set `POWER_AUTOMATE_GET_POLES_URL` in the Vercel project's environment variables
to the HTTP trigger URL of your existing flow, then redeploy. Keep this variable
server-side; do not prefix it with `VITE_` or commit the trigger URL.

The flow must accept an HTTP POST with JSON `{}` and return an HTTP Response
with status 200 and a JSON array of Dataverse pole records, or `{ "value": [...] }`.
Use the original Dataverse column names mapped in `src/services/api.ts`.
The existing function assumes the trigger URL authorizes the request; a flow
configured to require an OAuth token also needs server-side authentication.

Request path: browser GET `/api/poles` -> Vercel function -> Power Automate POST
-> Dataverse -> flow Response -> browser.

Use `vercel dev` from this directory to exercise the API locally with the
environment variable configured. `npm run dev` serves Vite only.

## Remaining backend endpoints

Only pole retrieval currently uses a Power Automate Vercel function. Health,
work feedback, and work form reads/saves still call the ASP.NET backend through
`VITE_API_BASE_URL`, which defaults to `http://localhost:5042`.
For those features in production, set `VITE_API_BASE_URL` to the deployed HTTPS
backend URL before building and allow the frontend origin in backend CORS.
Alternatively, migrate those endpoints to additional Vercel functions and flows
with matching request/response contracts. Deploying `frontend` does not deploy
the ASP.NET project in `backend/Vpulse.Api`.
