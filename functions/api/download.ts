import { z } from "zod";
import { createAws } from "../_aws";
import Env from "../_env";
import { validateTurnstile } from "../_turnstile";

const schema = z.object({
  "cf-turnstile-response": z.string(),
});

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== "POST") {
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

  const parseResult = schema.safeParse(await context.request.json());
  if (!parseResult.success) {
    return new Response(JSON.stringify({ error: parseResult.error }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  if (
    !(await validateTurnstile(
      parseResult.data["cf-turnstile-response"],
      context.request.headers.get("CF-Connecting-IP") ?? "",
      context.env
    ))
  ) {
    return new Response(
      JSON.stringify({ error: "Failed Turnstile validation" }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  const result = await context.env.db
    .prepare("SELECT 1 FROM file WHERE id = ? AND expires_at > ?")
    .bind(id, new Date().getTime())
    .first<1 | null>();

  if (!result) {
    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const aws = createAws(context.env);

  const downloadUrl = await aws
    .sign(
      `${context.env.S3_BUCKET_URL}/${encodeURIComponent(id)}?X-Amz-Expires=60`,
      {
        method: "GET",
        aws: {
          signQuery: true,
          service: "s3",
        },
      }
    )
    .then((r) => r.url);

  return fetch(downloadUrl);
};
