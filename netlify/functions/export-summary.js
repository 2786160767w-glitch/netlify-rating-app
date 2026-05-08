import { getStore } from "@netlify/blobs";

function toCsv(rows) {
  if (!rows.length) {
    return "participantId,majorType,grade,completed,completedAt,attractiveness_count,comfort_count,naturalness_count\n";
  }

  const headers = [
    "participantId",
    "majorType",
    "grade",
    "completed",
    "completedAt",
    "attractiveness_count",
    "comfort_count",
    "naturalness_count"
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

    const participantsStore = getStore("participants");
    const trialsStore = getStore("trials");

    const listed = await participantsStore.list();
    const summaryRows = [];

    for (const item of listed.blobs) {
      const meta = await participantsStore.get(item.key, { type: "json" });
      const trials = (await trialsStore.get(item.key, { type: "json" })) || [];

      const countMap = {
        attractiveness: 0,
        comfort: 0,
        naturalness: 0
      };

      for (const t of trials) {
        if (countMap[t.dimension] !== undefined) {
          countMap[t.dimension] += 1;
        }
      }

      summaryRows.push({
        participantId: item.key,
        majorType: meta?.majorType || "",
        grade: meta?.grade || "",
        completed: meta?.completed === true,
        completedAt: meta?.completedAt || "",
        attractiveness_count: countMap.attractiveness,
        comfort_count: countMap.comfort,
        naturalness_count: countMap.naturalness
      });
    }

    summaryRows.sort((a, b) => a.participantId.localeCompare(b.participantId));

    const csv = toCsv(summaryRows);

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"participant_summary.csv\""
      }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "export-summary function failed",
        message: String(error)
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};
