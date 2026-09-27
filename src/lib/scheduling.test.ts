import { describe, expect, it } from "vitest";

import { makeAppointment, makeBlock, makeProfessional } from "@/test/factories";

import {
  calculateDailyCapacityMinutes,
  calculateEndTime,
  canTransitionStatus,
  findSchedulingConflict,
  getProfessionalLiveStatus,
  getProfessionalWorkingMinutes,
  intervalsOverlap,
  isWithinBusinessHours,
  validateAppointment,
} from "./scheduling";

const professional = makeProfessional();

describe("intervalsOverlap", () => {
  it("detecta sobreposição parcial no início e no fim", () => {
    expect(intervalsOverlap("09:30", "10:30", "10:00", "11:00")).toBe(true);
    expect(intervalsOverlap("10:30", "11:30", "10:00", "11:00")).toBe(true);
  });

  it("detecta sobreposição total nos dois sentidos", () => {
    expect(intervalsOverlap("09:00", "12:00", "10:00", "11:00")).toBe(true);
    expect(intervalsOverlap("10:15", "10:45", "10:00", "11:00")).toBe(true);
  });

  it("permite intervalos adjacentes", () => {
    expect(intervalsOverlap("09:00", "10:00", "10:00", "11:00")).toBe(false);
    expect(intervalsOverlap("11:00", "12:00", "10:00", "11:00")).toBe(false);
  });
});

describe("findSchedulingConflict", () => {
  it("detecta conflito da profissional e da cliente no mesmo dia", () => {
    const existing = makeAppointment();
    const base = { date: existing.date, startTime: "10:30", endTime: "11:30" };

    expect(
      findSchedulingConflict(
        { ...base, clientId: "outra-cliente", professionalId: existing.professionalId },
        [existing],
      )?.type,
    ).toBe("professional");

    expect(
      findSchedulingConflict(
        { ...base, clientId: existing.clientId, professionalId: "outra-profissional" },
        [existing],
      )?.type,
    ).toBe("client");
  });

  it("ignora agendamentos cancelados e o próprio agendamento", () => {
    const cancelled = makeAppointment({ status: "cancelled" });
    const candidate = {
      date: cancelled.date,
      startTime: "10:15",
      endTime: "10:45",
      clientId: cancelled.clientId,
      professionalId: cancelled.professionalId,
    };

    expect(findSchedulingConflict(candidate, [cancelled])).toBeNull();
    expect(
      findSchedulingConflict({ ...candidate, excludeAppointmentId: "apt-1" }, [
        makeAppointment(),
      ]),
    ).toBeNull();
  });

  it("considera o tempo de preparo só para a profissional", () => {
    const existing = makeAppointment({ bufferMinutes: 15 });

    expect(
      findSchedulingConflict(
        { date: existing.date, startTime: "11:00", endTime: "12:00", professionalId: "pro-1" },
        [existing],
      )?.type,
    ).toBe("professional");

    expect(
      findSchedulingConflict(
        { date: existing.date, startTime: "11:15", endTime: "12:00", professionalId: "pro-1" },
        [existing],
      ),
    ).toBeNull();

    expect(
      findSchedulingConflict(
        {
          date: existing.date,
          startTime: "11:00",
          endTime: "12:00",
          clientId: existing.clientId,
          professionalId: "outra",
        },
        [existing],
      ),
    ).toBeNull();
  });
});

describe("jornada da clínica", () => {
  it("aceita os limites de 08:00 a 19:00 e rejeita término posterior", () => {
    expect(isWithinBusinessHours("08:00", "19:00")).toBe(true);
    expect(isWithinBusinessHours("07:45", "08:45")).toBe(false);
    expect(isWithinBusinessHours("18:30", "19:15")).toBe(false);
  });

  it("não mascara uma virada de dia ao calcular o término", () => {
    expect(calculateEndTime("23:30", 90)).toBe("25:00");
  });
});

describe("validateAppointment", () => {
  const draft = {
    date: "2026-08-25",
    startTime: "14:00",
    durationMinutes: 60,
    clientId: "cli-2",
    professionalId: professional.id,
    serviceId: "srv-1",
  };
  const context = { professional, appointments: [], referenceDate: "2026-08-25" };

  it("aceita um horário válido em dia de trabalho", () => {
    expect(validateAppointment(draft, context)).toEqual({ valid: true, endTime: "15:00" });
  });

  it("rejeita dia fora da jornada da profissional", () => {
    expect(validateAppointment({ ...draft, date: "2026-08-29" }, context)).toMatchObject({
      valid: false,
      code: "off-duty",
    });
  });

  it("rejeita datas anteriores e domingos", () => {
    expect(validateAppointment({ ...draft, date: "2026-08-24" }, context)).toMatchObject({
      code: "past-date",
    });
    expect(validateAppointment({ ...draft, date: "2026-08-30" }, context)).toMatchObject({
      code: "sunday",
    });
  });

  it("rejeita horário passado no dia de referência e aceita um futuro", () => {
    const now = { ...context, referenceTime: "09:00" };
    expect(validateAppointment({ ...draft, startTime: "08:00" }, now)).toMatchObject({
      code: "past-date",
    });
    expect(validateAppointment(draft, now)).toEqual({ valid: true, endTime: "15:00" });
  });

  it("rejeita profissional inativa", () => {
    expect(
      validateAppointment(draft, {
        ...context,
        professional: makeProfessional({ active: false }),
      }),
    ).toMatchObject({ code: "inactive-professional" });
  });

  it("respeita o horário e o intervalo da profissional", () => {
    const partTime = makeProfessional({
      workStart: "09:00",
      workEnd: "15:00",
      breakStart: "12:00",
      breakEnd: "13:00",
    });
    const partTimeContext = { ...context, professional: partTime };

    expect(
      validateAppointment({ ...draft, startTime: "08:00" }, partTimeContext),
    ).toMatchObject({ code: "outside-professional-hours" });
    expect(
      validateAppointment({ ...draft, startTime: "14:30" }, partTimeContext),
    ).toMatchObject({ code: "outside-professional-hours" });
    expect(
      validateAppointment({ ...draft, startTime: "11:30" }, partTimeContext),
    ).toMatchObject({ code: "break-time" });
    expect(validateAppointment({ ...draft, startTime: "13:00" }, partTimeContext)).toEqual({
      valid: true,
      endTime: "14:00",
    });
  });

  it("respeita bloqueios da clínica e da profissional", () => {
    expect(
      validateAppointment(draft, { ...context, blocks: [makeBlock()] }),
    ).toMatchObject({ code: "blocked" });

    const partial = makeBlock({ professionalId: "pro-1", startTime: "14:30", endTime: "16:00" });
    expect(
      validateAppointment(draft, { ...context, blocks: [partial] }),
    ).toMatchObject({ code: "blocked" });
    expect(
      validateAppointment({ ...draft, startTime: "16:00" }, { ...context, blocks: [partial] }),
    ).toMatchObject({ valid: true });

    const otherProfessional = makeBlock({ professionalId: "pro-2" });
    expect(
      validateAppointment(draft, { ...context, blocks: [otherProfessional] }),
    ).toMatchObject({ valid: true });
  });
});

describe("capacidade", () => {
  it("desconta intervalo e bloqueios parciais, e zera em bloqueio de dia inteiro", () => {
    const withBreak = makeProfessional({ breakStart: "12:00", breakEnd: "13:00" });
    expect(getProfessionalWorkingMinutes(withBreak, "2026-08-25")).toBe(600);

    const partial = makeBlock({ startTime: "08:00", endTime: "10:00" });
    expect(getProfessionalWorkingMinutes(withBreak, "2026-08-25", [partial])).toBe(480);
    expect(getProfessionalWorkingMinutes(withBreak, "2026-08-25", [makeBlock()])).toBe(0);
  });

  it("não conta profissionais inativas nem dias de folga", () => {
    const team = [professional, makeProfessional({ id: "pro-2", active: false })];
    expect(calculateDailyCapacityMinutes("2026-08-25", team)).toBe(660);
    expect(calculateDailyCapacityMinutes("2026-08-29", team)).toBe(0);
  });
});

describe("getProfessionalLiveStatus", () => {
  it("deriva a situação a partir da agenda e da jornada", () => {
    const inProgress = makeAppointment({ status: "in-progress" });
    expect(getProfessionalLiveStatus(professional, [inProgress], "2026-08-25", "10:30")).toBe(
      "in-service",
    );
    expect(getProfessionalLiveStatus(professional, [], "2026-08-25", "10:30")).toBe("available");
    expect(getProfessionalLiveStatus(professional, [], "2026-08-25", "20:00")).toBe("off-duty");
    expect(getProfessionalLiveStatus(professional, [], "2026-08-29", "10:30")).toBe("off-duty");
  });
});

describe("canTransitionStatus", () => {
  it("segue o fluxo do atendimento e trava estados finais", () => {
    expect(canTransitionStatus("scheduled", "confirmed")).toBe(true);
    expect(canTransitionStatus("confirmed", "in-progress")).toBe(true);
    expect(canTransitionStatus("in-progress", "completed")).toBe(true);
    expect(canTransitionStatus("completed", "cancelled")).toBe(false);
    expect(canTransitionStatus("cancelled", "scheduled")).toBe(false);
  });
});
