import { formatDate } from "@/lib/formatters";

export function getAppUrl() {
  const configured = process.env.APP_URL?.replace(/\/+$/, "");
  if (configured) return configured;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}

export function appointmentPath(token: string) {
  return `/meu-agendamento/${token}`;
}

export function appointmentUrl(token: string) {
  return `${getAppUrl()}${appointmentPath(token)}`;
}

interface AppointmentSummary {
  clientName: string;
  serviceName: string;
  professionalName: string;
  date: string;
  startTime: string;
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? "";
}

function when(appointment: AppointmentSummary) {
  const date = formatDate(appointment.date, {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  return `${date} às ${appointment.startTime}`;
}

export const messages = {
  requested: (appointment: AppointmentSummary, link: string) =>
    `Olá, ${firstName(appointment.clientName)}! Recebemos seu pedido de ${appointment.serviceName} com ${appointment.professionalName}, ${when(appointment)}. O estúdio vai confirmar em breve. Acompanhe, remarque ou cancele: ${link}`,
  created: (appointment: AppointmentSummary, link: string) =>
    `Olá, ${firstName(appointment.clientName)}! Seu horário de ${appointment.serviceName} com ${appointment.professionalName} ficou para ${when(appointment)}. Detalhes: ${link}`,
  confirmed: (appointment: AppointmentSummary, link: string) =>
    `Seu horário de ${appointment.serviceName}, ${when(appointment)}, está confirmado. Detalhes: ${link}`,
  cancelled: (appointment: AppointmentSummary) =>
    `Seu horário de ${appointment.serviceName}, ${when(appointment)}, foi cancelado. Para agendar de novo: ${getAppUrl()}/agendar`,
  rescheduled: (appointment: AppointmentSummary, link: string) =>
    `Seu horário de ${appointment.serviceName} foi remarcado para ${when(appointment)} com ${appointment.professionalName}. Detalhes: ${link}`,
  reminder: (appointment: AppointmentSummary, link: string) =>
    `Lembrete: amanhã, ${when(appointment)}, você tem ${appointment.serviceName} com ${appointment.professionalName}. Detalhes: ${link}`,
  recoveryCode: (code: string) =>
    `Seu código de acesso da Erika Queiroz Nail Designer é ${code}. Ele vale por 10 minutos.`,
};
