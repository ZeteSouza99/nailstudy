import type {
  Appointment,
  AppointmentStatus,
  SessionUser,
  UserRole,
} from "@/types/domain";

import { canTransitionStatus } from "./scheduling";

export type Permission =
  | "agenda:view-all"
  | "appointments:create"
  | "appointments:manage"
  | "appointments:progress"
  | "appointments:delete"
  | "clients:view"
  | "clients:manage"
  | "clients:delete"
  | "catalog:view"
  | "catalog:manage"
  | "blocks:view"
  | "blocks:manage"
  | "payments:view"
  | "payments:manage"
  | "reports:view";

const allPermissions: Permission[] = [
  "agenda:view-all",
  "appointments:create",
  "appointments:manage",
  "appointments:progress",
  "appointments:delete",
  "clients:view",
  "clients:manage",
  "clients:delete",
  "catalog:view",
  "catalog:manage",
  "blocks:view",
  "blocks:manage",
  "payments:view",
  "payments:manage",
  "reports:view",
];

const rolePermissions: Record<UserRole, ReadonlySet<Permission>> = {
  admin: new Set(allPermissions),
  receptionist: new Set([
    "agenda:view-all",
    "appointments:create",
    "appointments:manage",
    "appointments:progress",
    "clients:view",
    "clients:manage",
    "catalog:view",
    "blocks:view",
    "blocks:manage",
    "payments:view",
    "payments:manage",
  ]),
  // A profissional só enxerga e conduz os próprios atendimentos.
  professional: new Set(["appointments:progress"]),
};

export const userRoles = ["admin", "receptionist", "professional"] as const satisfies readonly UserRole[];

export const roleLabels: Record<UserRole, string> = {
  admin: "Administradora",
  receptionist: "Recepção",
  professional: "Profissional",
};

export function can(role: UserRole, permission: Permission) {
  return rolePermissions[role].has(permission);
}

export function canChangeAppointmentStatus(
  user: Pick<SessionUser, "role" | "professionalId">,
  appointment: Pick<Appointment, "status" | "professionalId">,
  target: AppointmentStatus,
) {
  if (!canTransitionStatus(appointment.status, target)) return false;
  if (can(user.role, "appointments:manage")) return true;

  return (
    (target === "in-progress" || target === "completed") &&
    can(user.role, "appointments:progress") &&
    user.professionalId === appointment.professionalId
  );
}
