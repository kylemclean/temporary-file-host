import Env from "./_env";

export async function validateTurnstile(token: string, ip: string, env: Env) {
  const verifyFormData = new FormData();
  verifyFormData.append("secret", env.TURNSTILE_SECRET);
  verifyFormData.append("response", token);
  if (ip) verifyFormData.append("remoteip", ip);

  const verifyResponse = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: verifyFormData,
    }
  );
  const verifyResult = await verifyResponse.json();
  if (
    typeof verifyResult === "object" &&
    verifyResult &&
    "success" in verifyResult &&
    verifyResult.success
  ) {
    return true;
  }

  return false;
}
