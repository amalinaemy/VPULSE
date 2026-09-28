# Save both work-form images using the existing SaveWorkForm flow

This is an extension of SaveWorkForm, not a third flow. Keep the tenant trigger,
required poleId, and existing Add/Update row actions. The new app/API code must
be deployed together with these flow changes; it is currently prepared locally.

## 1. Extend the HTTP trigger schema

Add the following property inside the schema's existing `properties` object.
Do not replace the other properties or add images to `required`:

```json
"images": {
  "type": "array",
  "maxItems": 2,
  "items": {
    "type": "object",
    "properties": {
      "column": { "type": "string", "enum": ["cr1da_gambarsemasaditapak", "crf11_gambarselepasditapak"] },
      "fileName": { "type": "string" },
      "contentType": { "type": "string", "enum": ["image/jpeg", "image/png"] },
      "contentBase64": { "type": "string" }
    },
    "required": ["column", "fileName", "contentType", "contentBase64"]
  }
}
```

## 2. Initialize two variables before the existing Condition

- `workFormRowId`: String, initial value blank.
- `uploadedImageColumns`: Array, initial value `[]`.

## 3. Set the row ID in each branch

After **Update a row** succeeds, set `workFormRowId` to the same Dataverse row
GUID used by that Update action. If the row is selected by List rows, use:

```text
first(body('List_rows')?['value'])?['cr1da_lvvmmodelid']
```

After **Add a new row** succeeds, set `workFormRowId` to that action's returned
LV VM Model row ID, using its dynamic content. With the action named
`Add_a_new_row`, the expression is:

```text
body('Add_a_new_row')?['cr1da_lvvmmodelid']
```

Use the Dataverse row GUID, not the display pole ID.

## 4. Upload after the Condition, before the single Response

Add **Apply to each** with this input expression:

```text
coalesce(triggerBody()?['images'], json('[]'))
```

Keep loop concurrency disabled (sequential). Inside the loop add Microsoft
Dataverse **Upload a file or an image**:

| Setting | Value |
| --- | --- |
| Table name | LV VM Model (`cr1da_lvvmmodels`) |
| Row ID | `variables('workFormRowId')` |
| Column name | Enter custom value: `item()?['column']` |
| Content | `base64ToBinary(item()?['contentBase64'])` |
| File name, if shown | `item()?['fileName']` |

The two columns must be Dataverse Image columns. After the upload succeeds,
add **Append to array variable** targeting `uploadedImageColumns`, value:

```text
item()?['column']
```

Leave the append action's run-after as Succeeded only. Do not append a column
when its upload fails.

## 5. Return upload confirmation

Keep exactly one final Response, after the loop, with run-after Succeeded only.
Status: 200. Header: Content-Type = application/json. Body:

```json
{
  "success": true,
  "id": "@{variables('workFormRowId')}",
  "uploadedImageColumns": "@variables('uploadedImageColumns')"
}
```

In the designer, insert the `uploadedImageColumns` variable as an expression
that returns an ARRAY, not string interpolation. In code view the whole-value
expression is `@variables('uploadedImageColumns')`, without `@{...}`.

A successful example with both photos is:

```json
{
  "success": true,
  "id": "the-dataverse-row-guid",
  "uploadedImageColumns": ["cr1da_gambarsemasaditapak", "crf11_gambarselepasditapak"]
}
```

## Verification

Save the flow, then deploy the prepared code. Select JPG/PNG images up to 1.5 MB
per field and submit an intended work-form update once. Confirm that both upload
actions succeeded and inspect both image columns on the matching Dataverse row.
Selecting no new image leaves existing images unchanged. The row save and image
uploads are separate operations: an upload failure can leave the text changes
saved, so inspect run history before retrying.

Sources:
- https://learn.microsoft.com/en-us/power-automate/dataverse/upload-download-file
- https://vercel.com/docs/functions/limitations (base64 increases upload size;
  the app checks its complete JSON request against the function body limit).

## Display existing images in GetWorkForm

In the existing GetWorkForm flow, List rows must select these logical columns
in addition to the other form fields:

```text
cr1da_lvvmmodelid,cr1da_gambarsemasaditapak,crf11_gambarselepasditapak
```

Keep the poleId filter and top 1. The found branch Response body should return
`first(body('List_rows')?['value'])`, including those image properties. Dataverse
returns base64 thumbnail data for selected Image columns; the frontend now
converts that data into previews. An image URL or GUID alone is not image content.
If the connector response omits image content, use Dataverse Download a file or
an image for that row and column and return its base64 `$content` under the same
logical column name. Download only columns with existing images.

The app preserves existing photos when no replacement is selected. Browser file
inputs remain empty for saved photos; their preview is shown underneath.

Reference: https://learn.microsoft.com/en-us/power-apps/developer/data-platform/image-column-data
