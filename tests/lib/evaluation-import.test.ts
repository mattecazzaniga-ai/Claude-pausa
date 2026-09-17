import { describe, it, expect } from "vitest";
import { extractTextFromFile } from "@/lib/evaluation-import";

describe("extractTextFromFile", () => {
  it("caps how much text reaches the AI prompt, so an oversized upload can't turn one import into a slow generation call", async () => {
    const huge = "x".repeat(50000);
    const text = await extractTextFromFile(Buffer.from(huge, "utf-8"), "scheda.txt");
    expect(text.length).toBe(20000);
  });

  it("passes a short document through untouched", async () => {
    const text = await extractTextFromFile(Buffer.from("Tecnica\n- Servizio\n- Diritto", "utf-8"), "scheda.txt");
    expect(text).toBe("Tecnica\n- Servizio\n- Diritto");
  });

  it("rejects an unsupported extension", async () => {
    await expect(extractTextFromFile(Buffer.from("data"), "scheda.xyz")).rejects.toThrow("Formato file non supportato");
  });
});
