import { getStore } from "@netlify/blobs";

export default async (req) => {
  const body = JSON.parse(req.body || "{}");
  const participantId = "P" + Math.floor(Math.random() * 900000 + 100000);

  const participantsStore = getStore("participants");
  const sessionsStore = getStore("sessions");

  await participantsStore.setJSON(participantId, {
    participantId,
    majorType: body.majorType,
    grade: body.grade,
    note: body.note || "",
    createdAt: new Date().toISOString()
  });

  await sessionsStore.setJSON(participantId, {
    participantId,
    images: body.images || [],
    dimensions: body.dimensions || [],
    startedAt: new Date().toISOString()
  });

  return new Response(
    JSON.stringify({ participantId }),
    { headers: { "Content-Type": "application/json" } }
  );
};