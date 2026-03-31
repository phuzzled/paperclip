import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";
import { asString, parseObject } from "@paperclipai/adapter-utils/server-utils";

const DEFAULT_BASE_URL = "https://api.minimax.io/anthropic";
const DEFAULT_MODEL = "MiniMax-M2.7";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);

  const apiKey = asString(config.apiKey, "").trim();
  const model = asString(config.model, DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  const baseUrl = asString(config.baseUrl, DEFAULT_BASE_URL).trim() || DEFAULT_BASE_URL;

  if (!apiKey) {
    checks.push({
      code: "minimax_api_key_missing",
      level: "error",
      message: "MiniMax adapter requires an API key.",
      hint: "Set adapterConfig.apiKey to your MiniMax API key.",
    });
    return {
      adapterType: ctx.adapterType,
      status: summarizeStatus(checks),
      checks,
      testedAt: new Date().toISOString(),
    };
  }

  checks.push({
    code: "minimax_api_key_present",
    level: "info",
    message: "API key is configured.",
  });

  checks.push({
    code: "minimax_model_configured",
    level: "info",
    message: `Model: ${model}`,
  });

  checks.push({
    code: "minimax_base_url",
    level: "info",
    message: `Base URL: ${baseUrl}`,
  });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok || response.status === 400) {
      checks.push({
        code: "minimax_api_reachable",
        level: "info",
        message: "MiniMax API is reachable and credentials are valid.",
      });
    } else if (response.status === 401 || response.status === 403) {
      checks.push({
        code: "minimax_api_auth_failed",
        level: "error",
        message: `MiniMax API authentication failed (HTTP ${response.status}).`,
        hint: "Check that your API key is correct.",
      });
    } else {
      checks.push({
        code: "minimax_api_unexpected_status",
        level: "warn",
        message: `MiniMax API returned unexpected status ${response.status}.`,
        hint: "The API may be temporarily unavailable or the base URL may be incorrect.",
      });
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      checks.push({
        code: "minimax_api_timeout",
        level: "warn",
        message: "MiniMax API probe timed out.",
        hint: "Verify network reachability and base URL from the Paperclip server host.",
      });
    } else {
      const message = err instanceof Error ? err.message : String(err);
      checks.push({
        code: "minimax_api_probe_error",
        level: "warn",
        message: `MiniMax API probe failed: ${message}`,
        hint: "Verify network reachability and base URL from the Paperclip server host.",
      });
    }
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
