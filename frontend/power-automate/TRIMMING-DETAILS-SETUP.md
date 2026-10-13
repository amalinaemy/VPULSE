# Connect the new trimming details

The form displays Nama Pegawai Cantasan (text) and Trimming Date (date) immediately after Field Trimming Required and Trimming Work, before Remarks. Existing records without these values show blank inputs. Clearing a value sends null.

## GetWorkForm

In LV VM Models List rows, append these columns to Select columns:

```
crf11_namapegawaicantasan,crf11_trimmingdate
```

Keep the pole filter, latest-record ordering and row limit unchanged. Response 1 remains the first returned record. The repository's GetWorkForm.List_rows.json includes the new select list.

## SaveWorkForm

Add these optional properties to the HTTP trigger's existing JSON schema (do not replace the whole schema or add them to required):

```json
"namaPegawaiCantasan": { "type": ["string", "null"] },
"trimmingDate": { "type": ["string", "null"] }
```

In BOTH Add a new row and Update a row for LV VM Models, map:

| Dataverse column | Expression |
| --- | --- |
| crf11_namapegawaicantasan | triggerBody()?['namaPegawaiCantasan'] |
| crf11_trimmingdate | triggerBody()?['trimmingDate'] |

The website sends dates as YYYY-MM-DD and null when cleared. Verify the Dataverse column is configured for the desired date-only behavior. Save the flows. No change to authentication or the existing status mapping is needed.

## Verify

Use an approved test pole: open its form, enter a name/date and save; close and reopen to confirm both persisted. Edit both and repeat. Clear them and confirm they reopen blank. Existing inspection officer/date fields must remain independent. Do not rely on an HTTP 200 alone: the Add/Update row mappings must be present for values to persist.
