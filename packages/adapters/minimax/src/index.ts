export const type = "minimax";
export const label = "MiniMax";

export const models: { id: string; label: string }[] = [
  { id: "MiniMax-M2.7", label: "MiniMax-M2.7" },
];

export const agentConfigurationDoc = `# minimax agent configuration

Adapter: minimax

Use when:
- You want to invoke agents powered by the MiniMax LLM API.
- MiniMax uses the Anthropic-compatible API format.

Core fields:
- apiKey (string, required): MiniMax API key
- model (string, optional): model ID (default: MiniMax-M2.7)
- baseUrl (string, optional): API base URL (default: https://api.minimax.io/anthropic)
- timeoutSec (number, optional): request timeout in seconds (default: 120)
- systemPrompt (string, optional): system prompt override
`;
