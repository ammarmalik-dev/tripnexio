import { describe, expect, it } from "vitest";
import {
  EMPTY_TIMELINE_RULES,
  isCountryTimelineService,
  mergeTimelineRules,
  type ServiceTimelineRules,
} from "../src/lib/settings/service-timeline-merge";

const serviceDefault: ServiceTimelineRules = {
  ...EMPTY_TIMELINE_RULES,
  documentVerificationHours: 4,
  expectedCompletionHours: 72,
  quotationResponseMinutes: 30,
  paymentDeadlineHours: 24,
  followUpIntervalDays: 7,
  autoCompleteAfterDays: 2,
};

describe("mergeTimelineRules (service default + country override)", () => {
  it("returns the service values when the country has no row", () => {
    expect(mergeTimelineRules(serviceDefault, null)).toEqual(serviceDefault);
    expect(mergeTimelineRules(serviceDefault, undefined)).toEqual(serviceDefault);
  });

  it("uses each country value that is set and keeps the service value for blank ones", () => {
    const merged = mergeTimelineRules(serviceDefault, {
      documentVerificationHours: null,
      expectedCompletionHours: 48,
      quotationResponseMinutes: null,
      paymentDeadlineHours: 6,
      processingDaysNormal: null,
      processingDaysExpress: 2,
    });
    expect(merged.expectedCompletionHours).toBe(48);
    expect(merged.paymentDeadlineHours).toBe(6);
    expect(merged.processingDaysExpress).toBe(2);
    expect(merged.documentVerificationHours).toBe(4);
    expect(merged.quotationResponseMinutes).toBe(30);
    expect(merged.processingDaysNormal).toBeNull();
  });

  it("never touches fields a country can't override", () => {
    const merged = mergeTimelineRules(serviceDefault, { expectedCompletionHours: 10 });
    expect(merged.followUpIntervalDays).toBe(7);
    expect(merged.autoCompleteAfterDays).toBe(2);
  });

  it("lets a country set a value the service leaves unset, and keeps 0 as a real value", () => {
    const merged = mergeTimelineRules(EMPTY_TIMELINE_RULES, { documentVerificationHours: 0, expectedCompletionHours: 12 });
    expect(merged.documentVerificationHours).toBe(0);
    expect(merged.expectedCompletionHours).toBe(12);
    expect(merged.paymentDeadlineHours).toBeNull();
  });

  it("does not mutate the service rules", () => {
    const before = { ...serviceDefault };
    mergeTimelineRules(serviceDefault, { expectedCompletionHours: 1 });
    expect(serviceDefault).toEqual(before);
  });
});

describe("isCountryTimelineService", () => {
  it("covers Return Ticket, Visa Extension, Visa Change and Special Fare only", () => {
    expect(isCountryTimelineService("RETURN_TICKET")).toBe(true);
    expect(isCountryTimelineService("VISA_EXTENSION")).toBe(true);
    expect(isCountryTimelineService("VISA_CHANGE")).toBe(true);
    expect(isCountryTimelineService("FLIGHT_SPECIAL_FARE")).toBe(true);
    expect(isCountryTimelineService("NEW_VISA")).toBe(false);
    expect(isCountryTimelineService("OTB")).toBe(false);
  });
});
