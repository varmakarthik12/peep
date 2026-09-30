import { BaseTarget, SemanticElement, ScreenFrame } from "../base.js";
import { DisplayMetrics } from "../../core/coordinate-mapper.js";
import { SwipeCoordinates } from "../../core/gesture-engine.js";
import { logger } from "../../utils/logger.js";

export interface DistilledElement {
  refId: string;
  tag: string;
  role?: string;
  text?: string;
  selector: string;
  bounds?: { left: number; top: number; right: number; bottom: number };
}

export interface BrowserNavigateResult {
  url: string;
  title: string;
  status: number;
}

export class BrowserTarget extends BaseTarget {
  readonly name = "browser";
  override isReady = false;
  override readonly scaffoldNotice =
    "Browser target requires Playwright browser binaries or an active Chrome remote debugging instance. Run 'npx playwright install chromium' or connect to an existing browser.";

  private browser: any = null;
  private page: any = null;
  private context: any = null;
  private consoleLogs: string[] = [];
  private maxLogBuffer = 100;

  async init(): Promise<void> {
    logger.info("Initializing Browser target adapter with playwright-core...");
    try {
      const playwright = await import("playwright-core");
      // Try to connect to existing Chrome debugging port first (default 9222)
      try {
        this.browser = await playwright.chromium.connectOverCDP("http://127.0.0.1:9222", {
          timeout: 2000,
        });
        const contexts = this.browser.contexts();
        this.context = contexts.length > 0 ? contexts[0] : await this.browser.newContext();
        const pages = this.context.pages();
        this.page = pages.length > 0 ? pages[0] : await this.context.newPage();
        this.setupListeners();
        this.isReady = true;
        logger.info("Connected to existing Chrome remote debugging session on port 9222.");
        return;
      } catch {
        // CDP connect failed, try launch
      }

      // Try launching Chromium headless
      this.browser = await playwright.chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 800 },
      });
      this.page = await this.context.newPage();
      this.setupListeners();
      this.isReady = true;
      logger.info("Launched headless Chromium browser instance.");
    } catch (err) {
      logger.debug(
        `Browser target launch deferred: ${err instanceof Error ? err.message : String(err)}. ${this.scaffoldNotice}`
      );
      this.isReady = false;
    }
  }

  private setupListeners(): void {
    if (!this.page) return;
    this.page.on("console", (msg: any) => {
      const type = msg.type();
      if (type === "error" || type === "warning") {
        this.consoleLogs.push(`[console.${type}] ${msg.text()}`);
        if (this.consoleLogs.length > this.maxLogBuffer) {
          this.consoleLogs.shift();
        }
      }
    });

    this.page.on("pageerror", (err: Error) => {
      this.consoleLogs.push(`[uncaughtException] ${err.message}`);
      if (this.consoleLogs.length > this.maxLogBuffer) {
        this.consoleLogs.shift();
      }
    });

    this.page.on("response", (res: any) => {
      if (res.status() >= 400) {
        this.consoleLogs.push(`[network ${res.status()}] ${res.url()}`);
        if (this.consoleLogs.length > this.maxLogBuffer) {
          this.consoleLogs.shift();
        }
      }
    });
  }

  async getDisplayMetrics(): Promise<DisplayMetrics> {
    if (this.page) {
      const size = this.page.viewportSize() || { width: 1280, height: 800 };
      return { width: size.width, height: size.height, rotation: 0 };
    }
    return { width: 1280, height: 800, rotation: 0 };
  }

  async captureScreenshot(): Promise<ScreenFrame> {
    if (!this.page) {
      throw new Error("Browser target not initialized. Please ensure Chromium is available.");
    }
    const buffer = await this.page.screenshot({ type: "png" });
    const metrics = await this.getDisplayMetrics();
    return {
      buffer,
      base64: buffer.toString("base64"),
      width: metrics.width,
      height: metrics.height,
    };
  }

  async navigate(url: string, waitForLoad = true, timeoutMs = 30000): Promise<BrowserNavigateResult> {
    if (!this.page) {
      // Lazy init if needed
      await this.init();
      if (!this.page) {
        throw new Error(
          `Cannot navigate: ${this.scaffoldNotice}`
        );
      }
    }

    const response = await this.page.goto(url, {
      waitUntil: waitForLoad ? "domcontentloaded" : "commit",
      timeout: timeoutMs,
    });

    return {
      url: this.page.url(),
      title: await this.page.title(),
      status: response ? response.status() : 200,
    };
  }

  async getDistilledDom(selector = "body", maxDepth = 5): Promise<DistilledElement[]> {
    if (!this.page) {
      return [];
    }

    return this.page.evaluate(
      ({ sel, depth }: { sel: string; depth: number }) => {
        const root = document.querySelector(sel) || document.body;
        const interactiveTags = new Set(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]);
        const interactiveRoles = new Set(["button", "link", "checkbox", "radio", "textbox", "tab", "menuitem"]);
        const results: DistilledElement[] = [];
        let counter = 1;

        function traverse(el: Element, currentDepth: number) {
          if (currentDepth > depth) return;
          const tagName = el.tagName;
          if (["SCRIPT", "STYLE", "SVG", "NOSCRIPT"].includes(tagName)) return;

          const role = el.getAttribute("role");
          const isInteractive =
            interactiveTags.has(tagName) ||
            (role && interactiveRoles.has(role)) ||
            el.hasAttribute("onclick") ||
            el.getAttribute("tabindex") === "0";

          if (isInteractive) {
            const rect = el.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0;
            if (isVisible) {
              const text =
                (el as HTMLElement).innerText?.trim().slice(0, 80) ||
                el.getAttribute("aria-label") ||
                el.getAttribute("placeholder") ||
                (el as HTMLInputElement).value ||
                "";
              const id = el.id ? `#${el.id}` : `ref-${counter++}`;
              results.push({
                refId: id,
                tag: tagName.toLowerCase(),
                role: role || undefined,
                text: text || undefined,
                selector: el.id
                  ? `#${el.id}`
                  : `${tagName.toLowerCase()}${el.className ? "." + el.className.trim().split(/\s+/).join(".") : ""}`,
                bounds: {
                  left: Math.round(rect.left),
                  top: Math.round(rect.top),
                  right: Math.round(rect.right),
                  bottom: Math.round(rect.bottom),
                },
              });
            }
          }

          for (const child of Array.from(el.children)) {
            traverse(child, currentDepth + 1);
          }
        }

        traverse(root, 0);
        return results;
      },
      { sel: selector, depth: maxDepth }
    );
  }

  async getSemanticHierarchy(): Promise<SemanticElement[]> {
    const distilled = await this.getDistilledDom();
    return distilled.map((d) => ({
      text: d.text,
      id: d.refId,
      bounds: d.bounds || { left: 0, top: 0, right: 0, bottom: 0 },
      isClickable: true,
      className: d.tag,
    }));
  }

  override async findSemanticElement(query: string): Promise<SemanticElement | null> {
    const list = await this.getSemanticHierarchy();
    const q = query.toLowerCase();
    for (const item of list) {
      if (item.text && item.text.toLowerCase().includes(q)) return item;
      if (item.id && item.id.toLowerCase().includes(q)) return item;
    }
    return null;
  }

  async tap(x: number, y: number): Promise<void> {
    if (this.page) {
      await this.page.mouse.click(x, y);
    }
  }

  async swipe(coords: SwipeCoordinates): Promise<void> {
    if (this.page) {
      await this.page.mouse.move(coords.startX, coords.startY);
      await this.page.mouse.down();
      await this.page.mouse.move(coords.endX, coords.endY, { steps: 5 });
      await this.page.mouse.up();
    }
  }

  async typeText(text: string): Promise<void> {
    if (this.page) {
      await this.page.keyboard.type(text);
    }
  }

  async pressKey(key: string): Promise<void> {
    if (this.page) {
      const keyMap: Record<string, string> = {
        back: "Backspace",
        enter: "Enter",
        tab: "Tab",
        escape: "Escape",
        space: "Space",
      };
      await this.page.keyboard.press(keyMap[key.toLowerCase()] || key);
    }
  }

  async getRecentLogs(filter?: string): Promise<string[]> {
    if (!filter) return [...this.consoleLogs];
    try {
      const regex = new RegExp(filter, "i");
      return this.consoleLogs.filter((l) => regex.test(l));
    } catch {
      const lower = filter.toLowerCase();
      return this.consoleLogs.filter((l) => l.toLowerCase().includes(lower));
    }
  }

  async checkCrashWatchdog(): Promise<{ hasCrashed: boolean; reason?: string }> {
    const errors = this.consoleLogs.filter((l) => l.includes("[uncaughtException]"));
    if (errors.length > 0) {
      return { hasCrashed: true, reason: errors[errors.length - 1] };
    }
    return { hasCrashed: false };
  }

  resetCrashWatchdog(): void {
    this.consoleLogs = this.consoleLogs.filter((l) => !l.includes("[uncaughtException]"));
  }

  async close(): Promise<void> {
    try {
      if (this.context) await this.context.close();
      if (this.browser) await this.browser.close();
    } catch {
      // ignore
    }
    this.page = null;
    this.context = null;
    this.browser = null;
    this.isReady = false;
  }
}
