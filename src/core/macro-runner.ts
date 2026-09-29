import { BaseInferenceProvider, MacroActionStep } from "../providers/base.js";
import { BaseTarget } from "../targets/base.js";
import { CoordinateMapper } from "./coordinate-mapper.js";
import { GestureEngine } from "./gesture-engine.js";
import { tokenShield } from "./token-shield.js";
import { logger } from "../utils/logger.js";

export interface MacroResult {
  status: "SUCCESS" | "FAILED" | "MAX_STEPS_REACHED";
  goal: string;
  stepsExecuted: number;
  history: string[];
  cloudTokensSaved: number;
  durationMs: number;
  error?: string;
}

export class MacroRunner {
  private provider: BaseInferenceProvider;
  private target: BaseTarget;
  private mapper: CoordinateMapper;

  constructor(
    provider: BaseInferenceProvider,
    target: BaseTarget,
    mapper: CoordinateMapper
  ) {
    this.provider = provider;
    this.target = target;
    this.mapper = mapper;
  }

  async runGoal(goal: string, maxSteps = 8): Promise<MacroResult> {
    const startTime = Date.now();
    const history: string[] = [];
    logger.info(`Starting autonomous micro-loop for goal: "${goal}" (max ${maxSteps} steps)`);

    for (let step = 0; step < maxSteps; step++) {
      // 1. Capture current frame
      const frame = await this.target.captureScreenshot();

      // 2. Query local VLM
      const decision = await this.provider.decideNextAction(
        goal,
        step,
        history,
        frame.base64
      );

      logger.debug(`Step ${step + 1} thought: ${decision.thought}`);
      logger.info(`Step ${step + 1} action: ${decision.action}`);

      if (decision.action === "done") {
        history.push(`Step ${step + 1}: Done (${decision.thought})`);
        const saved = tokenShield.recordShieldedMacro(step + 1);
        return {
          status: "SUCCESS",
          goal,
          stepsExecuted: step + 1,
          history,
          cloudTokensSaved: saved,
          durationMs: Date.now() - startTime,
        };
      }

      if (decision.action === "fail") {
        history.push(`Step ${step + 1}: Failed (${decision.thought})`);
        const saved = tokenShield.recordShieldedMacro(step + 1);
        return {
          status: "FAILED",
          goal,
          stepsExecuted: step + 1,
          history,
          cloudTokensSaved: saved,
          durationMs: Date.now() - startTime,
          error: decision.thought,
        };
      }

      // Execute action
      try {
        await this.executeStep(decision, frame.width, frame.height);
        history.push(
          `Step ${step + 1}: ${decision.action} ${decision.point ? `[${decision.point.x},${decision.point.y}]` : ""} ${decision.text || decision.direction || decision.key || ""}`
        );
      } catch (err) {
        history.push(`Step ${step + 1}: Error executing action: ${err}`);
      }

      // Check crash watchdog
      const crashCheck = await this.target.checkCrashWatchdog();
      if (crashCheck.hasCrashed) {
        const saved = tokenShield.recordShieldedMacro(step + 1);
        return {
          status: "FAILED",
          goal,
          stepsExecuted: step + 1,
          history,
          cloudTokensSaved: saved,
          durationMs: Date.now() - startTime,
          error: `Crash detected during macro execution: ${crashCheck.reason}`,
        };
      }

      // Wait 1 second for animations/transitions
      await new Promise((r) => setTimeout(r, 1000));
    }

    const saved = tokenShield.recordShieldedMacro(maxSteps);
    return {
      status: "MAX_STEPS_REACHED",
      goal,
      stepsExecuted: maxSteps,
      history,
      cloudTokensSaved: saved,
      durationMs: Date.now() - startTime,
    };
  }

  private async executeStep(
    step: MacroActionStep,
    frameWidth: number,
    frameHeight: number
  ): Promise<void> {
    if (step.action === "tap" && step.point) {
      const phys = this.mapper.toPhysicalPoint(step.point, {
        frameWidth,
        frameHeight,
        jitter: true,
      });
      await this.target.tap(phys.x, phys.y);
    } else if (step.action === "type") {
      if (step.point) {
        const phys = this.mapper.toPhysicalPoint(step.point, {
          frameWidth,
          frameHeight,
        });
        await this.target.tap(phys.x, phys.y);
        await new Promise((r) => setTimeout(r, 300));
      }
      if (step.text) {
        await this.target.typeText(step.text);
      }
    } else if (step.action === "swipe" && step.direction) {
      const metrics = this.mapper.getMetrics();
      const coords = GestureEngine.calculateSwipe(
        metrics.width,
        metrics.height,
        step.direction,
        "medium"
      );
      await this.target.swipe(coords);
    } else if (step.action === "key" && step.key) {
      await this.target.pressKey(step.key);
    } else if (step.action === "wait") {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}
