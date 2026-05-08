import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  try {
    const url = new URL(req.url);
    const password = url.searchParams.get("password") || "";
    const adminPassword = process.env.ADMIN_PASSWORD || "";

    if (!adminPassword || password !== adminPassword) {
      return new Response("Unauthorized", { status: 401 });
    }

    const participantsStore = getStore("participants");
    const sessionsStore = getStore("sessions");
    const trialsStore = getStore("trials");
    const metaStore = getStore("meta");

    const deleteAll = async (store) => {
      const listed = await store.list();
      for (const item of listed.blobs) {
        await store.delete(item.key);
      }
    };

    await deleteAll(participantsStore);
    await deleteAll(sessionsStore);
    await deleteAll(trialsStore);
    await deleteAll(metaStore);

    return new Response(
      JSON.stringify({
        ok: true,
        message: "All participant, session, trial, and stats data have been cleared."
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "reset-data function failed",
        message: String(error)
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};
