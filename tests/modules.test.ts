import { describe, test, expect, beforeEach } from "bun:test";
import { Table } from "../lib/display";

let logs: string[] = [];
let originalLog: typeof console.log;

beforeEach(() => {
  logs = [];
  originalLog = console.log;
  console.log = (...args: any[]) => logs.push(args.join(" "));
  // Set consistent terminal width for all tests
  Object.defineProperty(process.stdout, "columns", {
    value: 100,
    writable: true,
    configurable: true,
  });
});

function restoreLog() {
  console.log = originalLog;
}

function stripAnsi(str: string): string {
  return str
    .replace(/\u001B\[[0-9;]*[a-zA-Z]/g, "")
    .replace(/\u001B\].*?(?:\u0007|\u001B\\)/g, "");
}

describe("Modules - parseHtmlContent", () => {
  function parseHtmlContent(html: string): string {
    if (!html) return "";

    let text = html;

    // Remove style and script tags with content - repeat until no more matches
    // This prevents attacks like <scr<script>ipt> which would leave <script> after one pass
    let prevText = "";
    while (prevText !== text) {
      prevText = text;
      text = text
        .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*[^>]*>/gi, "")
        .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*[^>]*>/gi, "");
    }

    // Now do standard HTML to text conversion
    text = text
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6])\s*[^>]*>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<h[1-6][^>]*>/gi, "\n")
      .replace(/<\/?[a-z][^>]*>/gi, "");

    // Decode HTML entities in a safe order
    text = text
      .replace(/&#(\d+);/g, (_, num) => {
        const code = parseInt(num, 10);
        return code >= 0 && code <= 0x10ffff ? String.fromCharCode(code) : _;
      })
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
        const code = parseInt(hex, 16);
        return code >= 0 && code <= 0x10ffff ? String.fromCharCode(code) : _;
      });

    text = text
      .replace(/&nbsp;/g, " ")
      .replace(/&quot;/g, '"')
      .replace(/&#0*39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");

    text = text.replace(/\n{3,}/g, "\n\n").trim();

    return text;
  }

  test("converts simple HTML to text", () => {
    const html = "<p>Hello World</p>";
    expect(parseHtmlContent(html)).toBe("Hello World");
  });

  test("handles br tags", () => {
    const html = "Line 1<br>Line 2<br/>Line 3";
    expect(parseHtmlContent(html)).toBe("Line 1\nLine 2\nLine 3");
  });

  test("handles paragraph tags", () => {
    const html = "<p>Paragraph 1</p><p>Paragraph 2</p>";
    const result = parseHtmlContent(html);
    expect(result).toContain("Paragraph 1");
    expect(result).toContain("Paragraph 2");
  });

  test("converts list items to bullets", () => {
    const html = "<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>";
    const result = parseHtmlContent(html);
    expect(result).toContain("• Item 1");
    expect(result).toContain("• Item 2");
    expect(result).toContain("• Item 3");
  });

  test("decodes HTML entities", () => {
    const html = "Tom &amp; Jerry &lt;3 &gt; 2 &quot;quoted&quot;";
    expect(parseHtmlContent(html)).toBe('Tom & Jerry <3 > 2 "quoted"');
  });

  test("removes style tags with content", () => {
    const html = "<style>.foo { color: red; }</style><p>Content</p>";
    expect(parseHtmlContent(html)).toBe("Content");
  });

  test("removes script tags with content", () => {
    const html = "<script>alert('test');</script><p>Safe Content</p>";
    expect(parseHtmlContent(html)).toBe("Safe Content");
  });

  test("handles nested tags", () => {
    const html = "<div><p><strong>Bold</strong> and <em>italic</em></p></div>";
    expect(parseHtmlContent(html)).toContain("Bold");
    expect(parseHtmlContent(html)).toContain("italic");
  });

  test("normalizes multiple newlines", () => {
    const html = "<p>Line 1</p><p></p><p></p><p>Line 2</p>";
    const result = parseHtmlContent(html);
    expect(result).not.toContain("\n\n\n");
  });

  test("handles empty input", () => {
    expect(parseHtmlContent("")).toBe("");
    expect(parseHtmlContent(null as any)).toBe("");
  });

  test("handles malformed script tags (security fix)", () => {
    // Browsers accept </script > with spaces before closing bracket
    const html = "<script>alert('XSS')</script ><p>Safe Content</p>";
    expect(parseHtmlContent(html)).toBe("Safe Content");

    // Also test with attributes in closing tag
    const html2 = "<script>alert('XSS')</script foo='bar'><p>Safe Content</p>";
    expect(parseHtmlContent(html2)).toBe("Safe Content");
  });

  test("handles malformed style tags (security fix)", () => {
    const html = "<style>.evil { }</style ><p>Safe Content</p>";
    expect(parseHtmlContent(html)).toBe("Safe Content");
  });

  test("handles overlapping script tags (incomplete sanitization fix)", () => {
    // Attack pattern: <scr<script>ipt> would leave <script> after one pass
    const html = "<scr<script>alert('XSS')</script>ipt><p>Safe Content</p>";
    const result = parseHtmlContent(html);
    expect(result).not.toContain("<script");
    expect(result).not.toContain("alert");
    expect(result).toContain("Safe Content");
  });

  test("handles overlapping style tags (incomplete sanitization fix)", () => {
    // Attack pattern: <sty<style>le> would leave <style> after one pass
    const html = "<sty<style>.evil{}</style>le><p>Safe Content</p>";
    const result = parseHtmlContent(html);
    expect(result).not.toContain("<style");
    expect(result).not.toContain("evil");
    expect(result).toContain("Safe Content");
  });

  test("handles deeply nested malicious tags (incomplete sanitization fix)", () => {
    // Multiple levels of obfuscation
    const html =
      "<scr<scr<script>ipt>ipt>alert('XSS')</script></script></script><p>Safe</p>";
    const result = parseHtmlContent(html);
    expect(result).not.toContain("<script");
    expect(result).not.toContain("alert");
    expect(result).toContain("Safe");
  });

  test("handles malformed closing tags (security fix)", () => {
    const html = "<p>Line 1</p ><div>Line 2</div foo='bar'>";
    const result = parseHtmlContent(html);
    expect(result).toContain("Line 1");
    expect(result).toContain("Line 2");
  });

  test("handles complex real-world HTML", () => {
    const html = `
      <h2>Getting Started</h2>
      <p>Welcome to the course! Here's what you need:</p>
      <ul>
        <li>A laptop</li>
        <li>Internet access</li>
        <li>Motivation &amp; dedication</li>
      </ul>
      <p>Good luck!</p>
    `;
    const result = parseHtmlContent(html);
    expect(result).toContain("Getting Started");
    expect(result).toContain("Welcome to the course");
    expect(result).toContain("• A laptop");
    expect(result).toContain("Motivation & dedication");
    expect(result).toContain("Good luck!");
  });
});

describe("Modules - extractLinks", () => {
  function extractLinks(html: string): { text: string; url: string }[] {
    const links: { text: string; url: string }[] = [];
    const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const url = match[1];
      let text = match[2]?.trim() || url || "";
      text = text.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
      if (url && text) {
        links.push({ text, url });
      }
    }
    return links;
  }

  test("extracts single link", () => {
    const html = '<a href="https://example.com">Example</a>';
    const links = extractLinks(html);
    expect(links.length).toBe(1);
    expect(links[0].url).toBe("https://example.com");
    expect(links[0].text).toBe("Example");
  });

  test("extracts multiple links", () => {
    const html = `
      <a href="https://google.com">Google</a>
      <a href="https://github.com">GitHub</a>
      <a href="https://stackoverflow.com">Stack Overflow</a>
    `;
    const links = extractLinks(html);
    expect(links.length).toBe(3);
    expect(links.map((l) => l.text)).toContain("Google");
    expect(links.map((l) => l.text)).toContain("GitHub");
    expect(links.map((l) => l.text)).toContain("Stack Overflow");
  });

  test("handles links with single quotes", () => {
    const html = "<a href='https://example.com'>Example</a>";
    const links = extractLinks(html);
    expect(links.length).toBe(1);
    expect(links[0].url).toBe("https://example.com");
  });

  test("handles links with attributes", () => {
    const html =
      '<a class="link" href="https://example.com" target="_blank">Example</a>';
    const links = extractLinks(html);
    expect(links.length).toBe(1);
    expect(links[0].url).toBe("https://example.com");
  });

  test("decodes HTML entities in link text", () => {
    const html = '<a href="https://example.com">Tom &amp; Jerry</a>';
    const links = extractLinks(html);
    expect(links[0].text).toBe("Tom & Jerry");
  });

  test("returns empty array for no links", () => {
    const html = "<p>No links here</p>";
    const links = extractLinks(html);
    expect(links.length).toBe(0);
  });

  test("handles empty link text by using URL as fallback", () => {
    const html = '<a href="https://example.com"></a>';
    const links = extractLinks(html);
    // When text is empty, URL is used as fallback text
    expect(links.length).toBe(1);
    expect(links[0].url).toBe("https://example.com");
  });

  test("extracts relative URLs", () => {
    const html = '<a href="/courses/123/pages/intro">Introduction</a>';
    const links = extractLinks(html);
    expect(links.length).toBe(1);
    expect(links[0].url).toBe("/courses/123/pages/intro");
  });
});

describe("Modules - makeClickableLink", () => {
  function makeClickableLink(url: string, text?: string): string {
    const displayText = text || url;
    return `\x1b]8;;${url}\x07${displayText}\x1b]8;;\x07`;
  }

  test("creates OSC 8 hyperlink with text", () => {
    const result = makeClickableLink("https://example.com", "Example");
    expect(result).toContain("https://example.com");
    expect(result).toContain("Example");
    expect(result).toContain("\x1b]8;;");
    expect(result).toContain("\x07");
  });

  test("uses URL as text when no text provided", () => {
    const result = makeClickableLink("https://example.com");
    expect(result).toContain("https://example.com");
    const count = (result.match(/https:\/\/example\.com/g) || []).length;
    expect(count).toBe(2);
  });

  test("handles long URLs", () => {
    const longUrl =
      "https://example.com/very/long/path/to/some/resource?query=value&another=param";
    const result = makeClickableLink(longUrl, "Resource");
    expect(result).toContain(longUrl);
    expect(result).toContain("Resource");
  });
});

describe("Modules - getItemTypeIcon", () => {
  function getItemTypeIcon(type: string): string {
    switch (type) {
      case "File":
        return "📄";
      case "Page":
        return "📝";
      case "Discussion":
        return "💬";
      case "Assignment":
        return "📋";
      case "Quiz":
        return "❓";
      case "SubHeader":
        return "📁";
      case "ExternalUrl":
        return "🔗";
      case "ExternalTool":
        return "🔧";
      default:
        return "📌";
    }
  }

  test("returns correct icon for File", () => {
    expect(getItemTypeIcon("File")).toBe("📄");
  });

  test("returns correct icon for Page", () => {
    expect(getItemTypeIcon("Page")).toBe("📝");
  });

  test("returns correct icon for Discussion", () => {
    expect(getItemTypeIcon("Discussion")).toBe("💬");
  });

  test("returns correct icon for Assignment", () => {
    expect(getItemTypeIcon("Assignment")).toBe("📋");
  });

  test("returns correct icon for Quiz", () => {
    expect(getItemTypeIcon("Quiz")).toBe("❓");
  });

  test("returns correct icon for SubHeader", () => {
    expect(getItemTypeIcon("SubHeader")).toBe("📁");
  });

  test("returns correct icon for ExternalUrl", () => {
    expect(getItemTypeIcon("ExternalUrl")).toBe("🔗");
  });

  test("returns correct icon for ExternalTool", () => {
    expect(getItemTypeIcon("ExternalTool")).toBe("🔧");
  });

  test("returns default icon for unknown type", () => {
    expect(getItemTypeIcon("Unknown")).toBe("📌");
    expect(getItemTypeIcon("")).toBe("📌");
  });
});

describe("Modules - Table Display", () => {
  test("modules table renders correctly", () => {
    const columns = [
      { key: "module", header: "Module", width: 14 },
      { key: "title", header: "Title", flex: 1, minWidth: 20 },
    ];

    const table = new Table(columns, { showRowNumbers: true });
    table.addRow({ module: "Getting Star…", title: "Introduction" });
    table.addRow({ module: "Week 1", title: "Basic Concepts" });
    table.addRow({ module: "Week 2", title: "Advanced Topics" });

    try {
      const logger = (str: string) => logs.push(str);
      table.render(logger);
      const rendered = stripAnsi(logs.join("\n"));

      expect(rendered).toContain("Module");
      expect(rendered).toContain("Title");
      expect(rendered).toContain("Introduction");
      expect(rendered).toContain("Week 1");
    } finally {
      restoreLog();
    }
  });

  test("modules table handles long module names", () => {
    const columns = [
      { key: "module", header: "Module", width: 14 },
      { key: "title", header: "Title", flex: 1 },
    ];

    const table = new Table(columns, { showRowNumbers: false, truncate: true });
    table.addRow({
      module: "Very Long Module Name That Should Be Truncated",
      title: "Content Item",
    });

    try {
      const logger = (str: string) => logs.push(str);
      table.render(logger);
      const rendered = stripAnsi(logs.join("\n"));

      // Should contain ellipsis
      expect(rendered).toContain("...");
      expect(rendered).toContain("Content Item");
    } finally {
      restoreLog();
    }
  });

  test("modules table handles many items", () => {
    const columns = [
      { key: "module", header: "Module", width: 10 },
      { key: "title", header: "Title", flex: 1 },
    ];

    const table = new Table(columns, { showRowNumbers: true });

    for (let i = 1; i <= 20; i++) {
      table.addRow({
        module: `Week ${i}`,
        title: `Lesson ${i}: Topic ${i}`,
      });
    }

    try {
      const logger = (str: string) => logs.push(str);
      table.render(logger);
      const rendered = stripAnsi(logs.join("\n"));

      expect(rendered).toContain("Week 1");
      expect(rendered).toContain("Week 20");
      expect(rendered).toContain("Lesson 10");
    } finally {
      restoreLog();
    }
  });

  test("empty modules table displays correctly", () => {
    const columns = [
      { key: "module", header: "Module", width: 14 },
      { key: "title", header: "Title", flex: 1 },
    ];

    const table = new Table(columns, { showRowNumbers: true });

    try {
      const logger = (str: string) => logs.push(str);
      table.render(logger);
      const rendered = stripAnsi(logs.join("\n"));

      expect(rendered).toContain("Module");
      expect(rendered).toContain("Title");
      expect(rendered).toContain("│");
    } finally {
      restoreLog();
    }
  });
});

describe("Modules - Module name shortening", () => {
  test("shortens long module names", () => {
    function shortenModuleName(name: string, maxLen: number = 12): string {
      if (name.length > maxLen) {
        return name.substring(0, maxLen - 1) + "…";
      }
      return name;
    }

    expect(shortenModuleName("Getting Started")).toBe("Getting Sta…");
    expect(shortenModuleName("Week 1")).toBe("Week 1");
    expect(shortenModuleName("Introduction to Advanced Topics")).toBe(
      "Introductio…",
    );
  });

  test("preserves short module names", () => {
    function shortenModuleName(name: string, maxLen: number = 12): string {
      if (name.length > maxLen) {
        return name.substring(0, maxLen - 1) + "…";
      }
      return name;
    }

    expect(shortenModuleName("Week 1")).toBe("Week 1");
    expect(shortenModuleName("Resources")).toBe("Resources");
  });
});

describe("Modules - AllItem flattening", () => {
  interface MockModule {
    id: number;
    name: string;
  }

  interface MockItem {
    id: number;
    title: string;
    type: string;
    html_url?: string;
    external_url?: string;
  }

  interface AllItem {
    module: MockModule;
    item: MockItem;
    url: string;
  }

  test("flattens items from multiple modules", () => {
    const modules: MockModule[] = [
      { id: 1, name: "Module 1" },
      { id: 2, name: "Module 2" },
    ];

    const itemsByModule: { module: MockModule; items: MockItem[] }[] = [
      {
        module: modules[0],
        items: [
          { id: 1, title: "Item 1", type: "Page", html_url: "http://a.com" },
          { id: 2, title: "Item 2", type: "File", html_url: "http://b.com" },
        ],
      },
      {
        module: modules[1],
        items: [
          { id: 3, title: "Item 3", type: "Quiz", html_url: "http://c.com" },
        ],
      },
    ];

    const allItems: AllItem[] = [];
    for (const { module: mod, items } of itemsByModule) {
      for (const item of items) {
        const url = item.html_url || item.external_url || "";
        allItems.push({ module: mod, item, url });
      }
    }

    expect(allItems.length).toBe(3);
    expect(allItems[0].module.name).toBe("Module 1");
    expect(allItems[0].item.title).toBe("Item 1");
    expect(allItems[2].module.name).toBe("Module 2");
    expect(allItems[2].item.title).toBe("Item 3");
  });

  test("handles empty modules", () => {
    const itemsByModule: { module: MockModule; items: MockItem[] }[] = [
      { module: { id: 1, name: "Empty Module" }, items: [] },
      {
        module: { id: 2, name: "Has Items" },
        items: [{ id: 1, title: "Item 1", type: "Page" }],
      },
    ];

    const allItems: AllItem[] = [];
    for (const { module: mod, items } of itemsByModule) {
      for (const item of items) {
        const url = item.html_url || item.external_url || "";
        allItems.push({ module: mod, item, url });
      }
    }

    expect(allItems.length).toBe(1);
    expect(allItems[0].module.name).toBe("Has Items");
  });

  test("uses external_url when html_url is missing", () => {
    const itemsByModule: { module: MockModule; items: MockItem[] }[] = [
      {
        module: { id: 1, name: "Module 1" },
        items: [
          {
            id: 1,
            title: "External Link",
            type: "ExternalUrl",
            external_url: "https://external.com",
          },
        ],
      },
    ];

    const allItems: AllItem[] = [];
    for (const { module: mod, items } of itemsByModule) {
      for (const item of items) {
        const url = item.html_url || item.external_url || "";
        allItems.push({ module: mod, item, url });
      }
    }

    expect(allItems[0].url).toBe("https://external.com");
  });
});

describe("Modules - Input parsing", () => {
  test("parses item number correctly", () => {
    const parseChoice = (
      choice: string,
    ): { openInBrowser: boolean; index: number } => {
      const openInBrowser = choice.toLowerCase().startsWith("o ");
      const numStr = openInBrowser ? choice.slice(2).trim() : choice.trim();
      const index = parseInt(numStr) - 1;
      return { openInBrowser, index };
    };

    expect(parseChoice("1")).toEqual({ openInBrowser: false, index: 0 });
    expect(parseChoice("5")).toEqual({ openInBrowser: false, index: 4 });
    expect(parseChoice("10")).toEqual({ openInBrowser: false, index: 9 });
  });

  test("parses 'o #' format for browser opening", () => {
    const parseChoice = (
      choice: string,
    ): { openInBrowser: boolean; index: number } => {
      const openInBrowser = choice.toLowerCase().startsWith("o ");
      const numStr = openInBrowser ? choice.slice(2).trim() : choice.trim();
      const index = parseInt(numStr) - 1;
      return { openInBrowser, index };
    };

    expect(parseChoice("o 1")).toEqual({ openInBrowser: true, index: 0 });
    expect(parseChoice("O 5")).toEqual({ openInBrowser: true, index: 4 });
    expect(parseChoice("o  10")).toEqual({ openInBrowser: true, index: 9 });
  });

  test("handles invalid input", () => {
    const parseChoice = (
      choice: string,
    ): { openInBrowser: boolean; index: number } => {
      const openInBrowser = choice.toLowerCase().startsWith("o ");
      const numStr = openInBrowser ? choice.slice(2).trim() : choice.trim();
      const index = parseInt(numStr) - 1;
      return { openInBrowser, index };
    };

    const result = parseChoice("abc");
    expect(isNaN(result.index)).toBe(true);

    const emptyResult = parseChoice("");
    expect(isNaN(emptyResult.index)).toBe(true);
  });
});
