import {
  BarChart3,
  CalendarDays,
  CalendarOff,
  Inbox,
  LayoutDashboard,
  Scissors,
  UserRound,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { can, type Permission } from "@/lib/permissions";
import type { UserRole } from "@/types/domain";

/** Contadores calculados no servidor e exibidos ao lado do item. */
export type NavigationBadge = "todayActive" | "portalPending";

export type NavigationCounters = Record<NavigationBadge, number>;

export interface NavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: NavigationBadge;
  permission?: Permission;
  /** Aparece direto na barra inferior do celular; o resto fica em "Mais". */
  primaryOnMobile?: boolean;
}

export interface NavigationSection {
  label: string;
  items: NavigationItem[];
}

const navigationSections: NavigationSection[] = [
  {
    label: "Operação",
    items: [
      { label: "Visão geral", href: "/", icon: LayoutDashboard, primaryOnMobile: true },
      {
        label: "Agenda",
        href: "/agenda",
        icon: CalendarDays,
        badge: "todayActive",
        primaryOnMobile: true,
      },
      {
        label: "Pendentes do portal",
        href: "/agenda/pendentes",
        icon: Inbox,
        badge: "portalPending",
        permission: "appointments:manage",
        primaryOnMobile: true,
      },
    ],
  },
  {
    label: "Cadastros",
    items: [
      {
        label: "Clientes",
        href: "/clientes",
        icon: UsersRound,
        permission: "clients:view",
        primaryOnMobile: true,
      },
      { label: "Serviços", href: "/servicos", icon: Scissors, permission: "catalog:view" },
      {
        label: "Profissionais",
        href: "/profissionais",
        icon: UserRound,
        permission: "catalog:view",
      },
      { label: "Bloqueios", href: "/bloqueios", icon: CalendarOff, permission: "blocks:view" },
    ],
  },
  {
    label: "Financeiro",
    items: [
      {
        label: "Pagamentos",
        href: "/pagamentos",
        icon: Wallet,
        permission: "payments:view",
      },
      {
        label: "Relatórios",
        href: "/relatorios",
        icon: BarChart3,
        permission: "reports:view",
      },
    ],
  },
];

export function getNavigationSections(role: UserRole): NavigationSection[] {
  return navigationSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.permission || can(role, item.permission)),
    }))
    .filter((section) => section.items.length > 0);
}

export const routeMetadata: Record<string, { title: string; section: string }> = {
  "/": { title: "Visão geral", section: "Dashboard" },
  "/agenda": { title: "Agenda", section: "Atendimentos" },
  "/agenda/pendentes": { title: "Pendentes do portal", section: "Atendimentos" },
  "/clientes": { title: "Clientes", section: "Relacionamento" },
  "/servicos": { title: "Serviços", section: "Catálogo" },
  "/profissionais": { title: "Profissionais", section: "Equipe" },
  "/bloqueios": { title: "Bloqueios de agenda", section: "Equipe" },
  "/pagamentos": { title: "Pagamentos", section: "Financeiro" },
  "/relatorios": { title: "Relatórios", section: "Financeiro" },
};
