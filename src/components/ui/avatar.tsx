import { cn, getInitials } from "@/lib/formatters";

interface AvatarProps {
  name: string;
  color?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  decorative?: boolean;
}

const sizeClasses = {
  sm: "size-8 text-[11px]",
  md: "size-10 text-xs",
  lg: "size-12 text-sm",
};

export function Avatar({
  name,
  color = "#0f766e",
  size = "md",
  className,
  decorative = false,
}: AvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white dark:ring-slate-900",
        sizeClasses[size],
        className,
      )}
      style={{ backgroundColor: color }}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : name}
      role={decorative ? undefined : "img"}
      title={name}
    >
      {getInitials(name)}
    </span>
  );
}
