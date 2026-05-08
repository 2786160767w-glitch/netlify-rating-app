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

function isParticipantCompleted(trials, targetMap) {
  const countMap = {};
  for (const t of trials) {
    countMap[t.dimension] = (countMap[t.dimension] || 0) + 1;
  }

  for (const dimKey of Object.keys(targetMap)) {
    if ((countMap[dimKey] || 0) < targetMap[dimKey]) {
      return false;
    }
  }
  return true;
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
    const participantsStore = getStore("participants");

    const participantTrials =
      (await trialsStore.get(participantId, { type: "json" })) || [];

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
    await trialsStore.setJSON(participantId, participantTrials);

    const sessionData = await sessionsStore.get(participantId, { type: "json" });
    if (sessionData && sessionData.redoMap && sessionData.redoMap[dimension]) {
      delete sessionData.redoMap[dimension];
      await sessionsStore.setJSON(participantId, sessionData);
    }

    const statsKey = `stats_${dimension}`;
    const rawStats = await metaStore.get(statsKey, { type: "json" });
    const stats = rawStats || initStats();

    stats.imageCounts[leftImage] = (stats.imageCounts[leftImage] || 0) + 1;
    stats.imageCounts[rightImage] = (stats.imageCounts[rightImage] || 0) + 1;
    stats.pairCounts[record.pairKey] = (stats.pairCounts[record.pairKey] || 0) + 1;

    await metaStore.setJSON(statsKey, stats);

    const participantMeta = await participantsStore.get(participantId, { type: "json" });
    if (!participantMeta) {
      throw new Error("participant meta not found");
    }

    const completed = isParticipantCompleted(
      participantTrials,
      participantMeta.targetMap || {}
    );

    participantMeta.completed = completed;
    participantMeta.completedAt = completed ? new Date().toISOString() : null;
    await participantsStore.setJSON(participantId, participantMeta);

    return new Response(
      JSON.stringify({
        ok: true,
        completed
      }),
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
