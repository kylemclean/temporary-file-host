export async function urlChecksum(id: string, key: Uint8Array, iv: Uint8Array) {
  const checksum = (
    await crypto.subtle.digest(
      "SHA-256",
      await new Blob([new TextEncoder().encode(id), key, iv]).arrayBuffer()
    )
  ).slice(0, 8);
  return checksum;
}
