export const E2E_PORT = Number(process.env.E2E_PORT ?? 3100);
export const E2E_DATABASE_DIR = ".e2e-db";

/** Segredos fixos só valem para o servidor descartável dos testes. */
export const e2eEnv = {
  DATABASE_URL: `pglite:./${E2E_DATABASE_DIR}`,
  AUTH_SECRET: "e2e-auth-secret-nao-usar-em-producao",
  AUTH_TRUST_HOST: "true",
  NOTIFY_DRIVER: "log",
  APP_URL: `http://localhost:${E2E_PORT}`,
};

export const e2eUsers = {
  admin: {
    email: "admin@e2e.test",
    name: "Admin E2E",
    password: "senha-admin-e2e",
    role: "admin" as const,
  },
  reception: {
    email: "recepcao@e2e.test",
    name: "Recepção E2E",
    password: "senha-recepcao-e2e",
    role: "receptionist" as const,
  },
  professional: {
    email: "ana@e2e.test",
    name: "Amanda Souza",
    password: "senha-profissional-e2e",
    role: "professional" as const,
    professionalId: "pro-001",
  },
};
