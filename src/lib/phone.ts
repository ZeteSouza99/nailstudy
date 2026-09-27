/** Mantém apenas os dígitos, descartando máscara e o código do país. */
export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length > 11 && digits.startsWith("55")) {
    return digits.slice(2);
  }
  return digits;
}

export function isValidPhone(value: string) {
  const digits = normalizePhone(value);
  return digits.length === 10 || digits.length === 11;
}

/** Formata para (11) 91234-5678, caindo no valor original se não reconhecer. */
export function formatPhone(value: string) {
  const digits = normalizePhone(value);
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return value;
}

/** Oculta o miolo do número para exibição pública: (11) 9****-5678. */
export function maskPhone(value: string) {
  const digits = normalizePhone(value);
  if (digits.length < 10) return "";
  const ddd = digits.slice(0, 2);
  const last = digits.slice(-4);
  return `(${ddd}) ${"*".repeat(digits.length - 6)}-${last}`;
}
