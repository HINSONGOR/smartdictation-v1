import { describe, expect, it } from "vitest";
import { BACKUP_REMINDER_DAYS, backupReminder } from "./reminder";

const NOW = new Date("2026-10-30T12:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe("backupReminder", () => {
  it("stays quiet without data", () => {
    expect(backupReminder(null, false, NOW)).toEqual({ kind: "none" });
  });

  it("asks for a first backup when there is data but none yet", () => {
    expect(backupReminder(null, true, NOW)).toEqual({ kind: "never" });
  });

  it(`reminds after ${BACKUP_REMINDER_DAYS} days`, () => {
    expect(backupReminder(daysAgo(BACKUP_REMINDER_DAYS - 1), true, NOW)).toEqual({ kind: "none" });
    expect(backupReminder(daysAgo(BACKUP_REMINDER_DAYS), true, NOW)).toEqual({ kind: "overdue", days: BACKUP_REMINDER_DAYS });
    expect(backupReminder(daysAgo(40), true, NOW)).toEqual({ kind: "overdue", days: 40 });
  });
});
