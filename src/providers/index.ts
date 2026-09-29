import { BaseInferenceProvider } from "./base.js";
import { OpenAICompatibleProvider } from "./openai-compatible.js";
import { OllamaProvider } from "./ollama.js";
import { InferenceProviderConfig } from "../config/schema.js";

export function createProvider(
  config: InferenceProviderConfig
): BaseInferenceProvider {
  if (config.type === "ollama") {
    return new OllamaProvider(config);
  }
  return new OpenAICompatibleProvider(config);
}

export * from "./base.js";
export * from "./openai-compatible.js";
export * from "./ollama.js";
