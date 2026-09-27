import {
  appointmentStatusConfig,
  professionalStatusConfig,
  serviceStatusConfig,
} from "@/lib/domain-config";
import { cn } from "@/lib/formatters";
import type {
  AppointmentStatus,
  ProfessionalStatus,
  ServiceStatus,
} from "@/types/domain";

type StatusBadgeProps =
  | { kind: "appointment"; status: AppointmentStatus; className?: string }
  | { kind: "professional"; status: ProfessionalStatus; className?: string }
  | { kind: "service"; status: ServiceStatus; className?: string };

export function StatusBadge(props: StatusBadgeProps) {
  const config =
    props.kind === "appointment"
      ? appointmentStatusConfig[props.status]
      : props.kind === "professional"
        ? professionalStatusConfig[props.status]
        : serviceStatusConfig[props.status];

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        config.className,
        props.className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", config.dotClassName)} />
      {config.label}
    </span>
  );
}
