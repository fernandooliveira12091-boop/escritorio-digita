const base = import.meta.env.BASE_URL;

/**
 * Logo do escritório. Fica sobre uma placa branca porque o azul-marinho da marca
 * some sobre o fundo escuro do modo noturno.
 */
export function BrandLogo({ variant = "full", className = "" }: { variant?: "full" | "mono"; className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-lg bg-white ${variant === "full" ? "px-3 py-2" : "p-1"} ${className}`}>
      <img
        src={`${base}${variant === "full" ? "logo.png" : "logo-mono.png"}`}
        alt="Fernando Oliveira Advocacia e Consultoria Jurídica"
        className={variant === "full" ? "h-auto w-full" : "h-7 w-auto"}
      />
    </span>
  );
}
