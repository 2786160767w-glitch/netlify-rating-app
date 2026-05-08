import { getStore } from "@netlify/blobs";

function pairKey(a, b) {
  return [a, b].sort().join("__");
}

function initStats(images = []) {
  const imageCounts = {};
  images.forEach((img) => {
    imageCounts[img] = 0;
  });
  return {
    imageCounts,
    pairCounts: {}
  };
}

export default async (req, context) => {
  try {
    const body = await req.json();
    const {
      participantId,
      dimension,
      leftImage,
      rightImage,
      choice,
      servedAt
    } = body;

    const chosenImage = choice === "left" ? leftImage : rightImage;
    const submittedAt = new Date().toISOString();
    const rt = Math.max(
      0,
      (new Date(submittedAt).getTime() - new Date(servedAt).getTime()) / 1000
    );

    const trialsStore = getStore("trials");
    const sessionsStore = getStore("sessions");
    const metaStore = getStore("meta");
    const exportStore = getStore("exports");

    const raw = await trialsStore.get(participantId);
    const participantTrials = raw ? JSON.parse(raw) : [];

    const record = {
      participantId,
      dimension,
      leftImage,
      rightImage,
      choice,
      chosenImage,
      servedAt,
      submittedAt,
      responseTime: rt,
      pairKey: pairKey(leftImage, rightImage)
    };

    participantTrials.push(record);
    await trialsStore.set(participantId, JSON.stringify(participantTrials));

    const rawSession = await sessionsStore.get(participantId);
    const sessionData = rawSession ? JSON.parse(rawSession) : null;
    if (sessionData && sessionData.redoMap && sessionData.redoMap[dimension]) {
      delete sessionData.redoMap[dimension];
      await sessionsStore.set(participantId, JSON.stringify(sessionData));
    }

    const statsKey = `stats_${dimension}`;
    const rawStats = await metaStore.get(statsKey);
    const stats = rawStats ? JSON.parse(rawStats) : initStats();

    stats.imageCounts[leftImage] = (stats.imageCounts[leftImage] || 0) + 1;
    stats.imageCounts[rightImage] = (stats.imageCounts[rightImage] || 0) + 1;
    stats.pairCounts[record.pairKey] = (stats.pairCounts[record.pairKey] || 0) + 1;

    await metaStore.set(statsKey, JSON.stringify(stats));

    const rawExport = await exportStore.get("rawTrials");
    const allTrials = rawExport ? JSON.parse(rawExport) : [];
    allTrials.push(record);
    await exportStore.set("rawTrials", JSON.stringify(allTrials));

    return new Response(
      JSON.stringify({ ok: true }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "submit-trial function failed",
        message: String(error)
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};
