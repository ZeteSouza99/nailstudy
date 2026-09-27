import "server-only";

import { loadDatabase, type Database, type DatabaseHandle } from "./client";

export type { AtomicQueries } from "./client";

// Só conecta na primeira consulta: o `next dev` carrega rotas dinâmicas num processo à
// parte, e o PGlite não aceita duas instâncias na mesma pasta de dados.
const openDatabase = await loadDatabase(process.env.DATABASE_URL);

// Reaproveita a conexão entre recargas do dev server.
const globalForDb = globalThis as unknown as { __clinicDb?: DatabaseHandle };

function getHandle() {
  return (globalForDb.__clinicDb ??= openDatabase());
}

export const db = new Proxy({} as Database, {
  get(_target, property) {
    const instance = getHandle().db;
    const value: unknown = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export const atomic: DatabaseHandle["atomic"] = (queries) => getHandle().atomic(queries);
