import { PhysicalPoint } from "./coordinate-mapper.js";

export type SwipeDirection = "up" | "down" | "left" | "right";
export type SwipeDistance = "short" | "medium" | "long";

export interface SwipeCoordinates {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  durationMs: number;
}

export const ANDROID_KEYCODES: Record<string, number> = {
  home: 3,
  back: 4,
  call: 5,
  endcall: 6,
  dpad_up: 19,
  dpad_down: 20,
  dpad_left: 21,
  dpad_right: 22,
  dpad_center: 23,
  volume_up: 24,
  volume_down: 25,
  power: 26,
  camera: 27,
  clear: 28,
  tab: 61,
  space: 62,
  enter: 66,
  delete: 67,
  backspace: 67,
  menu: 82,
  search: 84,
  page_up: 92,
  page_down: 93,
  escape: 111,
  move_home: 122,
  move_end: 123,
  app_switch: 187,
};

export class GestureEngine {
  /**
   * Calculates smooth swipe start and end coordinates based on device dimensions.
   * e.g. "up" means swiping from bottom towards top (scrolling down).
   */
  static calculateSwipe(
    width: number,
    height: number,
    direction: SwipeDirection,
    distance: SwipeDistance = "medium",
    durationMs = 350
  ): SwipeCoordinates {
    const centerX = Math.round(width / 2);
    const centerY = Math.round(height / 2);

    let factor = 0.3; // medium: 30% of screen height/width
    if (distance === "short") factor = 0.15;
    if (distance === "long") factor = 0.5;

    let startX = centerX;
    let startY = centerY;
    let endX = centerX;
    let endY = centerY;

    switch (direction) {
      case "up":
        // Swiping finger UP moves content DOWN
        startY = Math.round(centerY + height * (factor / 2));
        endY = Math.round(centerY - height * (factor / 2));
        break;
      case "down":
        // Swiping finger DOWN moves content UP
        startY = Math.round(centerY - height * (factor / 2));
        endY = Math.round(centerY + height * (factor / 2));
        break;
      case "left":
        startX = Math.round(centerX + width * (factor / 2));
        endX = Math.round(centerX - width * (factor / 2));
        break;
      case "right":
        startX = Math.round(centerX - width * (factor / 2));
        endX = Math.round(centerX + width * (factor / 2));
        break;
    }

    return {
      startX: Math.max(0, Math.min(width, startX)),
      startY: Math.max(0, Math.min(height, startY)),
      endX: Math.max(0, Math.min(width, endX)),
      endY: Math.max(0, Math.min(height, endY)),
      durationMs,
    };
  }

  /**
   * Sanitizes text for ADB input text.
   * Replaces spaces with %s and escapes special shell characters.
   */
  static sanitizeAdbText(text: string): string {
    // ADB text needs spaces escaped as %s and shell metacharacters escaped
    return text
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      .replace(/&/g, "\\&")
      .replace(/</g, "\\<")
      .replace(/>/g, "\\>")
      .replace(/\|/g, "\\|")
      .replace(/;/g, "\\;")
      .replace(/\$/g, "\\$")
      .replace(/`/g, "\\`")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/ /g, "%s");
  }

  /**
   * Resolves key name to Android keycode number.
   */
  static resolveKeycode(keyName: string): number {
    const normalized = keyName.toLowerCase().trim().replace(/[- ]/g, "_");
    if (ANDROID_KEYCODES[normalized] !== undefined) {
      return ANDROID_KEYCODES[normalized];
    }
    const parsed = parseInt(keyName, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
    throw new Error(`Unknown Android key name: '${keyName}'. Supported: ${Object.keys(ANDROID_KEYCODES).join(", ")}`);
  }
}
