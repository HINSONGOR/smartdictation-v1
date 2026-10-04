/** ISO-8601 timestamp string, e.g. "2026-10-01T08:00:00.000Z". */
export type ISODateString = string;

export interface Entity {
  id: string;
}

/**
 * Every piece of a student's learning data carries its owner's studentId.
 * Repositories only expose student-scoped queries for these records,
 * so Student A can never read Student B's learning content.
 */
export interface StudentScoped {
  studentId: string;
}
