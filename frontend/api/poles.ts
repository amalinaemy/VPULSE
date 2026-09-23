export default async function handler(
  request: any,
  response: any
) {

  if (request.method !== "GET") {

    return response.status(405).json({
      message: "Method not allowed"
    });
  }


  const flowUrl =
    process.env.POWER_AUTOMATE_GET_POLES_URL;


  if (!flowUrl) {

    return response.status(500).json({
      message:
        "Power Automate URL is not configured."
    });
  }


  try {

    const flowResponse =
      await fetch(flowUrl, {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({})
      });


    if (!flowResponse.ok) {

      const error =
        await flowResponse.text();

      console.error(
        "Power Automate error:",
        error
      );

      return response.status(502).json({
        message:
          "Unable to retrieve Dataverse data."
      });
    }


    const data =
      await flowResponse.json();

    // Accept either a Response action array or a Dataverse List rows payload.
    const records = Array.isArray(data)
      ? data
      : data && typeof data === "object" && "value" in data
        ? data.value
        : undefined;
    if (!Array.isArray(records)) {
      return response.status(502).json({
        message: "Power Automate must return an array of pole records or an object with a value array."
      });
    }

    return response.status(200).json(records);

  } catch (error) {

    console.error(error);


    return response.status(500).json({
      message:
        "Unable to connect to Power Automate."
    });
  }
}
