

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

      console.error(
        "Get Work Form API error:",
        error
      );


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
        values
      } = req.body ?? {};


      if (
        !values ||
        typeof values !== "object" || Array.isArray(values)
      ) {

        return res.status(400).json({
          message:
            "Work form values are required."
        });

      }


      /*
      |--------------------------------------------------------------------------
      | Send to Power Automate
      |--------------------------------------------------------------------------
      */

      const flowResponse =
        await fetch(
          flowUrl,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({

                poleId,

                id:
                  id ?? null,

                version:
                  version ?? null,

                values
              })
          }
        );


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
          message: `SaveWorkForm returned HTTP ${flowResponse.status}${code}. Open its latest failed run in Power Automate to see which action failed.`,
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

        return res
          .status(200)
          .json(data);

      } catch {

        return res.status(200).json({
          success: true,
          message:
            "Work form saved successfully."
        });

      }

    } catch (error) {

      console.error(
        "Save Work Form API error:",
        error
      );


      return res.status(500).json({
        message:
          "Unable to connect to the Save Work Form flow."
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