import { getStore } from "@netlify/blobs";

function pairKey(a, b) {
  return [a, b].sort().join("__");
}

function initStats(images) {
  const imageCounts = {};
  images.forEach((img) => {
    imageCounts[img] = 0;
  });
  return {
    imageCounts,
    pairCounts: {}
  };
}

function chooseControlledPair(images, dimTrials, stats) {
  const seenPairs = new Set(dimTrials.map((t) => t.pairKey));
  let best = null;
  let bestScore = Infinity;

  for (let i = 0; i < 200; i++) {
    const a = images[Math.floor(Math.random() * images.length)];
    const b = images[Math.floor(Math.random() * images.length)];
    if (a === b) continue;

    const pk = pairKey(a, b);
    if (seenPairs.has(pk)) continue;

    const aCount = stats.imageCounts[a] ?? 0;
    const bCount = stats.imageCounts[b] ?? 0;
    const pairRepeat = stats.pairCounts[pk] ?? 0;

    const score =
      aCount +
      bCount +
      pairRepeat * 20 +
      Math.abs(aCount - bCount) * 3;

    if (score < bestScore) {
      bestScore = score;
      best = { leftImage: a, rightImage: b };
    }
  }

  if (best) return best;

  if (images.length >= 2) {
    return { leftImage: images[0], rightImage: images[1] };
  }

  throw new Error("图片数量不足");
}

export default async (req, context) => {
  try {
    const body = await req.json();
    const { participantId, dimension, images, targetTrials } = body;

    const trialsStore = getStore("trials");
    const sessionsStore = getStore("sessions");
    const metaStore = getStore("meta");

    const rawTrials = await trialsStore.get(participantId, { type: "json" });
    const participantTrials = rawTrials || [];
    const dimTrials = participantTrials.filter((t) => t.dimension === dimension);

    if (dimTrials.length >= targetTrials) {
      return new Response(
        JSON.stringify({ doneDimension: true }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const sessionData = await sessionsStore.get(participantId, { type: "json" });
    if (!sessionData) {
      throw new Error("session not found");
    }

    if (sessionData.redoMap && sessionData.redoMap[dimension]) {
      const redoTrial = sessionData.redoMap[dimension];
      return new Response(
        JSON.stringify({
          leftImage: redoTrial.leftImage,
          rightImage: redoTrial.rightImage,
          servedAt: new Date().toISOString(),
          progress: dimTrials.length + 1,
          total: targetTrials,
          canUndo: dimTrials.length > 0
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const statsKey = `stats_${dimension}`;
    const rawStats = await metaStore.get(statsKey, { type: "json" });
    let stats = rawStats || initStats(images);

    images.forEach((img) => {
      if (stats.imageCounts[img] === undefined) {
        stats.imageCounts[img] = 0;
      }
    });

    const pair = chooseControlledPair(images, dimTrials, stats);

    return new Response(
      JSON.stringify({
        leftImage: pair.leftImage,
        rightImage: pair.rightImage,
        servedAt: new Date().toISOString(),
        progress: dimTrials.length + 1,
        total: targetTrials,
        canUndo: dimTrials.length > 0
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "get-trial function failed",
        message: String(error)
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};
