import { describe, expect, it } from "vitest";
import { parseCsvHeader } from "./csv";

describe("parseCsvHeader", () => {
  it("parses a simple CSV header row", () => {
    expect(parseCsvHeader("a,b,c\n1,2,3")).toEqual(["a", "b", "c"]);
  });

  it("preserves commas inside quoted column names", () => {
    expect(parseCsvHeader('"feature, one",target\n1,2')).toEqual([
      "feature, one",
      "target",
    ]);
  });
});
