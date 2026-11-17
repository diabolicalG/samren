export function convertSrtToWebVtt(input: string): string {
  const normalized = String(input ?? "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  const output: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (/^\s*\d+\s*$/.test(line)) {
      let next = index + 1;
      while (next < lines.length && !lines[next]?.trim()) next += 1;
      if (/^\s*\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+\d{2}:\d{2}:\d{2},\d{3}/.test(lines[next] ?? "")) continue;
    }
    output.push(line.includes("-->")
      ? line.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")
      : line);
  }
  const cues = output.join("\n").trim();
  if (!/\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}/.test(cues)) {
    throw new Error("Subtitle file does not contain valid SubRip cues");
  }
  return "WEBVTT\n\n" + cues + "\n";
}
