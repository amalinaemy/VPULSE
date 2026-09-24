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

## Work feedback and forms

Use only the existing GetWorkForm and SaveWorkForm flows. Keep `poleId` required,
the pole filter and `$top: 1` in GetWorkForm.

- Set `POWER_AUTOMATE_GET_WORK_FORM_URL` in Vercel. Both read routes POST
  `{ "poleId": "P1" }` to this flow. Return one raw Dataverse row, or
  `{ "found": false }` when no row exists.
- Set `POWER_AUTOMATE_SAVE_WORK_FORM_URL` for the existing save flow. Its
  request remains `{ "poleId": "P1", "id": null, "version": null, "values": { ... } }`.
- `/api/work-feedback?poleId=P1` extracts trimming status from that pole's row.
  The browser deduplicates pole IDs, runs at most four reads concurrently and
  caches successful results for five minutes. Failed reads leave totals unavailable;
  they are not treated as pending work. Manual refresh clears the cache.
- `/api/work-form?poleId=P1` loads the selected pole. The frontend converts the raw
  row to form fields and preserves the Dataverse row ID and ETag. Include the
  primary key `cr1da_lvvmmodelid` and formatted choice annotations in the response.
- The five choice fields are editable dropdowns using the Dataverse numeric
  mappings supplied by the user in `src/services/workFormResponse.ts`.
  Field Trimming Required maps false/No to 0 and true/Yes to 1. SaveWorkForm
  continues receiving numeric values in `values`; no live records are changed
  by automated tests. Only the five assessment pole details remain locked.


The flow's Dataverse query must use actual column logical names, such as
`cr1da_feederpolesection` and `crf11_trimmingwork`. Ensure one HTTP Response
executes per run. Review the failed action in run history for any upstream 4xx/5xx.
Trigger URLs remain server-side. If the HTTP trigger requires OAuth, server-side
OAuth authentication must also be configured.

Tests: `node --experimental-strip-types --test tests/work-form-flow.test.ts`.
