// Placar de sexta do funil seguidor novo → Caderno (23/11/2026, frente G da estratégia).
// Roda no Actions (sexta 09h BRT) e grava placar/AAAA-MM-DD.md no repo PRIVADO vno-direct-estado.
// O log do Actions é público: aqui só sai "ok".
//
// Etapas, últimos 7 dias:
//   alcance · visitas ao perfil · toques no link (Instagram, conta)
//   seguidores novos (follower_count, soma diária)
//   comentários AMOSTRA atendidos · já conversavam · responderam (conversas.json, via amostra-actions)
//   cliques no link da amostra (Blob privado do site: amostra/<código>/<hora>, robô de prévia não conta)
//   Cadernos vendidos (base.json do ecossistema-vno, que o webhook da Kiwify alimenta)
// Régua: 05/12 toques÷visitas ≥ 6% (era 2%) · 19/12 ≥ 1 Caderno por 1.000 seguidores novos e
// cliques na amostra → clique no checkout ≥ 8% (checkout não é medido aqui: proxy = Caderno vendido).
import * as meta from "./lib/meta.js";
import { ler } from "./lib/estado.js";

const DIA = 86400e3;
const fim = new Date();
const ini = new Date(fim - 7 * DIA);
const s = (d) => Math.floor(d / 1000);
const br = (d) => new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

async function conta() {
  const out = {};
  const r = await meta.get(`${meta.IG_ID}/insights`, {
    metric: "reach,profile_views,website_clicks", period: "day", metric_type: "total_value",
    since: String(s(ini)), until: String(s(fim)),
  });
  for (const m of r.data || []) out[m.name] = m.total_value?.value ?? 0;
  const f = await meta.get(`${meta.IG_ID}/insights`, {
    metric: "follower_count", period: "day", since: String(s(ini)), until: String(s(fim)),
  });
  out.seguidores_novos = (f.data?.[0]?.values || []).reduce((a, v) => a + (v.value || 0), 0);
  const c = await meta.get(meta.IG_ID, { fields: "followers_count" });
  out.seguidores = c.followers_count;
  return out;
}

async function cliques() {
  const token = process.env.BLOB_TOKEN;
  if (!token) return null;
  const pessoas = new Set();
  let total = 0, cursor = null;
  do {
    const q = new URLSearchParams({ prefix: "amostra/", limit: "1000" });
    if (cursor) q.set("cursor", cursor);
    const r = await (await fetch(`https://vercel.com/api/blob/?${q}`, {
      headers: { authorization: `Bearer ${token}`, "x-api-version": "12" },
    })).json();
    for (const b of r.blobs || []) {
      const [, codigo, hora] = b.pathname.split("/");
      if (Number(hora.replace(".txt", "")) < ini.getTime() || codigo.startsWith("teste")) continue;
      total++;
      pessoas.add(codigo);
    }
    cursor = r.hasMore ? r.cursor : null;
  } while (cursor);
  return { total, pessoas: pessoas.size, codigos: pessoas };
}

async function vendas() {
  const r = await fetch("https://api.github.com/repos/diegohenriquemoraes-eng/ecossistema-vno-dados/contents/base.json", {
    headers: { authorization: `Bearer ${process.env.GH_TOKEN}`, accept: "application/vnd.github.raw", "user-agent": "vno-amostra" },
  });
  if (!r.ok) return null;
  const base = await r.json();
  const desde = ini.toISOString().slice(0, 10);
  let caderno = 0, outros = 0;
  for (const p of base.pessoas || []) for (const c of p.compras || []) {
    if ((c.data || "") < desde || c.status === "reembolsada") continue;
    if (c.produto === "caderno") caderno++; else outros++;
  }
  return { caderno, outros, base_atualizada: base.atualizado_em };
}

const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : "-");

const [c, cl, v, { dados: conv }] = await Promise.all([conta(), cliques(), vendas(), ler("conversas.json", {})]);
const da = Object.values(conv).filter((x) => x.via === "amostra-actions");
const desdeTxt = ini.toISOString().slice(0, 10);
const dentro = (x) => x.t1 && x.t1 >= desdeTxt;
const enviadas = da.filter((x) => x.formato === "amostra" && dentro(x));
const jaConversa = da.filter((x) => x.formato === "ja-conversa").length;
const responderam = enviadas.filter((x) => x.respondeu).length;
const clicaram = cl ? enviadas.filter((x) => cl.codigos.has(x.codigo)).length : null;

const md = `# Placar AMOSTRA, ${br(ini)} a ${br(fim)}

| Etapa | Semana | Taxa |
|---|---|---|
| Seguidores (total) | ${c.seguidores} | |
| Seguidores novos | ${c.seguidores_novos} | |
| Alcance da conta | ${c.reach ?? "-"} | |
| Visitas ao perfil | ${c.profile_views ?? "-"} | |
| Toques no link da bio | ${c.website_clicks ?? "-"} | ${pct(c.website_clicks, c.profile_views)} das visitas (régua 05/12: 6%) |
| AMOSTRA atendidos no direct | ${enviadas.length} | |
| AMOSTRA de quem já conversava (ficou para o Diego) | ${jaConversa} (desde o início) | |
| Responderam a mensagem | ${responderam} | ${pct(responderam, enviadas.length)} |
| Abriram o link da amostra (direct) | ${clicaram ?? "-"} | ${pct(clicaram, enviadas.length)} |
| Cliques na amostra, todas as pessoas do direct | ${cl ? `${cl.total} cliques / ${cl.pessoas} códigos` : "-"} | |
| Cadernos vendidos | ${v ? v.caderno : "-"} | ${c.seguidores_novos ? (1000 * (v?.caderno || 0) / c.seguidores_novos).toFixed(2) : "-"} por 1.000 seguidores novos (régua 19/12: 1) |
| Outras vendas (Kiwify) | ${v ? v.outros : "-"} | |

Base de vendas atualizada em ${v?.base_atualizada || "-"} (webhook da Kiwify no ecossistema-vno).
Bio, story e carrossel levam a /amostra por /r/am, /r/am-bio, /r/am-car (medidos pelo coletor do site, não aqui).
`;

const caminho = `placar/${fim.toISOString().slice(0, 10)}.md`;
const api = `https://api.github.com/repos/${process.env.GH_REPO}/contents/${caminho}`;
const h = { authorization: `Bearer ${process.env.GH_TOKEN}`, accept: "application/vnd.github+json", "user-agent": "vno-amostra" };
const ant = await fetch(api, { headers: h });
const corpo = {
  message: "placar AMOSTRA", content: Buffer.from(md, "utf8").toString("base64"),
  committer: { name: "vno-amostra", email: "vno-amostra@users.noreply.github.com" },
};
if (ant.ok) corpo.sha = (await ant.json()).sha;
const w = await fetch(api, { method: "PUT", headers: h, body: JSON.stringify(corpo) });
if (process.env.MOSTRAR) console.log(md);
console.log(w.ok ? "ok" : `falhou ${w.status}`);
