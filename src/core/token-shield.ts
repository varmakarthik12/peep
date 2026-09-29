export interface TokenShieldMetrics {
  totalActions: number;
  screenshotsShielded: number;
  logLinesShielded: number;
  macroStepsShielded: number;
  cloudTokensSaved: number;
  cloudTokensUsed: number;
  estimatedCostSavedUsd: number;
  netTokenSavingsPercentage: number;
}

export class TokenShield {
  private static instance: TokenShield;

  private totalActions = 0;
  private screenshotsShielded = 0;
  private logLinesShielded = 0;
  private macroStepsShielded = 0;
  private cloudTokensSaved = 0;
  private cloudTokensUsed = 0;

  // Industry averages for Cloud Multimodal Models (Gemini Pro, Claude Sonnet, GPT-4o)
  public static readonly TOKENS_PER_IMAGE = 1600;
  public static readonly TOKENS_PER_LOG_LINE = 14;
  public static readonly COST_PER_1M_CLOUD_TOKENS = 5.0; // $5.00 per million tokens

  private constructor() {}

  static getInstance(): TokenShield {
    if (!TokenShield.instance) {
      TokenShield.instance = new TokenShield();
    }
    return TokenShield.instance;
  }

  /**
   * Records a shielded screenshot.
   * If a cloud model had to process this image, it would burn ~1600 vision tokens.
   */
  recordShieldedScreenshot(payloadTokensReturnedToCloud = 60): number {
    this.totalActions++;
    this.screenshotsShielded++;
    const saved = TokenShield.TOKENS_PER_IMAGE;
    this.cloudTokensSaved += saved;
    this.cloudTokensUsed += payloadTokensReturnedToCloud;
    return saved;
  }

  /**
   * Records shielded log lines.
   */
  recordShieldedLogs(rawLinesCount: number, summaryTokensReturned = 50): number {
    this.totalActions++;
    this.logLinesShielded += rawLinesCount;
    const saved = rawLinesCount * TokenShield.TOKENS_PER_LOG_LINE;
    this.cloudTokensSaved += saved;
    this.cloudTokensUsed += summaryTokensReturned;
    return saved;
  }

  /**
   * Records an autonomous local micro-loop execution.
   */
  recordShieldedMacro(stepsCount: number, summaryTokensReturned = 120): number {
    this.totalActions += stepsCount;
    this.macroStepsShielded += stepsCount;
    // Each step saved an image + reasoning prompt
    const savedPerStep = TokenShield.TOKENS_PER_IMAGE + 300;
    const totalSaved = stepsCount * savedPerStep;
    this.cloudTokensSaved += totalSaved;
    this.cloudTokensUsed += summaryTokensReturned;
    return totalSaved;
  }

  getMetrics(): TokenShieldMetrics {
    const savingsPercentage =
      this.cloudTokensSaved > 0
        ? ((this.cloudTokensSaved - this.cloudTokensUsed) / this.cloudTokensSaved) * 100
        : 100;

    const estimatedCostSavedUsd =
      (this.cloudTokensSaved / 1_000_000) * TokenShield.COST_PER_1M_CLOUD_TOKENS;

    return {
      totalActions: this.totalActions,
      screenshotsShielded: this.screenshotsShielded,
      logLinesShielded: this.logLinesShielded,
      macroStepsShielded: this.macroStepsShielded,
      cloudTokensSaved: this.cloudTokensSaved,
      cloudTokensUsed: this.cloudTokensUsed,
      estimatedCostSavedUsd: Number(estimatedCostSavedUsd.toFixed(4)),
      netTokenSavingsPercentage: Number(Math.max(0, savingsPercentage).toFixed(1)),
    };
  }

  reset(): void {
    this.totalActions = 0;
    this.screenshotsShielded = 0;
    this.logLinesShielded = 0;
    this.macroStepsShielded = 0;
    this.cloudTokensSaved = 0;
    this.cloudTokensUsed = 0;
  }
}

export const tokenShield = TokenShield.getInstance();
