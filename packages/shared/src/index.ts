// ============================================================
// StandLens — Shared Types & Constants
// ============================================================
// This package is imported by both apps/web and apps/api.
// Put ONLY things that BOTH frontend and backend need here:
//   - TypeScript types/interfaces
//   - Enums
//   - Constants (role names, status values, etc.)
//
// Do NOT put:
//   - React components (frontend only)
//   - Database models (backend only)
//   - API route handlers (backend only)
// ============================================================

// ========================
// Roles
// ========================
export enum TeamRole {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  MEMBER = "MEMBER",
}

// ========================
// Join Request Status
// ========================
export enum JoinRequestStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  DECLINED = "DECLINED",
}

// ========================
// Digest Visibility
// ========================
export enum DigestVisibility {
  EVERYONE = "EVERYONE",
  ADMINS_ONLY = "ADMINS_ONLY",
  OWNER_ONLY = "OWNER_ONLY",
}

// ========================
// Digest Trigger Permission
// ========================
export enum DigestTriggerPermission {
  ADMINS_AND_OWNER = "ADMINS_AND_OWNER",
  EVERYONE = "EVERYONE",
}
