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
  | "dictation.notFound";

export class ServiceError extends Error {
  constructor(readonly code: ServiceErrorCode) {
    super(code);
    this.name = "ServiceError";
  }
}
