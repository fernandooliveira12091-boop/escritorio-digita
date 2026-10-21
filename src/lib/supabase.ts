import { createClient } from "@supabase/supabase-js";

// URL e chave publicável do projeto. A chave publicável foi feita para ficar no site:
// quem protege os dados são as regras de acesso do banco (supabase/schema.sql).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** Sem configuração, o sistema roda no modo demonstração (dados só no navegador). */
export const supabase = url && key
  ? createClient(url, key, { auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

export const cloudMode = !!supabase;

/** Endereço do site, para os links de confirmação de e-mail e de nova senha. */
export const siteUrl = () => `${location.origin}${location.pathname}`;
