import { describe, expect, it } from "vitest";
import { AWAITING_VISA_COPY, askForVisaCopies, pendingVisaCopies, receiveVisaCopy, visaCopyTextReply } from "../src/lib/whatsapp-bot/visa-copy";

const pending = [
  { passengerId: "p1", name: "Aiman" },
  { passengerId: "p2", name: "Sara" },
];

describe("WhatsApp visa copy request (client testing 2026-10-09, B21)", () => {
  it("stores the applicants still owing a visa copy", () => {
    const step = askForVisaCopies("lead1", pending);
    expect(step.nextState).toBe(AWAITING_VISA_COPY);
    expect(pendingVisaCopies(step.nextCollectedFields)).toEqual(pending);
  });

  it("reminds on a typed message and ends on 'skip'", () => {
    const fields = askForVisaCopies("lead1", pending).nextCollectedFields;
    const reminder = visaCopyTextReply(fields, "hello?");
    expect(reminder.nextState).toBe(AWAITING_VISA_COPY);
    expect(reminder.replyText).toContain("Aiman");
    expect(visaCopyTextReply(fields, "SKIP").nextState).toBe("COMPLETED");
  });

  it("asks again when the file couldn't be downloaded or isn't an image/PDF", async () => {
    const fields = askForVisaCopies("lead1", pending).nextCollectedFields;
    const unreadable = await receiveVisaCopy(fields, null);
    expect(unreadable.nextState).toBe(AWAITING_VISA_COPY);
    expect(pendingVisaCopies(unreadable.nextCollectedFields)).toHaveLength(2);
    const notAnImage = await receiveVisaCopy(fields, { base64: Buffer.from("hello").toString("base64"), mimeType: "text/plain" });
    expect(notAnImage.replyText).toContain("couldn't read");
  });

  it("ignores broken state", () => {
    expect(pendingVisaCopies({ pendingVisaCopies: "not json" })).toEqual([]);
  });
});
