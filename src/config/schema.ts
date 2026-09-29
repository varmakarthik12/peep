import { z } from "zod";

export const InferenceProviderConfigSchema = z.object({
  type: z.enum(["openai", "ollama"]).default("openai"),
  baseUrl: z.string().default("http://localhost:11434/v1"),
  apiKey: z.string().optional(),
  vlmModel: z.string().default("qwen2.5-vl:7b"),
  slmModel: z.string().default("gemma:2b"),
  timeoutMs: z.number().int().positive().default(45000),
  temperature: z.number().min(0).max(2).default(0.1),
});

export const TargetConfigSchema = z.object({
  type: z.enum(["android", "browser", "desktop"]).default("android"),
  deviceId: z.string().optional(),
  adbPath: z.string().default("adb"),
  scrcpyPath: z.string().optional(),
});

export const PerceptionConfigSchema = z.object({
  strategy: z
    .enum(["auto", "tree_first", "vision_only", "tree_only"])
    .default("auto"),
  confidenceThreshold: z.number().min(0).max(1).default(0.7),
  coordinateScale: z.number().int().default(1000),
});

export const LogsConfigSchema = z.object({
  ringBufferSize: z.number().int().positive().default(2000),
  filterNoise: z.boolean().default(true),
  watchdog: z.boolean().default(true),
  maxAnomalyLines: z.number().int().positive().default(10),
});

export const PeepConfigSchema = z.object({
  provider: InferenceProviderConfigSchema.default({}),
  target: TargetConfigSchema.default({}),
  perception: PerceptionConfigSchema.default({}),
  logs: LogsConfigSchema.default({}),
  logLevel: z
    .enum(["debug", "info", "warn", "error", "silent"])
    .default("info"),
});

export type PeepConfig = z.infer<typeof PeepConfigSchema>;
export type InferenceProviderConfig = z.infer<
  typeof InferenceProviderConfigSchema
>;
export type TargetConfig = z.infer<typeof TargetConfigSchema>;
export type PerceptionConfig = z.infer<typeof PerceptionConfigSchema>;
export type LogsConfig = z.infer<typeof LogsConfigSchema>;
