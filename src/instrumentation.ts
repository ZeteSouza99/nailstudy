import type { Instrumentation } from "next";

import { logger, serializeError } from "@/server/logger";

/** Toda falha não tratada em páginas, rotas e Server Actions vira um log estruturado. */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  logger.error("request_error", {
    error: serializeError(error),
    method: request.method,
    path: request.path,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
  });
};
