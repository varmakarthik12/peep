import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "../src/utils/logger.js";

describe("Logger", () => {
  let consoleSpy: any;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    logger.setLevel("info");
  });

  it("filters out debug messages at info level", () => {
    logger.setLevel("info");
    logger.debug("hidden debug");
    expect(consoleSpy).not.toHaveBeenCalled();

    logger.info("visible info");
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("logs debug messages when level is debug", () => {
    logger.setLevel("debug");
    logger.debug("visible debug");
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("logs success and shield at info level", () => {
    logger.setLevel("info");
    logger.success("task ok");
    expect(consoleSpy).toHaveBeenCalledTimes(1);

    logger.shield("shielded 1600 tokens");
    expect(consoleSpy).toHaveBeenCalledTimes(2);
  });

  it("only logs errors when level is error", () => {
    logger.setLevel("error");
    logger.debug("no");
    logger.info("no");
    logger.warn("no");
    expect(consoleSpy).not.toHaveBeenCalled();

    logger.error("fatal error");
    expect(consoleSpy).toHaveBeenCalledTimes(1);
  });

  it("silences all logs when level is silent", () => {
    logger.setLevel("silent");
    logger.debug("no");
    logger.info("no");
    logger.warn("no");
    logger.error("no");
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
