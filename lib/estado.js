// O estado mora no repo PRIVADO vno-direct-estado, pela API do GitHub (grátis).
// O Blob da Vercel no plano Hobby não aguenta leitura a cada 20 s.
// Cada gravação vai com o sha lido: se a rotina do Chrome (dm.py) gravou no meio,
// o GitHub recusa (409) e a mudança é refeita em cima do arquivo novo.

const REPO = process.env.GH_REPO || "diegohenriquemoraes-eng/vno-direct-estado";
const API = `https://api.github.com/repos/${REPO}/contents/`;

function cabecalho() {
  return {
    authorization: `Bearer ${process.env.GH_TOKEN}`,
    accept: "application/vnd.github+json",
    "cache-control": "no-cache",
    "user-agent": "vno-amostra",
  };
}

export async function ler(caminho, padrao) {
  const r = await fetch(API + caminho + `?t=${Date.now()}`, { headers: cabecalho() });
  if (r.status === 404) return { dados: padrao, sha: null };
  if (!r.ok) throw new Error(`GitHub ${caminho}: ${r.status}`);
  const j = await r.json();
  return { dados: JSON.parse(Buffer.from(j.content, "base64").toString("utf8")), sha: j.sha };
}

async function gravar(caminho, dados, sha, mensagem) {
  const corpo = {
    message: mensagem,
    content: Buffer.from(JSON.stringify(dados, null, 1), "utf8").toString("base64"),
    committer: { name: "vno-amostra", email: "vno-amostra@users.noreply.github.com" },
  };
  if (sha) corpo.sha = sha;
  const r = await fetch(API + caminho, { method: "PUT", headers: cabecalho(), body: JSON.stringify(corpo) });
  if (r.status === 409 || r.status === 422) return null;
  if (!r.ok) throw new Error(`GitHub gravar ${caminho}: ${r.status} ${await r.text()}`);
  return (await r.json()).content.sha;
}

// mudar(caminho, padrao, fn, msg): fn recebe os dados e muda no lugar; devolve false para não gravar.
export async function mudar(caminho, padrao, fn, mensagem) {
  for (let i = 0; i < 5; i++) {
    const { dados, sha } = await ler(caminho, padrao);
    const res = await fn(dados);
    if (res === false) return dados;
    if (await gravar(caminho, dados, sha, mensagem)) return dados;
    await new Promise((ok) => setTimeout(ok, 400 + Math.random() * 600));
  }
  throw new Error(`conflito ao gravar ${caminho}`);
}

// Diário em log/AAAA-MM-DD.md: é por ele que o Diego (e o relatório do dia seguinte) sabe o que saiu.
export async function anotar(linhas) {
  if (!linhas.length) return;
  const dia = agora().slice(0, 10);
  const caminho = `log/${dia}.md`;
  for (let i = 0; i < 5; i++) {
    const r = await fetch(API + caminho + `?t=${Date.now()}`, { headers: cabecalho() });
    let texto = "", sha = null;
    if (r.ok) {
      const j = await r.json();
      texto = Buffer.from(j.content, "base64").toString("utf8");
      sha = j.sha;
    }
    texto += linhas.map((l) => `- ${agora().slice(11)} ${l}\n`).join("");
    const corpo = {
      message: "log", content: Buffer.from(texto, "utf8").toString("base64"),
      committer: { name: "vno-amostra", email: "vno-amostra@users.noreply.github.com" },
    };
    if (sha) corpo.sha = sha;
    const w = await fetch(API + caminho, { method: "PUT", headers: cabecalho(), body: JSON.stringify(corpo) });
    if (w.ok) return;
  }
}

// Hora de Brasília no formato do dm.py: "2026-10-15 14:03"
export function agora() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

// "2026-10-15 14:03" (Brasília) → Date
export function quando(s) {
  return s ? new Date(s.replace(" ", "T") + ":00-03:00") : null;
}
