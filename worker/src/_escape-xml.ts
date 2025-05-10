export function escapeXml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("'", "&apos;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\r", "&#x0D;")
    .replaceAll("\n", "&#x0A;");
}
