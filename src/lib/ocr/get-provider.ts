import type { OcrProvider } from "./provider";
import { ClaudeOcrProvider } from "./claude-ocr-provider";
import { GeminiOcrProvider, DEFAULT_GEMINI_OCR_MODEL } from "./gemini-ocr-provider";
import { PlaceholderOcrProvider } from "./placeholder-provider";
import { isPlaceholder } from "@/lib/env-placeholder";

let cached: OcrProvider | null = null;

/** True when a real OCR key (Gemini or Anthropic) is configured. */
export function isOcrConfigured(): boolean {
  return !isPlaceholder(process.env.GEMINI_API_KEY) || !isPlaceholder(process.env.ANTHROPIC_API_KEY);
}

/** Which OCR vendor getOcrProvider() uses, for the Admin health screens. */
export function ocrProviderLabel(): string {
  if (!isPlaceholder(process.env.GEMINI_API_KEY)) return "Google Gemini";
  if (!isPlaceholder(process.env.ANTHROPIC_API_KEY)) return "Anthropic Claude";
  return "not configured";
}

/**
 * Picks the OCR provider, same swappable-service pattern as every other
 * integration (getPaymentGateway, getEmailSender, getWhatsAppGateway):
 * 1. GEMINI_API_KEY set → Google Gemini (client's choice, 2026-10; model
 *    from GEMINI_OCR_MODEL, default DEFAULT_GEMINI_OCR_MODEL);
 * 2. else ANTHROPIC_API_KEY set → Claude vision;
 * 3. else the clearly-labelled SAMPLE placeholder.
 * The OCR provider is independent of the WhatsApp bot/AI features, which
 * keep using ANTHROPIC_API_KEY (or their keyword fallback).
 */
export function getOcrProvider(): OcrProvider {
  if (cached) return cached;
  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!isPlaceholder(geminiKey)) {
    const model = isPlaceholder(process.env.GEMINI_OCR_MODEL) ? DEFAULT_GEMINI_OCR_MODEL : process.env.GEMINI_OCR_MODEL!.trim();
    cached = new GeminiOcrProvider(geminiKey!.trim(), model);
  } else if (!isPlaceholder(anthropicKey)) {
    cached = new ClaudeOcrProvider(anthropicKey!);
  } else {
    cached = new PlaceholderOcrProvider();
  }
  return cached;
}
