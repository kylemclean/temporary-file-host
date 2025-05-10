/**
 * Welcome to Cloudflare Workers! This is your first scheduled worker.
 *
 * - Run `wrangler dev --local` in your terminal to start a development server
 * - Run `curl "http://localhost:8787/cdn-cgi/mf/scheduled"` to trigger the scheduled event
 * - Go back to the console to see what your worker has logged
 * - Update the Cron trigger in wrangler.toml (see https://developers.cloudflare.com/workers/wrangler/configuration/#triggers)
 * - Run `wrangler publish --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/runtime-apis/scheduled-event/
 */

import * as htmlparser2 from "htmlparser2";
import { escapeXml } from "./_escape-xml";
import { createAws } from "../../functions/_aws";
import { ElementType } from "htmlparser2";
import type { Element, Text } from "domhandler";

export interface Env {
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  S3_BUCKET_URL: string;

  db: D1Database;
}

export default {
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    const uploadsToDelete = await env.db
      .prepare("SELECT id FROM file WHERE expires_at < ?")
      .bind(new Date().getTime())
      .all<{ id: string }>();
    if (!uploadsToDelete.results) {
      throw new Error("Failed to fetch expired uploads");
    }

    if (uploadsToDelete.results.length === 0) {
      console.log("No expired uploads to delete");
      return;
    }

    const aws = createAws(env);

    const deleteRequestBody = `
<?xml version="1.0" encoding="UTF-8"?>
<Delete xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  ${uploadsToDelete.results
    .map(
      ({ id }) => `
  <Object>
    <Key>${escapeXml(id)}</Key>
  </Object>
  `
    )
    .join("\n")}
</Delete>`.trim();
    const deleteResponse = await aws.fetch(`${env.S3_BUCKET_URL}/?delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/xml",
        Accept: "application/xml",
      },
      body: deleteRequestBody,
    });
    if (!deleteResponse.ok) {
      throw new Error(
        `Failed to delete expired uploads: ${await deleteResponse.text()}`
      );
    }

    const deleteResponseDocument = htmlparser2.parseDocument(
      await deleteResponse.text(),
      { xmlMode: true }
    );
    const deleteResult = deleteResponseDocument.children.find(
      (child): child is Element =>
        child.type === ElementType.Tag && child.name === "DeleteResult"
    );
    const deletedIds =
      deleteResult?.children
        .filter(
          (child): child is Element =>
            child.type === ElementType.Tag && child.name === "Deleted"
        )
        .map((deleted) => {
          const key = deleted.children.find(
            (child): child is Element =>
              child.type === ElementType.Tag && child.name === "Key"
          );
          if (!key) {
            throw new Error("Failed to find Key element");
          }
          const text = key.children.find(
            (child): child is Text => child.type === ElementType.Text
          );
          if (!text) {
            throw new Error("Failed to find text node");
          }
          return text.data;
        }) ?? [];

    await env.db
      .prepare(
        `DELETE FROM file WHERE id IN (${deletedIds.map(() => "?").join(", ")})`
      )
      .bind(...deletedIds)
      .run();

    console.log(`Deleted ${deletedIds}`);
  },
};
