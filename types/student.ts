import type { Entity, ISODateString } from "./common";

export const MAX_STUDENTS = 8;
export const STUDENT_NAME_MAX_LENGTH = 20;
/** Factory owner PIN (must match lib/data/seed/owner.json). */
export const DEFAULT_OWNER_PIN = "0000";

/**
 * Local student profile.
 * NOTE: `pin` is only for switching profiles on a shared family device.
 * It is NOT secure authentication (V1 stores it as plain local data).
 */
export interface StudentProfile extends Entity {
  name: string;
  pin: string;
  createdAt: ISODateString;
  active: boolean;
}

/** The parent / device owner. Can view and manage all student profiles. */
export interface OwnerProfile extends Entity {
  name: string;
  pin: string;
  createdAt: ISODateString;
}

export interface NewStudentInput {
  name: string;
  pin: string;
}

export interface StudentUpdateInput {
  name: string;
  /** New 4-digit PIN; empty / missing keeps the current PIN. */
  pin?: string;
}
