export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed." });
  }
  const flowUrl = process.env.POWER_AUTOMATE_GET_WORK_FEEDBACK_URL;
  if (!flowUrl) {
    return res.status(500).json({ message: "POWER_AUTOMATE_GET_WORK_FEEDBACK_URL is not configured in Vercel." });
  }
  try {
    const response = await fetch(flowUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      return res.status(502).json({ message: `The work-feedback flow returned HTTP ${response.status}. Check its run history and trigger authentication.` });
    }
    const data = await response.json();
    const records = Array.isArray(data) ? data
      : data && typeof data === "object" && "value" in data ? data.value : null;
    if (!Array.isArray(records)) {
      return res.status(502).json({ message: "The work-feedback flow must return a JSON array or an object with a value array." });
    }
    const feedback = records.map((record) => {
      if (!record || typeof record !== "object") throw new Error("Invalid feedback record.");
      const poleId = record.poleId ?? record.cr1da_feederpolesection ?? null;
      const trimmingWork = record.trimmingWork
        ?? record["crf11_trimmingwork@OData.Community.Display.V1.FormattedValue"]
        ?? record.crf11_trimmingwork ?? null;
      const modifiedOn = record.modifiedOn ?? record.modifiedon ?? null;
      if ((poleId !== null && typeof poleId !== "string")
        || (trimmingWork !== null && typeof trimmingWork !== "string")
        || (modifiedOn !== null && typeof modifiedOn !== "string")) {
        throw new Error("The feedback flow must return text poleId and trimmingWork labels, with modifiedOn as a date string or null. Include formatted Dataverse choice labels.");
      }
      return { poleId, trimmingWork, modifiedOn };
    });
    // The page uses the first feedback record for each pole.
    feedback.sort((a, b) => (Date.parse(b.modifiedOn ?? "") || 0) - (Date.parse(a.modifiedOn ?? "") || 0));
    return res.status(200).json(feedback);
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith("The feedback flow")
      ? error.message : "Unable to read work feedback from Power Automate. Check the flow Response action and run history.";
    return res.status(502).json({ message });
  }
}
