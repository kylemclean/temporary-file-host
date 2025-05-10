import { AwsClient } from "aws4fetch";

export function createAws({
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
}: {
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
}) {
  return new AwsClient({
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  });
}
