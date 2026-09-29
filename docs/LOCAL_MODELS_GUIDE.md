# Local Models & Inference Backends Guide

Peep is completely model-agnostic and backend-agnostic. Whether you run a local quantized model on an Apple Silicon laptop, a high-throughput vLLM instance on an NVIDIA GPU workstation, or a private remote server in your home lab, Peep connects via standard OpenAI-compatible endpoints or native Ollama protocols.

---

## 💡 Simplified Model Architecture: Do I need separate VLM and SLM?

**No! You only need a single model (or no model at all for common tasks).**

Historically, developer tooling separated visual tasks (VLM) from language tasks (SLM). With modern local models, this separation is no longer necessary:

1. **Single Unified Model by Default**: A single multimodal model handles screen coordinate grounding, visual verification assertions, and log anomaly summarization.
2. **Zero-Configuration Auto-Detection (`model: "auto"`)**: By default, Peep queries your running server (`/v1/models` or `/api/tags`) and automatically binds to whichever model is actively loaded. You don't even have to configure a model name!
3. **Optional Specialization**: If and only if you deliberately want two distinct models (for example, a larger multimodal model for spatial reasoning and a tiny 2B model for high-speed log filtering), Peep provides optional `visionModel` and `textModel` overrides. If omitted, both inherit from `model`.

---

## ❓ Is a Local Model Mandatory? (Default Fallbacks)

**No, a local model is NOT mandatory for standard UI automation!**

Peep incorporates a multi-tier fallback architecture:

### 1. Deterministic Tier 0 Hierarchy Grounding (~15ms, 0 AI Tokens, 0 Models Needed)
When you call `peep_find_and_tap` or `peep tap "Sign In"`, Peep defaults to `strategy: "auto"`:
- It first extracts the platform's native accessibility hierarchy (`uiautomator dump` on Android, DOM on browser, accessibility tree on desktop).
- It performs semantic matching against element text, accessibility labels (`content-desc`), or resource IDs.
- If found, it calculates physical coordinates and dispatches the touch event immediately.
- **Latency is ~15ms, cost is $0, and no local inference model is invoked.**

### 2. Deterministic Log & Crash Filtering (< 2ms, 0 AI Tokens, 0 Models Needed)
Peep's circular ring-buffer monitors incoming logcat streams and applies high-speed regex filters to catch fatal exceptions, ANRs, and SIGSEGVs. This watchdog operates synchronously and deterministically without requiring any model.

### 3. When IS a Local Model Used?
The local model is only invoked when:
- **Visual Grounding is Required**: The target element is a custom-drawn canvas, Flutter widget, game view, or an unlabelled graphic icon that does not appear in the accessibility tree.
- **Visual Assertions**: You explicitly call `peep_assert_screen_state` or `peep assert "Order confirmation is visible"` to visually inspect screen pixels.
- **High-Level Log Summaries**: You request an AI-generated natural language summary of a complex stack trace.

---

## 🚀 Serving Backends

### 1. Ollama (Simplest 1-Click Setup)
[Ollama](https://ollama.ai) runs across macOS, Linux, and Windows:

```bash
# Pull and run your preferred multimodal model:
ollama run llama3.2-vision

# Or any vision-capable model of your choice
```

In your `peep.yaml`:
```yaml
provider:
  type: "ollama"
  baseUrl: "http://localhost:11434"
  model: "auto" # Auto-detects the running model
```

Or via environment variables:
```bash
export PEEP_PROVIDER_TYPE=ollama
export PEEP_BASE_URL=http://localhost:11434
export PEEP_MODEL=auto
```

---

### 2. LM Studio (Visual Desktop Server)
[LM Studio](https://lmstudio.ai) provides a desktop GUI for loading GGUF weights with full GPU acceleration:

1. Download any vision-capable GGUF model in LM Studio.
2. Go to the **Local Server** tab and click **Start Server** (default port: `1234`).
3. Configure `peep.yaml`:
```yaml
provider:
  type: "openai"
  baseUrl: "http://localhost:1234/v1"
  model: "auto"
```

---

### 3. llama.cpp (`llama-server`)
For bare-metal C++ inference with minimal memory footprint:

```bash
# Start server with multimodal projector:
llama-server \
  -m ./models/your-multimodal-model.gguf \
  --mmproj ./models/your-mmproj.gguf \
  --port 11434 \
  --ctx-size 4096 \
  --n-gpu-layers 99
```

Configure `peep.yaml`:
```yaml
provider:
  type: "openai"
  baseUrl: "http://localhost:11434/v1"
  model: "auto"
```

---

### 4. vLLM (High-Throughput Multi-GPU)
For teams or shared CI/CD build environments hosting high-throughput inference on internal servers:

```bash
vllm serve your-multimodal-model \
  --port 8000 \
  --tensor-parallel-size 1 \
  --max-model-len 4096 \
  --trust-remote-code
```

Configure `peep.yaml`:
```yaml
provider:
  type: "openai"
  baseUrl: "http://localhost:8000/v1"
  model: "auto"
```

---

### 5. Private Cloud or OpenRouter Endpoints
If running on a low-spec laptop without local GPU acceleration, you can point Peep to a private remote server or hosted endpoint:

```yaml
provider:
  type: "openai"
  baseUrl: "https://openrouter.ai/api/v1"
  apiKey: "sk-..."
  model: "your-preferred-model"
```

Even when pointing to an external endpoint, **Peep protects your coding harness**: your coding agent in Antigravity or Cursor receives only compact coordinates (~40 tokens) instead of burning thousands of tokens per screenshot in its main reasoning context.

---

## 🩺 Validating Your Setup

Run Peep Doctor to instantly verify device connectivity and model response:

```bash
npx peep-mcp doctor
```

Peep will query your connected targets, ping your inference endpoint, display measured round-trip latencies, and confirm that both visual perception and log filtering are operational.
