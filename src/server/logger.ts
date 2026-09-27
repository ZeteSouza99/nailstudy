import { DrizzleQueryError } from "drizzle-orm";

type LogLevel = "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

function write(level: LogLevel, message: string, context: LogContext = {}) {
  const line = JSON.stringify({
    level,
    message,
    time: new Date().toISOString(),
    ...context,
  });

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

/** Logs estruturados em JSON, prontos para a busca dos logs da Vercel. */
export const logger = {
  info: (message: string, context?: LogContext) => write("info", message, context),
  warn: (message: string, context?: LogContext) => write("warn", message, context),
  error: (message: string, context?: LogContext) => write("error", message, context),
};

/** Serializa erros sem os parâmetros das queries, que podem conter dados pessoais. */
export function serializeError(error: unknown, depth = 0): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { value: String(error) };
  }

  const serialized: Record<string, unknown> = {
    name: error.name,
    message: error instanceof DrizzleQueryError ? "Falha na consulta ao banco" : error.message,
    stack: error.stack,
  };

  if (error instanceof DrizzleQueryError) {
    serialized.query = error.query;
  }

  for (const key of ["code", "constraint", "digest"] as const) {
    const value = (error as unknown as Record<string, unknown>)[key];
    if (typeof value === "string") serialized[key] = value;
  }

  if (error.cause && depth < 3) {
    serialized.cause = serializeError(error.cause, depth + 1);
  }

  return serialized;
}
