import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  try {
    const body = await req.json();

    const participantId = "P" + Math.floor(Math.random() * 900000 + 100000);

    const participantsStore = getStore("participants");
    const sessionsStore = getStore("sessions");
    const trialsStore = getStore("trials");

    const dimensions = body.dimensions || [];

    await participantsStore.setJSON(participantId, {
      participantId,
      majorType: body.majorType,
      grade: body.grade,
      note: body.note || "",
      createdAt: new Date().toISOString(),
      completed: false,
      completedAt: null,
      targetMap: Object.fromEntries(dimensions.map((d) => [d.key, d.targetTrials]))
    });

    await sessionsStore.setJSON(participantId, {
      participantId,
      images: body.images || [],
      dimensions,
      activeTrialMap: {},
      startedAt: new Date().toISOString()
    });

    await trialsStore.setJSON(participantId, []);

    return new Response(
      JSON.stringify({ participantId }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "start function failed",
        message: String(error)
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};
