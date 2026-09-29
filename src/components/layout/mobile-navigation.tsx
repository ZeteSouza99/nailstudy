"use client";

import { Globe, LogOut, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";

import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/formatters";
import { getNavigationSections, type NavigationCounters } from "./navigation";

const itemClass =
  "flex min-w-0 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600";

export function MobileNavigation({
  counters,
}: {
  counters: NavigationCounters;
}) {
  const pathname = usePathname();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const items = getNavigationSections().flatMap((section) => section.items);
  const primary = items.filter((item) => item.primaryOnMobile);
  const secondary = items.filter((item) => !item.primaryOnMobile);
  const secondaryActive = secondary.some((item) => pathname === item.href);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-200 dark:border-ink-700 bg-white/95 dark:bg-ink-900/95 px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_30px_rgba(15,23,42,0.07)] backdrop-blur-xl lg:hidden"
        aria-label="Navegação móvel"
      >
        <div
          className="mx-auto grid max-w-lg"
          style={{ gridTemplateColumns: `repeat(${primary.length + 1}, minmax(0, 1fr))` }}
        >
          {primary.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            const count = item.badge ? counters[item.badge] : 0;
            const label =
              item.href === "/" ? "Início" : item.href === "/agenda/pendentes" ? "Pendentes" : item.label;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(itemClass, active ? "text-brand-700 dark:text-brand-300" : "text-ink-500 dark:text-ink-400")}
              >
                <span
                  className={cn(
                    "relative flex h-6 w-10 items-center justify-center rounded-lg transition",
                    active && "bg-brand-50 dark:bg-brand-950",
                  )}
                >
                  <Icon className="size-4.5" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
                  {count > 0 ? (
                    <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-amber-500 px-1 text-[9px] font-bold leading-4 text-white">
                      <span className="sr-only">Quantidade: </span>
                      {count}
                    </span>
                  ) : null}
                </span>
                <span className="w-full truncate text-center">{label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setIsMoreOpen(true)}
            aria-expanded={isMoreOpen}
            aria-haspopup="dialog"
            className={cn(itemClass, secondaryActive ? "text-brand-700 dark:text-brand-300" : "text-ink-500 dark:text-ink-400")}
          >
            <span className={cn("flex h-6 w-10 items-center justify-center rounded-lg", secondaryActive && "bg-brand-50 dark:bg-brand-950")}>
              <Menu className="size-4.5" aria-hidden="true" />
            </span>
            <span className="w-full truncate text-center">Mais</span>
          </button>
        </div>
      </nav>

      <Modal open={isMoreOpen} onClose={() => setIsMoreOpen(false)} title="Menu">
        <div className="grid gap-1 p-3">
          {secondary.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                onClick={() => setIsMoreOpen(false)}
                className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-ink-700 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-950", pathname === item.href && "bg-brand-50 dark:bg-brand-950")}
              >
                <Icon className="size-4.5 text-ink-400" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
          <a
            href="/agendar"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-ink-700 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-950"
          >
            <Globe className="size-4.5 text-ink-400" aria-hidden="true" />
            Portal da cliente
          </a>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-ink-700 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-950"
          >
            <LogOut className="size-4.5 text-ink-400" aria-hidden="true" />
            Sair
          </button>
        </div>
      </Modal>
    </>
  );
}
