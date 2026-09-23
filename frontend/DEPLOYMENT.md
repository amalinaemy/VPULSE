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

The frontend calls `/api/work-feedback` for trimming progress and
`/api/work-form?poleId=...` for form reads and saves. Configure these server-side
variables in Vercel for each relevant deployment environment and redeploy:

- `POWER_AUTOMATE_GET_WORK_FEEDBACK_URL`: POST `{}`. List rows from
  `cr1da_lvvmmodel`, including `cr1da_feederpolesection`, `crf11_trimmingwork`,
  and `modifiedon`. Return status 200 with an array or `{ "value": [...] }`.
  Include the formatted choice label for `crf11_trimmingwork`, or transform
  each row into `{ "poleId": "P1", "trimmingWork": "Completed", "modifiedOn": "2026-09-23T00:00:00Z" }`.
  Return all required rows using flow pagination. Feedback is sorted newest first.
- `POWER_AUTOMATE_GET_WORK_FORM_URL`: POST `{ "poleId": "P1" }`. Return
  `{ "id": null, "version": null, "fields": [...] }`. Each field must match
  `WorkFormField` in `src/services/api.ts`, including its name, label, type,
  required flag, maxLength, options and value. Raw Dataverse List rows output
  is not the form schema expected by the modal.
- `POWER_AUTOMATE_SAVE_WORK_FORM_URL`: POST `{ "poleId": "P1", "id": null,
  "version": null, "values": { ... } }`. Validate and persist the changes before
  returning success. Configure concurrency/version handling in the flow.

These are separate contracts: the existing poles flow alone does not provide
feedback or form data. Keep trigger URLs server-side. A trigger requiring OAuth
also requires server-side token authentication. Deploying `frontend` does not
deploy the ASP.NET project in `backend/Vpulse.Api`.
