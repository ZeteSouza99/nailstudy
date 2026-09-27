import { describe, expect, it } from "vitest";

import { safeCallbackUrl } from "./safe-redirect";

describe("safeCallbackUrl", () => {
  it("mantém caminhos internos", () => {
    expect(safeCallbackUrl("/agenda?novo=1")).toBe("/agenda?novo=1");
    expect(safeCallbackUrl("/")).toBe("/");
  });

  it("descarta destinos externos ou ambíguos", () => {
    expect(safeCallbackUrl("//evil.example")).toBe("/");
    expect(safeCallbackUrl("/\\evil.example")).toBe("/");
    expect(safeCallbackUrl("https://evil.example")).toBe("/");
    expect(safeCallbackUrl("javascript:alert(1)")).toBe("/");
    expect(safeCallbackUrl(null)).toBe("/");
  });
});
