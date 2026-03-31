import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
} from "@paperclipai/adapter-utils";
import {
  asNumber,
  asString,
  parseObject,
  readPaperclipRuntimeSkillEntries,
  resolvePaperclipDesiredSkillNames,
} from "@paperclipai/adapter-utils/server-utils";

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_BASE_URL = "https://api.minimax.io/anthropic";
const DEFAULT_MODEL = "MiniMax-M2.7";
const DEFAULT_TIMEOUT_SEC = 120;

function buildMessages(context: Record<string, unknown>): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];

  const wakeText = asString(context.wakeText, "");
  if (wakeText) {
    messages.push({ role: "user", content: wakeText });
  } else {
    messages.push({ role: "user", content: "Hello" });
  }

  return messages;
}

const SKILL_SEPARATOR = "\n\n---\n\n";

async function buildSkillsContent(
  config: Record<string, unknown>,
  onLog: AdapterExecutionContext["onLog"],
): Promise<string> {
  const availableEntries = await readPaperclipRuntimeSkillEntries(config, __moduleDir);
  const desiredSkills = resolvePaperclipDesiredSkillNames(config, availableEntries);
  const desiredSet = new Set(desiredSkills);
  const sections: string[] = [];
  for (const entry of availableEntries) {
    if (!desiredSet.has(entry.key)) continue;
    try {
      const content = await fs.readFile(path.join(entry.source, "SKILL.md"), "utf8");
      sections.push(content.trim());
    } catch (err) {
      await onLog("stderr", `[minimax] Warning: could not read SKILL.md for skill "${entry.key}": ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }
  return sections.join(SKILL_SEPARATOR);
}

async function buildSystemPrompt(
  config: Record<string, unknown>,
  context: Record<string, unknown>,
  onLog: AdapterExecutionContext["onLog"],
): Promise<string | null> {
  const configSystem = asString(config.systemPrompt, "").trim();
  const contextSystem = asString(context.systemPrompt, "").trim();
  const basePrompt = configSystem || contextSystem || "";

  const skillsContent = await buildSkillsContent(config, onLog);

  if (!basePrompt && !skillsContent) return null;
  if (!skillsContent) return basePrompt;
  if (!basePrompt) return skillsContent;
  return `${basePrompt}${SKILL_SEPARATOR}${skillsContent}`;
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const config = parseObject(ctx.config);
  const context = parseObject(ctx.context);

  const apiKey = asString(config.apiKey, "").trim();
  const model = asString(config.model, DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  const baseUrl = asString(config.baseUrl, DEFAULT_BASE_URL).trim() || DEFAULT_BASE_URL;
  const timeoutSec = asNumber(config.timeoutSec, DEFAULT_TIMEOUT_SEC);
  const systemPrompt = await buildSystemPrompt(config, context, ctx.onLog);

  if (!apiKey) {
    const msg = "[minimax] Error: apiKey is required in adapter configuration.\n";
    await ctx.onLog("stderr", msg);
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: "MiniMax apiKey is not configured.",
      errorCode: "minimax_api_key_missing",
    };
  }

  const messages = buildMessages(context);

  const requestBody: Record<string, unknown> = {
    model,
    max_tokens: 4096,
    messages,
  };
  if (systemPrompt) {
    requestBody.system = systemPrompt;
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutSec * 1000);

  try {
    await ctx.onLog("stdout", `[minimax] Invoking model ${model} at ${baseUrl}\n`);

    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutHandle);

    const responseText = await response.text();

    if (!response.ok) {
      const msg = `[minimax] API error ${response.status}: ${responseText}\n`;
      await ctx.onLog("stderr", msg);
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorMessage: `MiniMax API returned status ${response.status}`,
        errorCode: "minimax_api_error",
      };
    }

    let parsed: Record<string, unknown>;
    try {
      const raw = JSON.parse(responseText);
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        throw new Error("unexpected response shape");
      }
      parsed = raw as Record<string, unknown>;
    } catch {
      const msg = `[minimax] Failed to parse API response: ${responseText}\n`;
      await ctx.onLog("stderr", msg);
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorMessage: "MiniMax API response could not be parsed.",
        errorCode: "minimax_parse_error",
      };
    }

    const contentBlocks = Array.isArray(parsed.content) ? parsed.content : [];
    let assistantText = "";
    for (const block of contentBlocks) {
      if (
        typeof block === "object" &&
        block !== null &&
        !Array.isArray(block) &&
        (block as Record<string, unknown>).type === "text"
      ) {
        assistantText += asString((block as Record<string, unknown>).text, "");
      }
    }

    if (assistantText) {
      await ctx.onLog("stdout", assistantText + "\n");
    }

    const usage = parseObject(parsed.usage);
    const inputTokens = asNumber(usage.input_tokens, 0);
    const outputTokens = asNumber(usage.output_tokens, 0);

    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      model,
      provider: "minimax",
      usage:
        inputTokens > 0 || outputTokens > 0
          ? { inputTokens, outputTokens }
          : undefined,
    };
  } catch (err) {
    clearTimeout(timeoutHandle);
    if (err instanceof Error && err.name === "AbortError") {
      await ctx.onLog("stderr", `[minimax] Request timed out after ${timeoutSec}s\n`);
      return {
        exitCode: 1,
        signal: null,
        timedOut: true,
        errorMessage: `MiniMax request timed out after ${timeoutSec}s`,
        errorCode: "minimax_timeout",
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    await ctx.onLog("stderr", `[minimax] Request failed: ${message}\n`);
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: message,
      errorCode: "minimax_request_failed",
    };
  }
}
