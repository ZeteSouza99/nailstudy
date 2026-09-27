import { describe, expect, it } from "vitest";

import { makeAppointment, makeBlock, makeProfessional } from "@/test/factories";

import {
  getAvailableSlots,
  groupSlotsByTime,
  hasEnoughLeadTime,
  isAccessLinkExpired,
  isActiveAppointment,
  MIN_CANCEL_LEAD_TIME_MINUTES,
  MIN_LEAD_TIME_MINUTES,
} from "./booking";
import { formatPhone, isValidPhone, maskPhone, normalizePhone } from "./phone";

const professional = makeProfessional({
  workDays: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
});

describe("hasEnoughLeadTime", () => {
  it("aceita datas futuras e rejeita passadas", () => {
    expect(hasEnoughLeadTime("2026-09-10", "08:00", "2026-09-02", "18:00")).toBe(true);
    expect(hasEnoughLeadTime("2026-09-01", "10:00", "2026-09-02", "08:00")).toBe(false);
  });

  it("exige a antecedência mínima no mesmo dia", () => {
    expect(hasEnoughLeadTime("2026-09-02", "10:30", "2026-09-02", "10:00")).toBe(false);
    expect(hasEnoughLeadTime("2026-09-02", "11:00", "2026-09-02", "10:00")).toBe(true);
    expect(MIN_LEAD_TIME_MINUTES).toBe(60);
  });

  it("não cria janela morta entre agendar e cancelar", () => {
    // Se cancelar exigisse mais antecedência que agendar, a cliente poderia
    // criar um agendamento sem conseguir desmarcá-lo em seguida.
    expect(MIN_CANCEL_LEAD_TIME_MINUTES).toBeLessThanOrEqual(MIN_LEAD_TIME_MINUTES);
    expect(
      hasEnoughLeadTime(
        "2026-09-02",
        "11:00",
        "2026-09-02",
        "10:00",
        MIN_CANCEL_LEAD_TIME_MINUTES,
      ),
    ).toBe(true);
  });
});

describe("isActiveAppointment / isAccessLinkExpired", () => {
  it("considera ativos só os agendamentos ainda em aberto", () => {
    expect(isActiveAppointment({ status: "confirmed" })).toBe(true);
    expect(isActiveAppointment({ status: "cancelled" })).toBe(false);
    expect(isActiveAppointment({ status: "completed" })).toBe(false);
  });

  it("mantém o link por alguns dias após o atendimento", () => {
    expect(isAccessLinkExpired("2026-09-01", "2026-09-08")).toBe(false);
    expect(isAccessLinkExpired("2026-09-01", "2026-09-09")).toBe(true);
  });
});

describe("getAvailableSlots", () => {
  const base = {
    date: "2026-09-10",
    service: { id: "srv-1", durationMinutes: 60, bufferMinutes: 0 },
    professionals: [professional],
    today: "2026-09-02",
    currentTime: "10:00",
  };

  it("gera horários dentro do expediente", () => {
    const slots = getAvailableSlots({ ...base, appointments: [] });
    expect(slots[0].startTime).toBe("08:00");
    expect(slots.at(-1)?.startTime).toBe("18:00");
  });

  it("remove horários que conflitam com agendamentos ativos", () => {
    const times = getAvailableSlots({
      ...base,
      appointments: [makeAppointment({ date: "2026-09-10" })],
    }).map((slot) => slot.startTime);

    expect(times).not.toContain("09:30");
    expect(times).not.toContain("10:00");
    expect(times).not.toContain("10:30");
    expect(times).toContain("11:00");
  });

  it("reserva o tempo de preparo do serviço", () => {
    const times = getAvailableSlots({
      ...base,
      service: { ...base.service, bufferMinutes: 30 },
      appointments: [makeAppointment({ date: "2026-09-10" })],
    }).map((slot) => slot.startTime);

    // O slot das 09:00 terminaria às 10:00 + 30 min de preparo, invadindo o atendimento.
    expect(times).not.toContain("09:00");
    expect(times).toContain("08:30");
    expect(times).toContain("11:00");
  });

  it("ignora cancelados e o próprio agendamento ao remarcar", () => {
    const cancelled = getAvailableSlots({
      ...base,
      appointments: [makeAppointment({ date: "2026-09-10", status: "cancelled" })],
    });
    expect(cancelled.map((slot) => slot.startTime)).toContain("10:00");

    const own = getAvailableSlots({
      ...base,
      appointments: [makeAppointment({ id: "apt-x", date: "2026-09-10" })],
      excludeAppointmentId: "apt-x",
    });
    expect(own.map((slot) => slot.startTime)).toContain("10:00");
  });

  it("respeita jornada, intervalo e bloqueios da profissional", () => {
    const partTime = makeProfessional({
      workDays: ["Qui"],
      workStart: "09:00",
      workEnd: "14:00",
      breakStart: "12:00",
      breakEnd: "13:00",
    });
    const times = getAvailableSlots({
      ...base,
      professionals: [partTime],
      appointments: [],
      blocks: [makeBlock({ startDate: "2026-09-10", endDate: "2026-09-10", startTime: "09:00", endTime: "10:00" })],
    }).map((slot) => slot.startTime);

    expect(times).toEqual(["10:00", "10:30", "11:00", "13:00"]);
  });

  it("não oferece horários em domingos, datas passadas, inativas ou além do limite", () => {
    expect(getAvailableSlots({ ...base, date: "2026-09-13", appointments: [] })).toHaveLength(0);
    expect(getAvailableSlots({ ...base, date: "2026-09-01", appointments: [] })).toHaveLength(0);
    expect(getAvailableSlots({ ...base, date: "2026-12-31", appointments: [] })).toHaveLength(0);
    expect(
      getAvailableSlots({
        ...base,
        professionals: [makeProfessional({ active: false })],
        appointments: [],
      }),
    ).toHaveLength(0);
  });

  it("respeita a antecedência mínima no próprio dia", () => {
    const times = getAvailableSlots({ ...base, date: "2026-09-02", appointments: [] }).map(
      (slot) => slot.startTime,
    );
    expect(times).not.toContain("10:30");
    expect(times).toContain("11:00");
  });

  it("agrupa profissionais livres no mesmo horário", () => {
    const other = makeProfessional({ id: "pro-2", name: "Bia", workDays: professional.workDays });
    const grouped = groupSlotsByTime(
      getAvailableSlots({ ...base, professionals: [professional, other], appointments: [] }),
    );
    expect(grouped[0]).toMatchObject({ startTime: "08:00" });
    expect(grouped[0].options.map((slot) => slot.professionalName)).toEqual(["Ana", "Bia"]);
  });
});

describe("phone", () => {
  it("remove máscara e o código do país", () => {
    expect(normalizePhone("+55 (11) 91234-5678")).toBe("11912345678");
  });

  it("valida telefones com 10 e 11 dígitos e formata", () => {
    expect(isValidPhone("(11) 91234-5678")).toBe(true);
    expect(isValidPhone("(11) 1234-5678")).toBe(true);
    expect(isValidPhone("1234")).toBe(false);
    expect(formatPhone("11912345678")).toBe("(11) 91234-5678");
  });

  it("oculta o miolo do número", () => {
    expect(maskPhone("11912345678")).toBe("(11) *****-5678");
  });
});
