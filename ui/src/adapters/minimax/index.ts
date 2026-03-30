import type { UIAdapterModule } from "../types";
import { parseMinimaxStdoutLine } from "@paperclipai/adapter-minimax/ui";
import { buildMinimaxConfig } from "@paperclipai/adapter-minimax/ui";
import { MinimaxConfigFields } from "./config-fields";

export const minimaxUIAdapter: UIAdapterModule = {
  type: "minimax",
  label: "MiniMax",
  parseStdoutLine: parseMinimaxStdoutLine,
  ConfigFields: MinimaxConfigFields,
  buildAdapterConfig: buildMinimaxConfig,
};
