export default interface Env {
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  S3_BUCKET_URL: string;
  TURNSTILE_SECRET: string;

  db: D1Database;
}
