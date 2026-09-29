import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** Ícone gerado no build: usa o monograma da própria imagem, sem redesenhar a marca. */
export default async function Icon() {
  const source = await readFile(join(process.cwd(), "public", "erika-nails.png"));
  return new ImageResponse(
    <div style={{ width: 64, height: 64, display: "flex", alignItems: "center", overflow: "hidden", borderRadius: 14, background: "#b98780" }}>
      <div style={{ width: 64, height: 53, display: "flex", position: "relative", overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renderiza a imagem no build. */}
        <img src={`data:image/png;base64,${source.toString("base64")}`} alt="" width={132} height={97} style={{ position: "absolute", left: -35, top: -4 }} />
      </div>
    </div>,
    size,
  );
}
