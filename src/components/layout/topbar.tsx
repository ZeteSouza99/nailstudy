"use client";

import { usePathname } from "next/navigation";

import { Avatar } from "@/components/ui/avatar";
import { parseDateKey } from "@/lib/date";

import { routeMetadata } from "./navigation";
import { BrandMark } from "./brand";
import { ThemeToggle } from "./theme-toggle";
import { PushNotifications } from "./push-notifications";

const topbarDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function Topbar({
  user,
  today,
}: {
  user: { name: string };
  today: string;
}) {
  const pathname = usePathname();
  const metadata = routeMetadata[pathname] ?? routeMetadata["/"];
  const referenceDate = topbarDateFormatter.format(parseDateKey(today));
  const [weekday, datePart] = referenceDate.split(", ");

  return (
    <header className="sticky top-0 z-30 border-b border-ink-200/80 dark:border-ink-700/80 bg-white/90 dark:bg-ink-900/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6 lg:h-18 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 lg:hidden">
            <BrandMark className="size-9" />
          </span>
          <div className="min-w-0">
            <p className="hidden text-[11px] font-bold uppercase tracking-[0.12em] text-ink-400 sm:block">
              {metadata.section}
            </p>
            <p className="truncate text-sm font-bold text-ink-900 dark:text-ink-50 sm:text-base">
              {metadata.title}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <p className="hidden text-right text-xs leading-4 text-ink-500 dark:text-ink-400 md:block">
            <span className="block font-semibold capitalize text-ink-700 dark:text-ink-200">{weekday}</span>
            {datePart}
          </p>
          <PushNotifications />
          <ThemeToggle />
          <span className="hidden h-8 w-px bg-ink-200 dark:bg-ink-700 md:block" />
          <div
            className="flex items-center gap-2 rounded-xl p-1 text-left sm:pr-2"
            aria-label={`Sessão de ${user.name}`}
          >
            <Avatar name={user.name} color="#83423e" size="sm" decorative />
            <span className="hidden sm:block">
              <span className="block text-xs font-bold text-ink-800 dark:text-ink-100">{user.name}</span>
              <span className="block text-[11px] text-ink-500 dark:text-ink-400">Administradora</span>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
