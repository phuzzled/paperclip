import pc from "picocolors";

export function printMinimaxStreamEvent(raw: string, debug: boolean): void {
  const line = raw.trim();
  if (!line) return;

  if (!debug) {
    console.log(line);
    return;
  }

  if (line.startsWith("[minimax]")) {
    console.log(pc.blue(line));
    return;
  }

  console.log(pc.gray(line));
}
