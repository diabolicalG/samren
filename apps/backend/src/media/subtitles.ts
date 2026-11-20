export function convertSrtToWebVtt(input: string): string {
  const normalized = String(input ?? "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const withoutCueNumbers = normalized.replace(
    /(^|\n)[\t ]*\d+[\t ]*\n(?=\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+\d{2}:\d{2}:\d{2},\d{3})/g,
    "$1",
  );
  const cues = withoutCueNumbers
    .split("\n")
    .map((line) => line.includes("-->")
      ? line.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")
      : line)
    .join("\n")
    .trim();
  if (!/\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}/.test(cues)) {
    throw new Error("Subtitle file does not contain valid SubRip cues");
  }
  return "WEBVTT\n\n" + cues + "\n";
}
