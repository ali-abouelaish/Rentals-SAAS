export async function copyToClipboard(text: string) {
  if (typeof navigator === "undefined") return;
  await navigator.clipboard.writeText(text);
}
