import { XMLParser } from "fast-xml-parser";
import { AdbClient } from "./adb-client.js";
import { SemanticElement } from "../base.js";
import { logger } from "../../utils/logger.js";

export class UiHierarchyParser {
  private adb: AdbClient;
  private parser: XMLParser;

  constructor(adb: AdbClient) {
    this.adb = adb;
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });
  }

  /**
   * Dumps UI hierarchy and returns flattened list of semantic elements.
   */
  async dumpHierarchy(): Promise<SemanticElement[]> {
    try {
      // Clean up any stale dump file before dumping
      try {
        await this.adb.shell(["rm", "-f", "/sdcard/peep_dump.xml"]);
      } catch {
        // ignore cleanup errors
      }

      // Dump to sdcard and read out
      await this.adb.shell(["uiautomator", "dump", "/sdcard/peep_dump.xml"]);
      const xml = await this.adb.shell(["cat", "/sdcard/peep_dump.xml"]);

      // Clean up dump file after reading
      try {
        await this.adb.shell(["rm", "-f", "/sdcard/peep_dump.xml"]);
      } catch {
        // ignore
      }

      if (!xml || !xml.includes("<hierarchy")) {
        return [];
      }

      const parsed = this.parser.parse(xml) as Record<string, unknown>;
      const elements: SemanticElement[] = [];

      const walk = (node: Record<string, unknown>) => {
        if (!node || typeof node !== "object") return;

        const boundsStr = String(node["@_bounds"] || "");
        // Bounds format: [0,0][1080,2400] or with negative coordinates [-50,0][500,100]
        const boundsMatch = boundsStr.match(/\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/);

        if (boundsMatch) {
          const left = parseInt(boundsMatch[1], 10);
          const top = parseInt(boundsMatch[2], 10);
          const right = parseInt(boundsMatch[3], 10);
          const bottom = parseInt(boundsMatch[4], 10);

          const text = String(node["@_text"] || "").trim();
          const contentDesc = String(node["@_content-desc"] || "").trim();
          const resourceId = String(node["@_resource-id"] || "").trim();
          const className = String(node["@_class"] || "").trim();
          const clickable = node["@_clickable"] === "true" || node["@_clickable"] === true;

          // Keep nodes that have identifying semantics or are clickable
          if (text || contentDesc || resourceId || clickable) {
            elements.push({
              id: resourceId || undefined,
              text: text || undefined,
              contentDescription: contentDesc || undefined,
              className: className || undefined,
              bounds: { left, top, right, bottom },
              clickable,
            });
          }
        }

        // Traverse children
        const children = node["node"];
        if (Array.isArray(children)) {
          for (const child of children) {
            walk(child as Record<string, unknown>);
          }
        } else if (children && typeof children === "object") {
          walk(children as Record<string, unknown>);
        }
      };

      if (parsed["hierarchy"] && typeof parsed["hierarchy"] === "object") {
        walk(parsed["hierarchy"] as Record<string, unknown>);
      }

      return elements;
    } catch (err) {
      logger.debug("Failed to dump or parse UI hierarchy:", err);
      return [];
    }
  }

  /**
   * Fast Tier 0 semantic search: looks for exact or partial matches in text,
   * content-description, or resource-id.
   */
  async findElement(query: string): Promise<SemanticElement | null> {
    const elements = await this.dumpHierarchy();
    const q = query.toLowerCase().trim();
    if (!q) return null;

    // 1. Exact matches
    for (const el of elements) {
      if (el.text && el.text.toLowerCase() === q) return el;
      if (el.contentDescription && el.contentDescription.toLowerCase() === q) return el;
      if (el.id && el.id.toLowerCase() === q) return el;
    }

    // 2. Partial / substring matches
    for (const el of elements) {
      if (el.text && el.text.toLowerCase().includes(q)) return el;
      if (el.contentDescription && el.contentDescription.toLowerCase().includes(q)) return el;
      if (el.id && el.id.toLowerCase().includes(q)) return el;
    }

    return null;
  }
}
