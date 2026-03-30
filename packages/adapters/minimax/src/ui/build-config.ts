import type { CreateConfigValues } from "@paperclipai/adapter-utils";

export function buildMinimaxConfig(v: CreateConfigValues): Record<string, unknown> {
  const ac: Record<string, unknown> = {};
  // v.url is used as the API key in the create form
  if (v.url) ac.apiKey = v.url;
  ac.model = v.model || "MiniMax-M2.7";
  ac.baseUrl = "https://api.minimax.io/anthropic";
  ac.timeoutSec = 120;
  return ac;
}
