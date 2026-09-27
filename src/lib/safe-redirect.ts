/** Só caminhos internos: "//site" e "/\site" seriam tratados como outro domínio pelo navegador. */
export function safeCallbackUrl(value: string | null | undefined) {
  return value && /^\/(?![/\\])/.test(value) ? value : "/";
}
