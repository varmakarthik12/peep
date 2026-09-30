import { describe, it, expect, vi } from "vitest";
import { UiHierarchyParser } from "../src/targets/android/ui-hierarchy.js";
import { AdbClient } from "../src/targets/android/adb-client.js";

describe("UiHierarchyParser", () => {
  const sampleXml = `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<hierarchy rotation="0">
  <node index="0" text="" resource-id="" class="android.widget.FrameLayout" bounds="[0,0][1080,2400]">
    <node index="0" text="Settings" resource-id="com.android.settings:id/title" class="android.widget.TextView" bounds="[100,200][400,280]" clickable="false" />
    <node index="1" text="Search settings" resource-id="com.android.settings:id/search_action_bar" class="android.widget.EditText" bounds="[100,320][980,440]" clickable="true" />
    <node index="2" text="" content-desc="Back" class="android.widget.ImageButton" bounds="[30,120][150,240]" clickable="true" />
    <node index="3" text="" resource-id="" class="android.view.View" bounds="[0,500][1080,600]" clickable="false" />
    <node index="4" text="" resource-id="" class="android.widget.Button" bounds="[100,700][300,800]" clickable="true" />
  </node>
</hierarchy>`;

  const createMockAdb = (xmlOutput: string, throws = false) => {
    return {
      shell: vi.fn().mockImplementation(async (cmd: string[]) => {
        if (throws) {
          throw new Error("ADB connection broken");
        }
        if (cmd[0] === "cat") {
          return xmlOutput;
        }
        return "";
      }),
    } as unknown as AdbClient;
  };

  describe("dumpHierarchy", () => {
    it("extracts semantic elements from uiautomator XML dump", async () => {
      const parser = new UiHierarchyParser(createMockAdb(sampleXml));
      const elements = await parser.dumpHierarchy();

      // Node index 3 has no text, no content-desc, no resource-id, and clickable="false", so it should be skipped.
      // Expected elements: Settings, Search settings, Back button, and anonymous clickable Button.
      expect(elements).toHaveLength(4);

      expect(elements[0]).toEqual({
        id: "com.android.settings:id/title",
        text: "Settings",
        contentDescription: undefined,
        className: "android.widget.TextView",
        bounds: { left: 100, top: 200, right: 400, bottom: 280 },
        clickable: false,
      });

      expect(elements[1]).toEqual({
        id: "com.android.settings:id/search_action_bar",
        text: "Search settings",
        contentDescription: undefined,
        className: "android.widget.EditText",
        bounds: { left: 100, top: 320, right: 980, bottom: 440 },
        clickable: true,
      });

      expect(elements[2]).toEqual({
        id: undefined,
        text: undefined,
        contentDescription: "Back",
        className: "android.widget.ImageButton",
        bounds: { left: 30, top: 120, right: 150, bottom: 240 },
        clickable: true,
      });

      expect(elements[3].clickable).toBe(true);
      expect(elements[3].className).toBe("android.widget.Button");
    });

    it("handles single nested child node object instead of array", async () => {
      const singleChildXml = `<?xml version='1.0' encoding='UTF-8' ?>
<hierarchy rotation="0">
  <node index="0" bounds="[0,0][1080,2400]">
    <node index="0" text="Single Child" bounds="[10,10][100,100]" clickable="true" />
  </node>
</hierarchy>`;
      const parser = new UiHierarchyParser(createMockAdb(singleChildXml));
      const elements = await parser.dumpHierarchy();

      expect(elements).toHaveLength(1);
      expect(elements[0].text).toBe("Single Child");
    });

    it("returns empty array when XML is empty or missing hierarchy tag", async () => {
      const parserEmpty = new UiHierarchyParser(createMockAdb(""));
      expect(await parserEmpty.dumpHierarchy()).toEqual([]);

      const parserGarbage = new UiHierarchyParser(createMockAdb("ERROR: uiautomator killed"));
      expect(await parserGarbage.dumpHierarchy()).toEqual([]);
    });

    it("returns empty array gracefully if ADB shell command throws an error", async () => {
      const parser = new UiHierarchyParser(createMockAdb("", true));
      const elements = await parser.dumpHierarchy();
      expect(elements).toEqual([]);
    });
  });

  describe("findElement Tier 0 Semantic Search", () => {
    it("finds element by exact text match (case-insensitive)", async () => {
      const parser = new UiHierarchyParser(createMockAdb(sampleXml));
      const el = await parser.findElement("settings");

      expect(el).not.toBeNull();
      expect(el?.text).toBe("Settings");
      expect(el?.id).toBe("com.android.settings:id/title");
    });

    it("finds element by content-description", async () => {
      const parser = new UiHierarchyParser(createMockAdb(sampleXml));
      const el = await parser.findElement("back");

      expect(el).not.toBeNull();
      expect(el?.contentDescription).toBe("Back");
    });

    it("finds element by resource-id", async () => {
      const parser = new UiHierarchyParser(createMockAdb(sampleXml));
      const el = await parser.findElement("com.android.settings:id/search_action_bar");

      expect(el).not.toBeNull();
      expect(el?.text).toBe("Search settings");
    });

    it("falls back to partial substring match", async () => {
      const parser = new UiHierarchyParser(createMockAdb(sampleXml));
      // "search" is a substring of "Search settings"
      const el = await parser.findElement("search");

      expect(el).not.toBeNull();
      expect(el?.text).toBe("Search settings");
    });

    it("returns null when element cannot be found", async () => {
      const parser = new UiHierarchyParser(createMockAdb(sampleXml));
      const el = await parser.findElement("non_existent_element");

      expect(el).toBeNull();
    });

    it("handles whitespace in queries gracefully", async () => {
      const parser = new UiHierarchyParser(createMockAdb(sampleXml));
      const el = await parser.findElement("   Settings   ");

      expect(el).not.toBeNull();
      expect(el?.text).toBe("Settings");
    });

    it("returns null for empty or whitespace-only query without false positive matching", async () => {
      const parser = new UiHierarchyParser(createMockAdb(sampleXml));
      expect(await parser.findElement("")).toBeNull();
      expect(await parser.findElement("   ")).toBeNull();
      expect(await parser.findElement("\t\n")).toBeNull();
    });

    it("parses elements with negative coordinate bounds", async () => {
      const negativeBoundsXml = `<?xml version='1.0' encoding='UTF-8' ?>
<hierarchy rotation="0">
  <node index="0" bounds="[-50,-100][500,600]">
    <node index="0" text="Offscreen Header" bounds="[-50,-100][200,50]" clickable="true" />
  </node>
</hierarchy>`;
      const parser = new UiHierarchyParser(createMockAdb(negativeBoundsXml));
      const elements = await parser.dumpHierarchy();

      expect(elements).toHaveLength(1);
      expect(elements[0].bounds).toEqual({ left: -50, top: -100, right: 200, bottom: 50 });
      expect(elements[0].text).toBe("Offscreen Header");
    });

    it("safely skips nodes with invalid or unparseable bounds syntax", async () => {
      const badBoundsXml = `<?xml version='1.0' encoding='UTF-8' ?>
<hierarchy rotation="0">
  <node index="0" bounds="invalid-bounds-format">
    <node index="0" text="Malformed Bounds Node" bounds="not-a-box" clickable="true" />
    <node index="1" text="Valid Node" bounds="[10,20][30,40]" clickable="true" />
  </node>
</hierarchy>`;
      const parser = new UiHierarchyParser(createMockAdb(badBoundsXml));
      const elements = await parser.dumpHierarchy();

      expect(elements).toHaveLength(1);
      expect(elements[0].text).toBe("Valid Node");
    });
  });
});
