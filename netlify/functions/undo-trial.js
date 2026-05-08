import { getStore } from "@netlify/blobs";

function recountCompleted(trials, targetMap) {
  const countMap = {};
  for (const t of trials) {
    countMap[t.dimension] = (countMap[t.dimension] || 0) + 1;
  }

  for (const dimKey of Object.keys(targetMap || {})) {
    if ((countMap[dimKey] || 0) < targetMap[dimKey]) {
      return false;
    }
  }
  return true;
}

export default async (req, context) => {
  try {
    const body = await req.json();
    const { participantId, dimension, targetTrials } = body;

    const trialsStore = getStore("trials");
    const sessionsStore = getStore("sessions");
    const metaStore = getStore("meta");
    const participantsStore = getStore("participants");

    const participantTrials =
      (await trialsStore.get(participantId, { type: "json" })) || [];

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
    await trialsStore.setJSON(participantId, participantTrials);

    const sessionData = await sessionsStore.get(participantId, { type: "json" });
    if (sessionData) {
      if (!sessionData.redoMap) sessionData.redoMap = {};
      sessionData.redoMap[dimension] = {
        leftImage: removed.leftImage,
        rightImage: removed.rightImage
      };
      await sessionsStore.setJSON(participantId, sessionData);
    }

    const statsKey = `stats_${dimension}`;
    const stats =
      (await metaStore.get(statsKey, { type: "json" })) || {
        imageCounts: {},
        pairCounts: {}
      };

    stats.imageCounts[removed.leftImage] = Math.max(
      0,
      (stats.imageCounts[removed.leftImage] || 0) - 1
    );
    stats.imageCounts[removed.rightImage] = Math.max(
      0,
      (stats.imageCounts[removed.rightImage] || 0) - 1
    );
    stats.pairCounts[removed.pairKey] = Math.max(
      0,
      (stats.pairCounts[removed.pairKey] || 0) - 1
    );

    await metaStore.setJSON(statsKey, stats);

    const participantMeta = await participantsStore.get(participantId, { type: "json" });
    if (participantMeta) {
      participantMeta.completed = recountCompleted(
        participantTrials,
        participantMeta.targetMap || {}
      );
      participantMeta.completedAt = participantMeta.completed
        ? participantMeta.completedAt
        : null;
      await participantsStore.setJSON(participantId, participantMeta);
    }

    const dimTrialsAfterUndo = participantTrials.filter((t) => t.dimension === dimension);

    return new Response(
      JSON.stringify({
        ok: true,
        leftImage: removed.leftImage,
        rightImage: removed.rightImage,
        servedAt: new Date().toISOString(),
        progress: dimTrialsAfterUndo.length + 1,
        total: targetTrials,
        canUndo: dimTrialsAfterUndo.length > 0
      }),
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
