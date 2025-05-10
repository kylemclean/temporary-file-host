import { z } from "zod";
import type Env from "../_env";
import { createAws } from "../_aws";
import { validateTurnstile } from "../_turnstile";
import { maxFileSize } from "../../src/file-size";

const schema = z.object({
  name: z.string().max(260),
  size: z.number().int().min(0).max(maxFileSize),
  expiryTimeHours: z.number().int().min(1).max(168),
  "cf-turnstile-response": z.string(),
});

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
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
  const {
    name,
    size,
    expiryTimeHours,
    "cf-turnstile-response": token,
  } = parseResult.data;

  if (
    !(await validateTurnstile(
      token,
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

  const aws = createAws(context.env);

  const id = crypto.randomUUID();
  const nowMs = new Date().getTime();

  await context.env.db
    .prepare(
      "INSERT INTO file (id, name, size, created_at, expires_at) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(id, name, size, nowMs, nowMs + expiryTimeHours * 60 * 60 * 1000)
    .run();

  const uploadUrl = await aws
    .sign(
      `${context.env.S3_BUCKET_URL}/${encodeURIComponent(id)}?X-Amz-Expires=60`,
      {
        method: "PUT",
        aws: {
          signQuery: true,
          service: "s3",
        },
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": size.toString(),
        },
      }
    )
    .then((r) => r.url);

  return new Response(JSON.stringify({ id, uploadUrl }), {
    headers: {
      "Content-Type": "application/json",
    },
  });
};
