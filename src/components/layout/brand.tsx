import Image from "next/image";

/** O enquadramento destaca o monograma da imagem original nos espaços pequenos. */
export function BrandMark({ className = "size-11" }: { className?: string }) {
  return (
    <span className={`relative block shrink-0 overflow-hidden rounded-full border border-gold-400/50 bg-[#b98780] shadow-sm ${className}`}>
      <Image
        src="/erika-nails.png"
        alt="Monograma de Erika Queiroz"
        width={1466}
        height={1073}
        sizes="128px"
        className="absolute -left-3/4 -top-[8%] h-auto w-[250%] max-w-none"
      />
    </span>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <BrandMark />
      {!compact ? (
        <span>
          <span className="block font-serif text-[19px] leading-6 tracking-tight text-ink-900 dark:text-gold-200">
            Erika Queiroz
          </span>
          <span className="block text-[9px] font-semibold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
            Nail Designer
          </span>
        </span>
      ) : null}
    </div>
  );
}
