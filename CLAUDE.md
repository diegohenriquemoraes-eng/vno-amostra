# vno-amostra — robô da palavra AMOSTRA do @vendanaobra

Desde 23/11/2026 (estratégia "seguidor novo → Caderno", aprovada pelo Diego). Quem comenta
exatamente **AMOSTRA** em post de até 90 dias recebe, por resposta privada, o link
`vendanaobra.com.br/a/<código>` (amostra grátis dos 5 passos, clique gravado no Blob do site) e
"Te mandei no direct!" em público. A cada 10 min no GitHub Actions (repo PÚBLICO = minutos grátis).

- O robô de abertura (`Projetos\vno-direct`) continua PAUSADO; este só atende AMOSTRA.
- Uma vez por pessoa para sempre (mesmo `conversas.json` do vno-direct); quem já conversa no
  direct não recebe (fica para o Diego no app vno-comentarios); SAIR/EXCLUIR respeitados.
- Preço nunca no direct. Quem responde é o Diego, por áudio.
- **Log do Actions é público: só contagens.** Detalhe no repo privado `vno-direct-estado`
  (`conversas.json` com `via: amostra-actions` e `codigo`, `contagem-amostra.json`, `log/`).
- Segredos do repo: `META_TOKEN` (token de sistema, cópia em `%APPDATA%\vno-direct-segredos\`),
  `GH_PAT` (`gh auth token`).
- Desligar: `gh workflow disable AMOSTRA -R diegohenriquemoraes-eng/vno-amostra`.
- Rodar à mão: `gh workflow run AMOSTRA -R diegohenriquemoraes-eng/vno-amostra`.
- `lib/meta.js` e `lib/estado.js` são cópias do vno-direct.
