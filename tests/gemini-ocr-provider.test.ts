import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiOcrProvider } from "../src/lib/ocr/gemini-ocr-provider";
import { parseMrz } from "../src/lib/ocr/mrz-parser";

// ICAO Doc 9303 specimen MRZ (the same vector the MRZ parser is verified against).
const SPECIMEN_MRZ = "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36UTO7408122F1204159ZE184226B<<<<<10";

function mockGeminiReply(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GeminiOcrProvider", () => {
  it("sends the document inline with the shared passport prompt and parses the JSON answer", async () => {
    const fetchMock = mockGeminiReply({
      candidates: [
        {
          content: {
            parts: [
              { text: "thinking about the MRZ…", thought: true },
              { text: JSON.stringify({ mrzRaw: SPECIMEN_MRZ, fields: { fullName: "ANNA MARIA ERIKSSON", sex: "F" } }) },
            ],
          },
        },
      ],
    });

    const provider = new GeminiOcrProvider("test-key", "gemini-test-model");
    const result = await provider.extractPassport({ fileBase64: "aGVsbG8=", mimeType: "image/jpeg" });

    expect(result.provider).toBe("gemini (gemini-test-model)");
    expect(result.mrzRaw).toBe(SPECIMEN_MRZ);
    expect(result.fields.fullName).toBe("ANNA MARIA ERIKSSON");
    // The MRZ it returned still goes through the deterministic checksum parser.
    expect(parseMrz(result.mrzRaw!)?.valid).toBe(true);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/models/gemini-test-model:generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
    const body = JSON.parse(init.body as string);
    expect(body.contents[0].parts[0].inlineData).toEqual({ mimeType: "image/jpeg", data: "aGVsbG8=" });
    expect(body.systemInstruction.parts[0].text).toContain("Machine Readable Zone");
    expect(body.generationConfig.responseMimeType).toBe("application/json");
  });

  it("accepts PDFs (visa documents) and returns no MRZ for them", async () => {
    mockGeminiReply({ candidates: [{ content: { parts: [{ text: '{"fields":{"visaNumber":"V123"}}' }] } }] });
    const result = await new GeminiOcrProvider("k").extractVisa({ fileBase64: "JVBERi0=", mimeType: "application/pdf" });
    expect(result.mrzRaw).toBeNull();
    expect(result.fields.visaNumber).toBe("V123");
  });

  it("throws on an API error without leaking the key or the document", async () => {
    mockGeminiReply({ error: { code: 400, status: "INVALID_ARGUMENT", message: "bad" } }, 400);
    const failure = new GeminiOcrProvider("secret-key").extractTicket({ fileBase64: "AAAA", mimeType: "image/png" });
    await expect(failure).rejects.toThrow(/Gemini OCR request failed \(400 INVALID_ARGUMENT\)/);
    await expect(failure).rejects.not.toThrow(/secret-key|AAAA/);
  });

  it("rejects unsupported file types before calling the API", async () => {
    const fetchMock = mockGeminiReply({});
    await expect(new GeminiOcrProvider("k").extractPassport({ fileBase64: "AAAA", mimeType: "text/plain" })).rejects.toThrow(/Unsupported file type/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks Gemini 3 for low thinking and treats an empty answer as a failure", async () => {
    const fetchMock = mockGeminiReply({ candidates: [{ content: { parts: [{ text: "…", thought: true }] }, finishReason: "MAX_TOKENS" }] });
    const failure = new GeminiOcrProvider("k", "gemini-3-flash-preview").extractPassport({ fileBase64: "AAAA", mimeType: "image/png" });
    await expect(failure).rejects.toThrow(/no answer \(finish reason: MAX_TOKENS\)/);
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "low" });
  });

  it("returns empty fields when the reply isn't JSON", async () => {
    mockGeminiReply({ candidates: [{ content: { parts: [{ text: "sorry, can't read this" }] } }] });
    const result = await new GeminiOcrProvider("k").extractPassport({ fileBase64: "AAAA", mimeType: "image/png" });
    expect(result.mrzRaw).toBeNull();
    expect(result.fields).toEqual({});
  });
});
