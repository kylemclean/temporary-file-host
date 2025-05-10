import Env from "../_env";

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(context.request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = await context.env.db
    .prepare("SELECT name, size FROM file WHERE id = ? AND expires_at > ?")
    .bind(id, new Date().getTime())
    .first<{ name: string; size: number } | null>();

  if (!result) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { name, size } = result;

  return new Response(JSON.stringify({ name, size }), {
    headers: {
      "Content-Type": "application/json",
    },
  });
};
