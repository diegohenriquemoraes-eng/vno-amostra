// Graph API da Meta com o token de sistema (não expira). A mensagem privada sai
// pela Página "Venda na Obra", com o token dela: pelo id do Instagram a Meta
// responde "(#3) Application does not have the capability" (pago em 02/09/2026).

const API = "https://graph.facebook.com/v21.0";
export const IG_ID = "17841470188725651";
export const PAGE_ID = "1272959582565285";

let tokenPagina = null;

async function chamar(metodo, caminho, campos, token) {
  const q = new URLSearchParams({ ...campos, access_token: token });
  const r = metodo === "GET"
    ? await fetch(`${API}/${caminho}?${q}`)
    : await fetch(`${API}/${caminho}`, { method: "POST", body: q });
  const j = await r.json().catch(() => ({ error: { message: `HTTP ${r.status}` } }));
  return j;
}

export const get = (caminho, campos = {}) => chamar("GET", caminho, campos, process.env.META_TOKEN);

async function pagina() {
  if (!tokenPagina) {
    const r = await get("me/accounts", { fields: "id,access_token" });
    tokenPagina = (r.data || []).find((p) => p.id === PAGE_ID)?.access_token;
    if (!tokenPagina) throw new Error("sem token da Página: " + JSON.stringify(r.error || {}));
  }
  return tokenPagina;
}

export async function getPagina(caminho, campos = {}) {
  return chamar("GET", caminho, campos, await pagina());
}

export async function mensagem(destino, conteudo) {
  return chamar("POST", `${PAGE_ID}/messages`, {
    recipient: JSON.stringify(destino), message: JSON.stringify(conteudo),
  }, await pagina());
}

export async function responderPublico(commentId, texto) {
  return chamar("POST", `${commentId}/replies`, { message: texto }, process.env.META_TOKEN);
}

// Webhook: a Página precisa estar assinada no app para os avisos do Instagram chegarem
// (comentário e menção; "messages" pede pages_messaging, que o app não tem: a resposta no direct
// continua pela leitura a cada minuto). Rodado uma vez por /api/vigia?diag=assinar (19/10/2026).
export async function assinarPagina() {
  const t = await pagina();
  const feito = await chamar("POST", `${PAGE_ID}/subscribed_apps`, { subscribed_fields: "feed,mention" }, t);
  const agora = await chamar("GET", `${PAGE_ID}/subscribed_apps`, {}, t);
  return { feito, agora };
}

// Quais permissões o META_TOKEN tem (sem mostrar o token): /api/vigia?diag=escopos
export async function escopos() {
  const t = process.env.META_TOKEN;
  const r = await chamar("GET", "debug_token", { input_token: t }, t);
  const d = r.data || {};
  return { erro: r.error?.message, app: d.app_id, usuario: d.user_id, expira: d.expires_at, escopos: d.scopes };
}
