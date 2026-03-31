import type { TranscriptEntry } from "@paperclipai/adapter-utils";

export function parseMinimaxStdoutLine(line: string, ts: string): TranscriptEntry[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[minimax] Error:") || trimmed.startsWith("[minimax] Request failed:")) {
    return [{ kind: "stderr", ts, text: trimmed }];
  }

  if (trimmed.startsWith("[minimax]")) {
    return [{ kind: "system", ts, text: trimmed.replace(/^\[minimax\]\s*/, "") }];
  }

  return [{ kind: "assistant", ts, text: line }];
}
