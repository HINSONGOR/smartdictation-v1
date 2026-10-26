/**
 * Business errors carry a code, not a message.
 * The UI turns the code into localized text via i18n key `error.<code>`.
 */
export type ServiceErrorCode =
  | "student.nameRequired"
  | "student.nameTooLong"
  | "student.nameTaken"
  | "owner.pinInvalid"
  | "backup.invalidFile"
  | "backup.wrongApp"
  | "backup.newerVersion"
  | "backup.tooManyStudents"
  | "student.pinInvalid"
  | "student.limitReached"
  | "student.notFound"
  | "student.inactive"
  | "student.wrongPin"
  | "owner.wrongPin"
  | "dictation.titleRequired"
  | "dictation.titleTooLong"
  | "dictation.itemsRequired"
  | "dictation.tooManyItems"
  | "dictation.itemTooLong"
  | "dictation.paragraphsRequired"
  | "dictation.tooManyParagraphs"
  | "dictation.paragraphTooLong"
  | "dictation.notFound"
  | "task.titleRequired"
  | "task.titleTooLong"
  | "task.dateInvalid"
  | "task.categoryInvalid"
  | "task.minutesInvalid"
  | "task.notesTooLong"
  | "task.notFound"
  | "task.weekdaysRequired"
  | "task.endBeforeStart"
  | "planner.nameRequired"
  | "planner.nameTooLong"
  | "planner.nameTaken"
  | "planner.limitReached"
  | "prompt.titleRequired"
  | "prompt.titleTooLong"
  | "prompt.contentRequired"
  | "prompt.contentTooLong"
  | "prompt.notFound"
  | "knowledge.titleRequired"
  | "knowledge.tooLong"
  | "knowledge.bodyRequired"
  | "knowledge.answerRequired"
  | "knowledge.notFound";

export class ServiceError extends Error {
  constructor(readonly code: ServiceErrorCode) {
    super(code);
    this.name = "ServiceError";
  }
}
