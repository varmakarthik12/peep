# Local Models & Inference Backends Guide

Peep is completely backend-agnostic. Whether you run an ultra-compact quantized model on a MacBook Air, a high-throughput vLLM instance on an RTX 4090, or a remote server in your home lab, Peep connects via standard OpenAI-compatible endpoints or native Ollama protocols.

---

## 1. Recommended Model Stack

Peep splits workloads between two specialized model tiers:
1. **Vision-Language Model (VLM)**: Inspects screenshots, resolves bounding boxes and normalized coordinates $[0, 1000]$, and evaluates visual assertions (`peep_assert_screen_state`).
2. **Small Language Model (SLM)**: Rapidly parses accessibility JSON and filters thousands of lines of raw logcat into 3-line crash diagnostics (`peep_tail_and_filter_logs`).

| Role | Recommended Model | Parameters | Quantization | Minimum VRAM | Why It Excels |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary VLM** | **Qwen2.5-VL** | 7B | Q4_K_M / Int4 | 6 GB | Unrivaled spatial grounding precision, parses dense mobile text accurately. |
| **Compact VLM** | **Qwen2.5-VL** | 3B | Q4_K_M | 3.5 GB | Runs smoothly on entry-level laptops, fast inference (~300ms). |
| **Agentic VLM** | **UI-TARS** | 7B | Q4_K_M / BF16| 7 GB | Specifically fine-tuned on GUI interaction datasets (ByteDance). |
| **Primary SLM** | **Gemma 2 / Gemma 3**| 2B / 4B | Q4_K_M | 2 GB | Blazing fast token generation (~80 tok/s), pinpoint crash extraction. |
| **Power SLM** | **Qwen2.5** | 7B / 3B | Q4_K_M | 4 GB | Exceptional reasoning for complex UI tree resolution. |

---

## 2. Hardware & VRAM Sizing Matrix

| Hardware Setup | Recommended VLM | Recommended SLM | Total VRAM Required |
| :--- | :--- | :--- | :--- |
| **Apple Silicon (8GB - 16GB Unified)** | Qwen2.5-VL (3B or 7B Q4) | Gemma 2B (Q4) | ~5.5 GB |
| **Apple Silicon (32GB+ Unified)** | Qwen2.5-VL (7B BF16) | Qwen2.5 7B (Q8) | ~14 GB |
| **NVIDIA RTX 3060 / 4060 (8GB - 12GB)** | Qwen2.5-VL (7B Q4) | Gemma 2B (Q4) | ~7.2 GB |
| **NVIDIA RTX 4070 / 4080 (16GB)** | Qwen2.5-VL (7B Q8 / FP16) | Gemma 2B / 7B | ~12 GB |
| **NVIDIA RTX 3090 / 4090 (24GB)** | Qwen2.5-VL (7B FP16) + UI-TARS | Qwen2.5 7B | ~18 GB |
| **CPU Only (x86_64 / ARM)** | Qwen2.5-VL 3B (Q4) | Gemma 2B (Q4) | 4 GB RAM (Inference ~1.5s) |

---

## 3. Serving Backends

### 3.1 Ollama (Simplest Setup)
[Ollama](https://ollama.ai) is the easiest way to serve local models on macOS, Linux, and Windows.

```bash
# 1. Pull the models
ollama pull qwen2.5-vl:7b
ollama pull gemma:2b

# 2. Keep models in VRAM for instant response (optional)
ollama run qwen2.5-vl:7b ""
```

Configure `peep.yaml`:
```yaml
provider:
  type: "ollama"
  baseUrl: "http://localhost:11434"
  vlmModel: "qwen2.5-vl:7b"
  slmModel: "gemma:2b"
```

Or via environment variables:
```bash
export PEEP_PROVIDER_TYPE=ollama
export PEEP_BASE_URL=http://localhost:11434
export PEEP_VLM_MODEL=qwen2.5-vl:7b
export PEEP_SLM_MODEL=gemma:2b
```

---

### 3.2 LM Studio (Visual 1-Click Server)
[LM Studio](https://lmstudio.ai) provides a polished GUI for loading GGUF weights with full GPU acceleration.

1. Download **Qwen2.5-VL-7B-Instruct-GGUF** and **gemma-2-2b-it-GGUF** inside LM Studio.
2. Navigate to the **Developer / Local Server** tab.
3. Select `Qwen2.5-VL-7B` and click **Start Server** (default port: `1234`).
4. Configure `peep.yaml`:
```yaml
provider:
  type: "openai"
  baseUrl: "http://localhost:1234/v1"
  vlmModel: "qwen2.5-vl-7b-instruct"
```

---

### 3.3 llama.cpp (`llama-server`)
For bare-metal C++ performance with minimal memory overhead:

```bash
# Start server with multimodal projector for vision:
llama-server \
  -m ./models/qwen2.5-vl-7b-instruct-q4_k_m.gguf \
  --mmproj ./models/qwen2.5-vl-7b-mmproj-f16.gguf \
  --port 11434 \
  --ctx-size 4096 \
  --n-gpu-layers 99
```

Configure `peep.yaml`:
```yaml
provider:
  type: "openai"
  baseUrl: "http://localhost:11434/v1"
  vlmModel: "qwen2.5-vl"
```

---

### 3.4 vLLM (High Throughput & Multi-GPU)
For teams or CI/CD test runners hosting inference on an internal server or workstation:

```bash
vllm serve Qwen/Qwen2.5-VL-7B-Instruct \
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
  vlmModel: "Qwen/Qwen2.5-VL-7B-Instruct"
```

---

### 3.5 Remote GPU Box / OpenRouter Fallback
If you don't have a local GPU on your laptop, you can point Peep to a remote server in your home lab or an affordable remote provider (e.g. OpenRouter):

```yaml
provider:
  type: "openai"
  baseUrl: "https://openrouter.ai/api/v1"
  apiKey: "sk-or-v1-..."
  vlmModel: "qwen/qwen-2.5-vl-7b-instruct"
```

Even when pointing to an external endpoint, **Peep shields your primary coding harness**: your coding agent in Cursor or Antigravity receives only minimal coordinates and summary telemetry, completely shielding its reasoning context window.

---

## 4. Validating Your Setup
To verify that Peep can communicate with your local inference backend:

```bash
npx peep-mcp doctor
```

Peep will ping your model endpoint, measure round-trip latency, and confirm that image vision grounding and text completions are functional.
