"use client";

import { Globe, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

import { cn } from "@/lib/formatters";
import { Brand } from "./brand";
import { getNavigationSections, type NavigationCounters } from "./navigation";

export function DesktopSidebar({
  counters,
}: {
  counters: NavigationCounters;
}) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-66 flex-col border-r border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 lg:flex">
      <div className="px-5 pb-6 pt-6">
        <Brand />
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3" aria-label="Navegação principal">
        {getNavigationSections().map((section) => (
          <div key={section.label} className="space-y-1">
            <p className="px-3 pb-1 text-[11px] font-semibold text-ink-400">{section.label}</p>

            {section.items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              // Contadores sinalizam trabalho pendente, não servem de enfeite.
              const count = item.badge ? counters[item.badge] : 0;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                    active
                      ? "bg-brand-50 dark:bg-brand-950 font-semibold text-brand-900 dark:text-brand-200"
                      : "font-medium text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-950 hover:text-ink-900 dark:hover:text-ink-50",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4.5 shrink-0",
                      active ? "text-brand-700 dark:text-brand-300" : "text-ink-400 group-hover:text-ink-600 dark:group-hover:text-ink-300",
                    )}
                    strokeWidth={active ? 2.2 : 2}
                    aria-hidden="true"
                  />
                  <span className="truncate">{item.label}</span>

                  {count > 0 ? (
                    <span
                      className={cn(
                        "ml-auto rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                        item.badge === "portalPending"
                          ? "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200"
                          : active
                            ? "bg-brand-100 dark:bg-brand-900 text-brand-800 dark:text-brand-200"
                            : "bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300",
                      )}
                    >
                      <span className="sr-only">Quantidade: </span>
                      {count}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="space-y-1 border-t border-ink-100 dark:border-ink-800 p-3">
        <a
          href="/agendar"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-ink-600 dark:text-ink-300 transition-colors hover:bg-ink-50 dark:hover:bg-ink-950 hover:text-ink-900 dark:hover:text-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Globe className="size-4.5 text-ink-400" aria-hidden="true" />
          Portal da cliente
        </a>

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-ink-600 dark:text-ink-300 transition-colors hover:bg-ink-50 dark:hover:bg-ink-950 hover:text-ink-900 dark:hover:text-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <LogOut className="size-4.5 text-ink-400" aria-hidden="true" />
          Sair
        </button>
      </div>
    </aside>
  );
}
