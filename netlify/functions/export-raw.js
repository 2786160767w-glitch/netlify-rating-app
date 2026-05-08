import { getStore } from "@netlify/blobs";

function toCsv(rows) {
  if (!rows.length) {
    return "participantId,dimension,leftImage,rightImage,choice,chosenImage,servedAt,submittedAt,responseTime,pairKey\n";
  }

  const headers = [
    "participantId",
    "dimension",
    "leftImage",
    "rightImage",
    "choice",
    "chosenImage",
    "servedAt",
    "submittedAt",
    "responseTime",
    "pairKey"
  ];

  const escape = (value) => {
    const str = String(value ?? "");
    if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
      return `"${str.replace(/"/g, "\"\"")}"`;
    }
    return str;
  };

  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(","))
  ];

  return lines.join("\n");
}

export default async (req, context) => {
  try {
    const url = new URL(req.url);
    const password = url.searchParams.get("password") || "";
    const adminPassword = process.env.ADMIN_PASSWORD || "";

    if (!adminPassword || password !== adminPassword) {
      return new Response("Unauthorized", { status: 401 });
    }

    const exportStore = getStore("exports");
    const rawExport = await exportStore.get("rawTrials");
    const allTrials = rawExport ? JSON.parse(rawExport) : [];

    const csv = toCsv(allTrials);

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"raw_trials.csv\""
      }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "export-raw function failed",
        message: String(error)
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};
