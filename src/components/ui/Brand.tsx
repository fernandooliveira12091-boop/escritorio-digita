const base = import.meta.env.BASE_URL;

/**
 * Logo do escritório, sem fundo. No modo escuro usa a versão em que o azul-marinho
 * vira branco (o dourado fica igual), para o nome continuar legível.
 */
export function BrandLogo({ variant = "full", className = "" }: { variant?: "full" | "mono"; className?: string }) {
  const file = variant === "full" ? "logo" : "logo-mono";
  const size = variant === "full" ? "h-auto w-full" : "h-8 w-auto";
  const alt = "Fernando Oliveira Advocacia e Consultoria Jurídica";
  return (
    <span className={`inline-flex items-center justify-center ${className}`}>
      <img src={`${base}${file}.png`} alt={alt} className={`${size} dark:hidden`} />
      <img src={`${base}${file}-dark.png`} alt={alt} className={`${size} hidden dark:block`} />
    </span>
  );
}
