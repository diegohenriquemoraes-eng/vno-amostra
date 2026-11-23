// Robô da palavra AMOSTRA do @vendanaobra (23/11/2026, estratégia "seguidor novo → Caderno",
// aprovada pelo Diego: "Sim, começa tudo").
// Quem comenta exatamente AMOSTRA em qualquer post de até 90 dias recebe, por resposta privada
// ao comentário, o link da amostra grátis dos 5 passos (vendanaobra.com.br/a/<código>, um código
// por pessoa, o clique fica gravado no Blob do site) + "Te mandei no direct!" em público.
// Regras herdadas do vno-direct: uma vez por pessoa para sempre, nunca para quem já conversa no
// direct (essa fica sem resposta e aparece no app vno-comentarios para o Diego), nunca story,
// comentário de até 7 dias (limite da Meta), SAIR/EXCLUIR respeitados (roteiros.json nao_enviar).
// Preço nunca no direct (regra de 08/10/2026). Quem responder é do Diego, por áudio.
//
// REPO PÚBLICO (minutos do Actions grátis): este script NUNCA imprime @, nome, texto ou código.
// Só contagens. O detalhe vai para o repo PRIVADO vno-direct-estado (conversas.json, log/).
import { randomBytes } from "node:crypto";
import * as meta from "./lib/meta.js";
import { ler, mudar, anotar, agora } from "./lib/estado.js";

const PALAVRA = "amostra";
const DIA = 86400e3;
const DIAS_POSTS = 90;
const DIAS_PRIVADA = 7;
const INICIO = new Date("2026-11-23T18:00:00Z");
const SITE = "https://vendanaobra.com.br/a/";
const RESPOSTAS_PUBLICAS = ["Te mandei no direct!", "Te chamei no direct!", "Olha teu direct!", "Te mandei mensagem no direct!"];

export const norm = (t) => (t || "").normalize("NFD").replace(/\p{Mn}/gu, "").toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function texto(codigo) {
  return [
    "Olá! Diego aqui\nVi que você pediu a amostra",
    "São os 5 passos do meu método de vendas: Atração, Conexão, Diagnóstico, Oferta e Decisão\nUma ficha de cada para você usar amanhã",
    `Aqui: ${SITE}${codigo}`,
    "Depois me conta qual passo mais trava a sua venda hoje",
  ].join("\n\n");
}

const codigoNovo = () => {
  const a = "abcdefghjkmnpqrstuvwxyz23456789";
  return [...randomBytes(7)].map((b) => a[b % a.length]).join("");
};

async function comentarios(id) {
  const saida = [];
  let depois = null;
  for (;;) {
    const campos = { fields: "id,text,timestamp,from,username", limit: "50" };
    if (depois) campos.after = depois;
    const r = await meta.get(`${id}/comments`, campos);
    if (r.error) throw new Error(`comentários: ${r.error.message}`);
    saida.push(...(r.data || []));
    depois = r.paging?.cursors?.after;
    if (!r.paging?.next) return saida;
  }
}

async function posts() {
  const campos = { fields: "id,shortcode,timestamp,comments_count,media_product_type", limit: "100" };
  const lista = [];
  let r = await meta.get(`${meta.IG_ID}/media`, campos);
  for (;;) {
    if (r.error) throw new Error("lista de posts: " + r.error.message);
    lista.push(...(r.data || []));
    const ultimo = lista.at(-1);
    if (!r.paging?.next || !ultimo || Date.now() - new Date(ultimo.timestamp) > DIAS_POSTS * DIA) break;
    r = await meta.get(`${meta.IG_ID}/media`, { ...campos, after: r.paging.cursors.after });
  }
  return lista.filter((m) => Date.now() - new Date(m.timestamp) <= DIAS_POSTS * DIA && m.media_product_type !== "STORY");
}

// Devolve false quando precisa tentar de novo na próxima rodada.
async function atender(c, conta, sc, log, cont) {
  const uid = c.from?.id;
  if (!uid) return false;
  const ja = await meta.getPagina(`${meta.PAGE_ID}/conversations`, {
    platform: "instagram", user_id: uid, fields: "id,messages.limit(1){id}",
  });
  if (ja.error) { cont.erros++; return false; }
  const conversa = (ja.data || []).some((x) => x.messages?.data?.length);
  const codigo = codigoNovo();
  let minha = false;
  await mudar("conversas.json", {}, (conv) => {
    if (conv[conta]) return false;
    conv[conta] = {
      formato: conversa ? "ja-conversa" : "amostra", post: sc, comentario: (c.text || "").slice(0, 200),
      t1: null, respondeu: null, igsid: uid, via: "amostra-actions", codigo, obs: "",
    };
    minha = true;
  }, `${conversa ? "já conversa" : "amostra"}: ${conta} (reserva)`);
  if (!minha) return true;
  if (conversa) {
    cont.ja_conversa++;
    log.push(`@${conta} (${sc}): pediu AMOSTRA, mas já tem conversa no direct: nada enviado (fica para o Diego no vno-comentarios)`);
    return true;
  }
  const env = await meta.mensagem({ comment_id: c.id }, { text: texto(codigo) });
  if (env.error) {
    cont.erros++;
    await mudar("conversas.json", {}, (conv) => { conv[conta].obs = `${agora()} amostra falhou (${env.error.message})`; }, `amostra falhou: ${conta}`);
    log.push(`@${conta} (${sc}): amostra FALHOU (${env.error.message})`);
    return true;
  }
  const pub = await meta.responderPublico(c.id, RESPOSTAS_PUBLICAS[Math.floor(Math.random() * RESPOSTAS_PUBLICAS.length)]);
  await mudar("conversas.json", {}, (conv) => {
    conv[conta].t1 = agora();
    conv[conta].resposta_publica = pub.error ? null : agora();
  }, `amostra: ${conta}`);
  cont.enviadas++;
  log.push(`@${conta} (${sc}): amostra enviada (código ${codigo})${pub.error ? `, resposta pública falhou (${pub.error.message})` : " + resposta pública"}`);
  return true;
}

export async function rodada() {
  const cont = { posts: 0, lidos: 0, pedidos: 0, enviadas: 0, ja_conversa: 0, erros: 0 };
  const log = [];
  const { dados: roteiros } = await ler("roteiros.json", { posts: {} });
  const lista = Array.isArray(roteiros.nao_enviar) ? roteiros.nao_enviar : Object.keys(roteiros.nao_enviar || {});
  const nao = new Set(lista.map((x) => String(x).toLowerCase().replace(/^@/, "")));
  const { dados: contagem } = await ler("contagem-amostra.json", {});
  const antes = JSON.stringify(contagem);
  let conv = null;
  for (const m of await posts()) {
    cont.posts++;
    if (!m.comments_count || contagem[m.shortcode] === m.comments_count) continue;
    cont.lidos++;
    conv ??= (await ler("conversas.json", {})).dados;
    let ok = true;
    for (const c of await comentarios(m.id)) {
      if (norm(c.text) !== PALAVRA) continue;
      const conta = (c.username || "").toLowerCase();
      if (!conta || conta === "vendanaobra" || nao.has(conta) || conv[conta]) continue;
      const t = new Date(c.timestamp);
      if (t < INICIO || Date.now() - t > DIAS_PRIVADA * DIA) continue;
      cont.pedidos++;
      if (await atender(c, conta, m.shortcode, log, cont)) conv[conta] = { formato: "amostra" };
      else ok = false;
    }
    if (ok) contagem[m.shortcode] = m.comments_count;
  }
  if (JSON.stringify(contagem) !== antes) {
    await mudar("contagem-amostra.json", {}, (c) => { Object.assign(c, contagem); }, "contagem amostra");
  }
  if (log.length) await anotar(log);
  return cont;
}

if (process.argv[1]?.endsWith("amostra.mjs")) {
  // Só contagens no log público do Actions.
  console.log(JSON.stringify(await rodada()));
}
