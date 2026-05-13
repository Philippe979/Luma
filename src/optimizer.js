export function optimizerState() {
  return {
    mode: "standby",
    provider: "semantic",
    enabled: false
  };
}

export function optimizePrompt({ prompt }) {
  return {
    prompt,
    optimized: false,
    originalTokens: estimateTokens(prompt),
    optimizedTokens: estimateTokens(prompt),
    savedTokens: 0
  };
}

function estimateTokens(text) {
  return Math.ceil(String(text || "").length * 0.6);
}
