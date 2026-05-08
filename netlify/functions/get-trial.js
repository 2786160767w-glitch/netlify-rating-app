import { getStore } from "@netlify/blobs";

function pairKey(a, b) {
  return [a, b].sort().join("__");
}

export default async (req, context) => {
  try {
    const body = await req.json();
    const { participantId, dimension, images, targetTrials } = body;

    const trialsStore = getStore("trials");
    const raw = await trialsStore.get(participantId);
    const participantTrials = raw ? JSON.parse(raw) : [];

    const dimTrials = participantTrials.filter(t => t.dimension === dimension);

    if (dimTrials.length >= targetTrials) {
      return new Response(
        JSON.stringify({ doneDimension: true }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const seenPairs = new Set(dimTrials.map(t => t.pairKey));
    let leftImage = null;
    let rightImage = null;

    for (let i = 0; i < 100; i++) {
      const a = images[Math.floor(Math.random() * images.length)];
      const b = images[Math.floor(Math.random() * images.length)];
      if (a === b) continue;
      const pk = pairKey(a, b);
      if (seenPairs.has(pk)) continue;
      leftImage = a;
      rightImage = b;
      break;
    }

    if (!leftImage || !rightImage) {
      leftImage = images[0];
      rightImage = images[1];
    }

    return new Response(
      JSON.stringify({
        leftImage,
        rightImage,
        servedAt: new Date().toISOString(),
        progress: dimTrials.length + 1,
        total: targetTrials
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
