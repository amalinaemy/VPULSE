async function saveFlowToken(): Promise<string> {
  const tenant = process.env.POWER_AUTOMATE_TENANT_ID;
  const clientId = process.env.POWER_AUTOMATE_CLIENT_ID;
  const clientSecret = process.env.POWER_AUTOMATE_CLIENT_SECRET;
  if (!tenant || !clientId || !clientSecret) {
    throw new Error('SaveWorkForm requires tenant authentication. Configure POWER_AUTOMATE_TENANT_ID, POWER_AUTOMATE_CLIENT_ID and POWER_AUTOMATE_CLIENT_SECRET in Vercel.');
  }
  if (!/^[a-zA-Z0-9.-]+$/.test(tenant)) throw new Error('Invalid POWER_AUTOMATE_TENANT_ID configuration.');
  const response = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId,
      // Power Automate's audience ends with '/'; preserve it before appending '/.default'.
      client_secret: clientSecret, scope: 'https://service.flow.microsoft.com//.default' }),
  });
  const data: any = await response.json().catch(() => null);
  if (!response.ok || typeof data?.access_token !== 'string') {
    throw new Error('Unable to authenticate SaveWorkForm. Check the Entra application credentials and tenant in Vercel.');
  }
  return data.access_token;
}

function imageUploads(values: Record<string, any>) {
  const uploads: { column: string; fileName: string; contentType: string; contentBase64: string }[] = [];
  for (const column of ['cr1da_gambarsemasaditapak', 'crf11_gambarselepasditapak']) {
    const value = values[column];
    if (value == null || value === '') { delete values[column]; continue; }
    const match = typeof value === 'string' ? /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value) : null;
    if (!match || match[2].length % 4 !== 0) throw new Error('Image uploads must be valid JPG or PNG files.');
    const bytes = Buffer.from(match[2], 'base64');
    const valid = match[1] === 'image/png'
      ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (!valid || bytes.length === 0 || bytes.length > 1.5 * 1024 * 1024) throw new Error('Image uploads must be JPG or PNG files of 1.5 MB or smaller each.');
    uploads.push({ column, fileName: `${column}.${match[1] === 'image/png' ? 'png' : 'jpg'}`, contentType: match[1], contentBase64: match[2] });
    delete values[column]; // Avoid duplicating base64 in the request and overwriting images via Update row.
  }
  return uploads;
}

async function assessmentForSave(poleId: string): Promise<Record<string, any>> {
  const url = process.env.POWER_AUTOMATE_GET_POLES_URL;
  if (!url) throw new Error('POWER_AUTOMATE_GET_POLES_URL is required to retrieve locked pole details before saving.');
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  const data: any = await response.json().catch(() => null);
  const rows = Array.isArray(data) ? data : data?.value;
  if (!response.ok || !Array.isArray(rows)) throw new Error('Unable to retrieve assessment pole details. No work form was saved.');
  const matches = rows.filter(row => typeof row?.cr1da_poleidentifier === 'string' && row.cr1da_poleidentifier.trim().toLowerCase() === poleId.trim().toLowerCase());
  if (matches.length !== 1) throw new Error('A unique assessment pole record is required. No work form was saved.');
  return matches[0];
}



export default async function handler(
  req: any,
  res: any
) {

  /*
  |--------------------------------------------------------------------------
  | GET WORK FORM
  |--------------------------------------------------------------------------
  */

  if (req.method === "GET") {

    const poleId = req.query.poleId;


    if (
      !poleId ||
      typeof poleId !== "string"
    ) {

      return res.status(400).json({
        message: "Pole ID is required."
      });

    }


    const flowUrl =
      process.env
        .POWER_AUTOMATE_GET_WORK_FORM_URL;


    if (!flowUrl) {

      return res.status(500).json({
        message:
          "POWER_AUTOMATE_GET_WORK_FORM_URL is not configured."
      });

    }


    try {

      const flowResponse =
        await fetch(
          flowUrl,
          {
            method: "POST",
            signal: AbortSignal.timeout(55000),

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                poleId
              })
          }
        );


      if (!flowResponse.ok) {

        const failure: any = await flowResponse.json().catch(() => null);
        const code = typeof failure?.error?.code === "string" && /^[a-zA-Z0-9_.-]{1,100}$/.test(failure.error.code) ? ` (${failure.error.code})` : "";


        console.error(
          "Get Work Form flow error:",
          flowResponse.status, code
        );


        return res.status(502).json({
          message:
            `GetWorkForm returned HTTP ${flowResponse.status}${code}. Check the failed action in the flow run history.`
        });

      }


      const data =
        await flowResponse.json();


      return res
        .status(200)
        .json(data);

    } catch (error) {

      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      if (timedOut) return res.status(504).json({
        message: "The work-record service took too long to respond. Please retry loading the form. If this continues, check the GetWorkForm flow run in Power Automate.",
        retryable: false,
      });
      console.error("Get Work Form API connection failed.");


      return res.status(500).json({
        message:
          "Unable to connect to the Get Work Form flow."
      });

    }

  }


  /*
  |--------------------------------------------------------------------------
  | SAVE WORK FORM
  |--------------------------------------------------------------------------
  */

  if (req.method === "PUT") {

    const poleId =
      req.query.poleId;


    if (
      !poleId ||
      typeof poleId !== "string"
    ) {

      return res.status(400).json({
        message: "Pole ID is required."
      });

    }


    const flowUrl =
      process.env
        .POWER_AUTOMATE_SAVE_WORK_FORM_URL;


    if (!flowUrl) {

      return res.status(500).json({
        message:
          "POWER_AUTOMATE_SAVE_WORK_FORM_URL is not configured."
      });

    }


    try {

      /*
      |--------------------------------------------------------------------------
      | Data received from React
      |--------------------------------------------------------------------------
      */

      const {
        id,
        version,
        values: submittedValues
      } = req.body ?? {};


      if (
        !submittedValues ||
        typeof submittedValues !== "object" || Array.isArray(submittedValues)
      ) {

        return res.status(400).json({
          message:
            "Work form values are required."
        });

      }


      const lockedFields = new Set(['cr1da_feederpolesection', 'cr1da_feederid', 'cr1da_zone', 'cr1da_gpsautocapture', 'cr1da_gambaraireference']);
      const values: Record<string, any> = Object.fromEntries(Object.entries(submittedValues).filter(([key]) => !lockedFields.has(key.toLowerCase())));
      let images;
      try { images = imageUploads(values); }
      catch (error) { return res.status(400).json({ message: error instanceof Error ? error.message : 'Invalid image upload.' }); }
      const token = await saveFlowToken();
      const pole = await assessmentForSave(poleId);
      const textOrNull = (value: unknown) => value == null || value === '' ? null : String(value);
      const flag = values.cr1da_fieldtrimmingrequired;
      if (![undefined, null, '', 0, 1, false, true].includes(flag)) {
        return res.status(400).json({ message: 'Field Trimming Required must be Yes or No.' });
      }
      // Match the flat SaveWorkForm trigger schema; use trusted assessment values for locked details.
      const payload = {
        poleId,
        feederId: textOrNull(pole.cr1da_feederidentifier),
        streetName: textOrNull(pole.cr1da_zone),
        latitude: textOrNull(pole.cr1da_latitude),
        longitude: textOrNull(pole.cr1da_longitude),
        inspectionDate: textOrNull(values.cr1da_inspectiondate),
        inspectionStatus: values.cr1da_inspectionstatus ?? null,
        riskLevel: values.cr1da_risklevel ?? null,
        aiConfirmedEncroachment: values.cr1da_aiconfirmedenroachment ?? null,
        fieldTrimmingRequired: flag == null || flag === '' ? null : flag === 1 || flag === true,
        contractorName: textOrNull(values.cr1da_namapegawaicontractors),
        remarks: textOrNull(values.cr1da_remarksactiontaken),
        trimmingWork: values.crf11_trimmingwork ?? null,
        // Preserve optional metadata and image values for flows that use them.
        id: id ?? null, version: version ?? null, values, images,
      };
      const flowResponse = await fetch(flowUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      /*
      |--------------------------------------------------------------------------
      | Power Automate error
      |--------------------------------------------------------------------------
      */

      if (!flowResponse.ok) {
        const failure: any = await flowResponse.json().catch(() => null);
        const code = typeof failure?.error?.code === "string"
          && /^[a-zA-Z0-9_.-]{1,100}$/.test(failure.error.code) ? ` (${failure.error.code})` : "";
        console.error("SaveWorkForm failed:", flowResponse.status, code);
        return res.status(flowResponse.status === 409 ? 409 : 502).json({
          message: flowResponse.status === 401 || flowResponse.status === 403
            ? `SaveWorkForm rejected authentication (HTTP ${flowResponse.status}${code}). Verify that the Entra application and flow belong to the same tenant and that the trigger permits this service principal. The flow may not have started.`
            : `SaveWorkForm returned HTTP ${flowResponse.status}${code}. Open its latest failed run in Power Automate to see which action failed.`,
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Success
      |--------------------------------------------------------------------------
      */

      const responseText =
        await flowResponse.text();


      /*
       * Some Power Automate flows may
       * return an empty response.
       */

      if (!responseText) {
        if (images.length) return res.status(502).json({ message: 'The form request completed, but image uploads were not confirmed. Configure the image upload actions in SaveWorkForm.' });
        return res.status(200).json({
          success: true,
          message:
            "Work form saved successfully."
        });

      }


      /*
       * If Power Automate returned JSON,
       * pass it back to React.
       */

      try {

        const data =
          JSON.parse(responseText);
        if (data?.success === false || data?.error) {
          return res.status(502).json({ message: "SaveWorkForm reported a failed save. Check its Response action and Dataverse action in run history." });
        }

        if (images.length && !images.every(image => Array.isArray(data?.uploadedImageColumns) && data.uploadedImageColumns.includes(image.column))) {
          return res.status(502).json({ message: 'The form request completed, but not all images were confirmed saved. Check the upload actions in SaveWorkForm.' });
        }
        return res
          .status(200)
          .json(data);

      } catch {
        if (images.length) return res.status(502).json({ message: 'SaveWorkForm did not return image upload confirmation. Check its Response action.' });
        return res.status(200).json({
          success: true,
          message:
            "Work form saved successfully."
        });

      }

    } catch (error) {

      // Never log credentials, access tokens or trigger URLs.
      const message = error instanceof Error && /^(SaveWorkForm requires|Invalid POWER_|Unable to authenticate|POWER_AUTOMATE_GET_POLES_URL|Unable to retrieve assessment|A unique assessment)/.test(error.message)
        ? error.message : "Unable to connect to the Save Work Form flow.";


      return res.status(500).json({
        message
      });

    }

  }


  /*
  |--------------------------------------------------------------------------
  | Other HTTP methods
  |--------------------------------------------------------------------------
  */

  return res.status(405).json({
    message: "Method not allowed."
  });

}