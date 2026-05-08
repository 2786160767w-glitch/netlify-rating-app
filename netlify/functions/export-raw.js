import { getStore } from "@netlify/blobs";

function toCsv(rows) {
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

    const participantsStore = getStore("participants");
    const trialsStore = getStore("trials");

    const listed = await participantsStore.list();
    const completedParticipantIds = [];

    for (const item of listed.blobs) {
      const meta = await participantsStore.get(item.key, { type: "json" });
      if (meta && meta.completed === true) {
        completedParticipantIds.push(item.key);
      }
    }

    let allTrials = [];
    for (const participantId of completedParticipantIds) {
      const trials = await trialsStore.get(participantId, { type: "json" });
      if (Array.isArray(trials)) {
        allTrials.push(...trials);
      }
    }

    // 按 participantId + submittedAt 排序，导出更整齐
    allTrials.sort((a, b) => {
      if (a.participantId !== b.participantId) {
        return a.participantId.localeCompare(b.participantId);
      }
      return String(a.submittedAt).localeCompare(String(b.submittedAt));
    });

    const csv = toCsv(allTrials);

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"completed_raw_trials.csv\""
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
