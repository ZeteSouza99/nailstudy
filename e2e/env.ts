import { generateVAPIDKeys } from "web-push";

const pushKeys = generateVAPIDKeys();

export const E2E_PORT = Number(process.env.E2E_PORT ?? 3100);
export const E2E_DATABASE_DIR = ".e2e-db";

/** Segredos fixos só valem para o servidor descartável dos testes. */
export const e2eEnv = {
  DATABASE_URL: `pglite:./${E2E_DATABASE_DIR}`,
  AUTH_SECRET: "e2e-auth-secret-nao-usar-em-producao",
  AUTH_TRUST_HOST: "true",
  NOTIFY_DRIVER: "log",
  APP_URL: `http://localhost:${E2E_PORT}`,
  VAPID_PUBLIC_KEY: pushKeys.publicKey,
  VAPID_PRIVATE_KEY: pushKeys.privateKey,
  VAPID_SUBJECT: "mailto:admin@e2e.test",
};

export const e2eUsers = {
  admin: {
    username: "Erika",
    email: "admin@e2e.test",
    name: "Erika",
    password: "senha-admin-e2e",
  },
};
