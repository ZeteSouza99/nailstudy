import { describe, expect, it } from "vitest";

import { makeAppointment } from "@/test/factories";

import { can, canChangeAppointmentStatus } from "./permissions";
import {
  blockSchema,
  clientSchema,
  fieldErrorsFrom,
  formDataToObject,
  professionalSchema,
  serviceSchema,
} from "./validation";

describe("serviceSchema", () => {
  const valid = {
    name: "Hidratação",
    category: "Facial",
    description: "Hidratação profunda.",
    durationMinutes: "60",
    bufferMinutes: "",
    price: "150,50",
    color: "#0f766e",
  };

  it("aceita valores vindos do formulário e o formato brasileiro de preço", () => {
    expect(serviceSchema.parse(valid)).toMatchObject({
      durationMinutes: 60,
      bufferMinutes: 0,
      price: 150.5,
      status: "active",
    });
    expect(serviceSchema.parse({ ...valid, price: "1.234,56" }).price).toBe(1234.56);
  });

  it("rejeita duração fora dos múltiplos de 5 e preço inválido", () => {
    const result = serviceSchema.safeParse({ ...valid, durationMinutes: "62", price: "abc" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(Object.keys(fieldErrorsFrom(result.error))).toEqual(
        expect.arrayContaining(["durationMinutes", "price"]),
      );
    }
  });

  it("é idempotente para o reenvio ao servidor", () => {
    const parsed = serviceSchema.parse(valid);
    expect(serviceSchema.parse(parsed)).toEqual(parsed);
  });
});

describe("professionalSchema", () => {
  const valid = {
    name: "Bruna Souza",
    role: "Esteticista",
    specialties: "Facial, Peelings",
    serviceIds: "srv-1",
    phone: "(11) 99999-9999",
    email: "bruna@clinica.com.br",
    color: "#0f766e",
    active: "on",
    workDays: ["Seg", "Ter"],
    workStart: "09:00",
    workEnd: "18:00",
    breakStart: "",
    breakEnd: "",
  };

  it("normaliza checkboxes e listas separadas por vírgula", () => {
    expect(professionalSchema.parse(valid)).toMatchObject({
      specialties: ["Facial", "Peelings"],
      serviceIds: ["srv-1"],
      active: true,
      breakStart: undefined,
    });
  });

  it("exige intervalo completo e dentro da jornada", () => {
    expect(professionalSchema.safeParse({ ...valid, breakStart: "12:00" }).success).toBe(false);
    expect(
      professionalSchema.safeParse({ ...valid, breakStart: "08:00", breakEnd: "09:30" }).success,
    ).toBe(false);
    expect(
      professionalSchema.safeParse({ ...valid, breakStart: "12:00", breakEnd: "13:00" }).success,
    ).toBe(true);
  });

  it("exige jornada dentro do expediente da clínica", () => {
    expect(professionalSchema.safeParse({ ...valid, workStart: "07:00" }).success).toBe(false);
  });
});

describe("clientSchema", () => {
  it("aceita e-mail e nascimento opcionais", () => {
    expect(
      clientSchema.parse({ name: "Ana Lima", phone: "(11) 91234-5678", email: "", birthDate: "", tags: "" }),
    ).toMatchObject({ email: undefined, birthDate: undefined, tags: [] });
  });

  it("rejeita nascimento no futuro", () => {
    expect(
      clientSchema.safeParse({ name: "Ana Lima", phone: "(11) 91234-5678", birthDate: "2999-01-01" })
        .success,
    ).toBe(false);
  });
});

describe("blockSchema", () => {
  it("exige horário quando não é dia inteiro", () => {
    const base = { startDate: "2026-10-01", endDate: "2026-10-01", reason: "Consulta médica" };
    expect(blockSchema.safeParse({ ...base, allDay: "on" }).success).toBe(true);
    expect(blockSchema.safeParse(base).success).toBe(false);
    expect(blockSchema.safeParse({ ...base, startTime: "14:00", endTime: "13:00" }).success).toBe(
      false,
    );
    expect(blockSchema.safeParse({ ...base, endDate: "2026-09-30", allDay: "on" }).success).toBe(
      false,
    );
  });
});

describe("formDataToObject", () => {
  it("agrupa campos repetidos em listas", () => {
    const formData = new FormData();
    formData.append("name", "Ana");
    formData.append("workDays", "Seg");
    formData.append("workDays", "Ter");
    expect(formDataToObject(formData)).toEqual({ name: "Ana", workDays: ["Seg", "Ter"] });
  });
});

describe("permissões", () => {
  const admin = { role: "admin" as const, professionalId: null };
  const reception = { role: "receptionist" as const, professionalId: null };
  const ana = { role: "professional" as const, professionalId: "pro-1" };

  it("restringe cadastros por perfil", () => {
    expect(can("admin", "catalog:manage")).toBe(true);
    expect(can("receptionist", "catalog:manage")).toBe(false);
    expect(can("receptionist", "clients:manage")).toBe(true);
    expect(can("professional", "clients:view")).toBe(false);
  });

  it("deixa a profissional só iniciar e concluir os próprios atendimentos", () => {
    const own = makeAppointment({ status: "confirmed", professionalId: "pro-1" });
    const other = makeAppointment({ status: "confirmed", professionalId: "pro-2" });

    expect(canChangeAppointmentStatus(ana, own, "in-progress")).toBe(true);
    expect(canChangeAppointmentStatus(ana, own, "cancelled")).toBe(false);
    expect(canChangeAppointmentStatus(ana, other, "in-progress")).toBe(false);
    expect(canChangeAppointmentStatus(reception, other, "cancelled")).toBe(true);
    expect(canChangeAppointmentStatus(admin, makeAppointment({ status: "completed" }), "cancelled")).toBe(
      false,
    );
  });
});
