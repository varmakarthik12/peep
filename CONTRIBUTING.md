# Contributing to Peep 🛡️

Thank you for your interest in contributing to **Peep**! 

Peep exists to solve a massive real-world problem: preventing AI coding agents from burning millions of expensive cloud tokens on low-level peripheral perception (finding buttons in screenshots, reading GC logs). By offloading these tasks to local models and native UI accessibility trees, we keep developer agents fast, affordable, and focused on high-level engineering.

Whether you're fixing a bug, adding a new inference backend, improving coordinate calibration, or adding support for new coding harnesses, we welcome your contributions.

---

## Code of Conduct

We are committed to providing a welcoming, inclusive, and harassment-free environment for everyone. Please treat all contributors with empathy, respect, and constructive collaboration.

---

## Development Setup

### Prerequisites
- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Android SDK / ADB** (optional for mock unit tests, required for physical device testing)
- **Ollama** or **llama.cpp** (optional for unit tests, required for live inference tests)

### 1. Clone & Install
```bash
git clone https://github.com/varmakarthik12/peep.git
cd peep
npm install
```

### 2. Build & Watch Mode
```bash
# Continuous build during development:
npm run dev

# Production build:
npm run build
```

### 3. Run Tests
We use [Vitest](https://vitest.dev) for high-speed unit and integration testing.
```bash
# Run test suite once:
npm test

# Run tests in watch mode:
npm run test:watch

# Type check across the repository:
npm run typecheck
```

---

## Project Architecture

The codebase is organized into modular layers under `src/`:

```
src/
├── cli.ts                     # Standalone CLI interface (peep tap, peep assert, peep logs)
├── index.ts                   # Library entry point & programmatic exports
├── config/                    # YAML / Environment configuration loader & Zod schemas
│   ├── index.ts
│   └── schema.ts
├── core/                      # Core token-shield algorithms
│   ├── coordinate-mapper.ts   # Normalized [0,1000] -> physical pixel scaling & rotation
│   ├── gesture-engine.ts      # Directional swipe calculation & humanized touch jitter
│   ├── macro-runner.ts        # Autonomous local micro-loop execution engine
│   └── token-shield.ts        # Telemetry accumulator & token savings tracking
├── providers/                 # Inference backend adapters
│   ├── base.ts                # BaseInferenceProvider abstract class
│   ├── ollama.ts              # Native Ollama HTTP client adapter
│   └── openai-compatible.ts   # vLLM / llama.cpp / LM Studio / OpenRouter adapter
├── server/                    # MCP (Model Context Protocol) Server
│   ├── index.ts               # Stdio MCP server initialization
│   └── tools.ts               # MCP tool registrations (peep_find_and_tap, etc.)
├── targets/                   # Peripheral targets
│   ├── base.ts                # BaseTarget abstract contract
│   └── android/               # Android ADB implementation
│       ├── adb-client.ts      # ADB process runner & device query
│       ├── logcat-tailer.ts   # Circular ring buffer & regex noise filter
│       ├── screencap.ts       # Zero-copy binary screencap capture
│       └── ui-hierarchy.ts    # uiautomator XML parser & semantic search
└── utils/                     # Formatting, tables, banners, and logging
    ├── formatting.ts
    └── logger.ts
```

---

## Adding New Features

### Adding a New Inference Provider
To support a new local or cloud inference provider:
1. Inherit from `BaseInferenceProvider` in `src/providers/base.ts`.
2. Implement:
   - `checkHealth(): Promise<ProviderHealth>`
   - `groundElement(prompt: string, screenshotBase64: string): Promise<GroundingResult>`
   - `assertCondition(condition: string, screenshotBase64: string): Promise<AssertionResult>`
   - `summarizeLogAnomalies(logs: string[]): Promise<LogAnalysisResult>`
3. Register your provider in `src/providers/index.ts`.
4. Add corresponding unit tests under `tests/providers.test.ts`.

### Adding a New Target Adapter (e.g. Browser / Playwright)
To support a new peripheral target:
1. Inherit from `BaseTarget` in `src/targets/base.ts`.
2. Implement:
   - `init()`, `close()`
   - `getDisplayMetrics()`
   - `captureScreenshot()`
   - `tap(x, y)`, `typeText(text)`, `swipe(coords)`, `pressKey(key)`
   - `getRecentLogs(filterPattern)`
3. Register the target type in `src/targets/index.ts` and `src/config/schema.ts`.

---

## Pull Request Guidelines

1. **Keep Pull Requests Focused**: A PR should address a single feature or bug fix.
2. **Include Tests**: Add unit tests in `tests/` covering new logic or bug reproductions.
3. **Verify Clean Passes**:
   ```bash
   npm run typecheck
   npm test
   npm run build
   ```
4. **Commit Conventions**: Use clear, conventional commit messages:
   - `feat: add support for LM Studio provider`
   - `fix: correct coordinate letterboxing for landscape tablets`
   - `docs: improve Cursor rules setup instructions`

---

## License

By contributing to Peep, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
