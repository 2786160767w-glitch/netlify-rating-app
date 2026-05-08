import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  try {
    const body = await req.json();
    const { participantId, dimension } = body;

    const trialsStore = getStore("trials");
    const sessionsStore = getStore("sessions");
    const metaStore = getStore("meta");
    const exportStore = getStore("exports");

    const raw = await trialsStore.get(participantId);
    const participantTrials = raw ? JSON.parse(raw) : [];

    let lastIndex = -1;
    for (let i = participantTrials.length - 1; i >= 0; i--) {
      if (participantTrials[i].dimension === dimension) {
        lastIndex = i;
        break;
      }
    }

    if (lastIndex === -1) {
      return new Response(
        JSON.stringify({ ok: false, message: "没有可退回的记录" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const removed = participantTrials[lastIndex];
    participantTrials.splice(lastIndex, 1);
    await trialsStore.set(participantId, JSON.stringify(participantTrials));

    const rawSession = await sessionsStore.get(participantId);
    const sessionData = rawSession ? JSON.parse(rawSession) : null;
    if (sessionData) {
      if (!sessionData.redoMap) sessionData.redoMap = {};
      sessionData.redoMap[dimension] = {
        leftImage: removed.leftImage,
        rightImage: removed.rightImage
      };
      await sessionsStore.set(participantId, JSON.stringify(sessionData));
    }

    const statsKey = `stats_${dimension}`;
    const rawStats = await metaStore.get(statsKey);
    const stats = rawStats ? JSON.parse(rawStats) : { imageCounts: {}, pairCounts: {} };

    stats.imageCounts[removed.leftImage] = Math.max(0, (stats.imageCounts[removed.leftImage] || 0) - 1);
    stats.imageCounts[removed.rightImage] = Math.max(0, (stats.imageCounts[removed.rightImage] || 0) - 1);
    stats.pairCounts[removed.pairKey] = Math.max(0, (stats.pairCounts[removed.pairKey] || 0) - 1);

    await metaStore.set(statsKey, JSON.stringify(stats));

    const rawExport = await exportStore.get("rawTrials");
    const allTrials = rawExport ? JSON.parse(rawExport) : [];
    for (let i = allTrials.length - 1; i >= 0; i--) {
      const t = allTrials[i];
      if (
        t.participantId === removed.participantId &&
        t.dimension === removed.dimension &&
        t.submittedAt === removed.submittedAt
      ) {
        allTrials.splice(i, 1);
        break;
      }
    }
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
        error: "undo-trial function failed",
        message: String(error)
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};
