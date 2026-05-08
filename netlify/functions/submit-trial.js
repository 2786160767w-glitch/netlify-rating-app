import { getStore } from "@netlify/blobs";

function pairKey(a, b) {
  return [a, b].sort().join("__");
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
    const raw = await trialsStore.get(participantId);
    const participantTrials = raw ? JSON.parse(raw) : [];

    participantTrials.push({
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
    });

    await trialsStore.set(participantId, JSON.stringify(participantTrials));

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
