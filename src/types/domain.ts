export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "in-progress"
  | "completed"
  | "cancelled";

export type ServiceStatus = "active" | "inactive";

/** Situação da profissional no momento, calculada a partir da agenda. */
export type ProfessionalStatus = "available" | "in-service" | "off-duty";

export type AppointmentSource = "staff" | "portal";

export type UserRole = "admin" | "receptionist" | "professional";

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  birthDate: string | null;
  tags: string[];
}

/** Cliente com os indicadores derivados dos atendimentos. */
export interface ClientSummary extends Client {
  lastVisit: string | null;
  completedAppointments: number;
  nextAppointment: { date: string; startTime: string } | null;
}

export interface Service {
  id: string;
  name: string;
  category: string;
  description: string;
  durationMinutes: number;
  /** Tempo de preparo/higienização após o atendimento. */
  bufferMinutes: number;
  /** Valor em reais; o banco guarda centavos. */
  price: number;
  status: ServiceStatus;
  color: string;
}

export interface Professional {
  id: string;
  name: string;
  role: string;
  specialties: string[];
  serviceIds: string[];
  phone: string;
  email: string;
  color: string;
  active: boolean;
  workDays: string[];
  workStart: string;
  workEnd: string;
  breakStart: string | null;
  breakEnd: string | null;
  /** Percentual de comissão sobre os atendimentos (0 a 100). O banco guarda basis points. */
  commissionRate: number;
}

export interface Appointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  bufferMinutes: number;
  clientId: string;
  clientName: string;
  serviceId: string;
  serviceName: string;
  professionalId: string;
  professionalName: string;
  status: AppointmentStatus;
  price: number;
  notes?: string;
  source: AppointmentSource;
}

export interface ScheduleBlock {
  id: string;
  /** Nulo quando o bloqueio vale para o estúdio inteiro. */
  professionalId: string | null;
  startDate: string;
  endDate: string;
  /** Nulos quando o bloqueio ocupa o dia inteiro. */
  startTime: string | null;
  endTime: string | null;
  reason: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  professionalId: string | null;
}

export type PaymentStatus = "paid" | "refunded";

export type PaymentMethodKind =
  | "pix"
  | "cash"
  | "credit"
  | "debit"
  | "transfer"
  | "other";

/** Uma das formas usadas para quitar um recibo. */
export interface PaymentMethodEntry {
  method: PaymentMethodKind;
  amount: number;
}

/** Um atendimento cobrado no recibo, com o valor e a comissão de quem atendeu. */
export interface PaymentItem {
  appointmentId: string;
  professionalId: string;
  professionalName: string;
  serviceId: string;
  serviceName: string;
  price: number;
  /** Percentual aplicado no momento do pagamento (0 a 100). */
  commissionRate: number;
  commission: number;
}

export interface Payment {
  id: string;
  clientId: string;
  clientName: string;
  /** Data do pagamento (YYYY-MM-DD). */
  paidAt: string;
  subtotal: number;
  discount: number;
  surcharge: number;
  total: number;
  status: PaymentStatus;
  notes: string | null;
  items: PaymentItem[];
  methods: PaymentMethodEntry[];
  createdAt: string;
}

/** Atendimento concluído ainda sem pagamento registrado. */
export interface BillableAppointment {
  id: string;
  date: string;
  clientId: string;
  clientName: string;
  serviceId: string;
  serviceName: string;
  professionalId: string;
  professionalName: string;
  price: number;
  commissionRate: number;
}
