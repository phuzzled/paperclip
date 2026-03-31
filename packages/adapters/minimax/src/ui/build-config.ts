import type { CreateConfigValues } from "@paperclipai/adapter-utils";

export function buildMinimaxConfig(v: CreateConfigValues): Record<string, unknown> {
  const ac: Record<string, unknown> = {};
  if (v.apiKey) ac.apiKey = v.apiKey;
  ac.model = v.model || "MiniMax-M2.7";
  ac.baseUrl = "https://api.minimax.io/anthropic";
  ac.timeoutSec = 120;
  return ac;
}
