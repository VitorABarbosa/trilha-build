# trilha-build

Constrói as imagens da plataforma **trilha** (trilha.flyingstudio.com.br):
o LMS open source [Mentingo](https://github.com/Selleo/mentingo) numa tag
fixa, com interface em pt-BR aplicada como overlay no build. Sem fork.

- Versão do upstream: `MENTINGO_VERSION`
- Overlay: `patches/*.patch` (git apply, em ordem) + `overlay/` (arquivos novos)
  - `0001-pt-br`: idioma pt (enum, web, API, e-mails, certificado)
  - `0002-fix-password-change-redirect-loop`: laço na troca de senha obrigatória (bug upstream)
  - `0003-pdf-preview-sharper-canvas`: PDF embutido renderizado em 2x (ficava borrado)
  - `0004-pdf-next-lesson-button`: botão "Próxima lição" na última página do PDF (também em tela cheia), via `overlay/apps/web/app/lib/lessonNavigationBridge.ts`
- Imagens: `ghcr.io/vitorabarbosa/trilha-api`, `ghcr.io/vitorabarbosa/trilha-web`
- Operação (Compose, backup, VPS): repositório de infraestrutura, pasta `trilha/`
- Design: `docs/superpowers/specs/2026-09-21-trilha-design.md`
- Plano: `docs/superpowers/plans/2026-09-21-trilha.md`

## Comandos

| Comando | O que faz |
|---|---|
| `bash scripts/upstream.sh` | clona o upstream na tag em `upstream/` |
| `node scripts/i18n/split.mjs` | quebra `en/translation.json` em `work/i18n/en/` |
| `node scripts/i18n/merge.mjs` | valida `work/i18n/pt/` e gera o `pt/translation.json` do overlay |
| `node --test scripts/i18n/util.test.mjs` | testes dos utilitários de tradução |
| `bash scripts/apply-overlay.sh upstream` | aplica patch + overlay em `upstream/` e confere |
| `git tag v4.20.1-pt.1 && git push --tags` | dispara o build no GitHub Actions |

`work/i18n/pt/` (pedaços traduzidos, fonte editável) é versionado;
`work/i18n/en/` e `upstream/` são gerados e ficam fora do git.

## Atualizar o Mentingo

1. Mudar `MENTINGO_VERSION`; `bash scripts/upstream.sh --force`.
2. `bash scripts/apply-overlay.sh upstream`. Se o patch não aplicar, refazer o
   overlay sobre a nova tag (ver "Regenerar o patch").
3. `node scripts/i18n/split.mjs` e traduzir só os pedaços com chaves novas;
   `node scripts/i18n/merge.mjs` lista o que falta.
4. Tag nova `v<upstream>-pt.1`, push, esperar o workflow.
5. No repositório de infra, trocar a tag no Compose; backup; `up -d`; `run --rm migrate`.

## Regenerar o patch

```bash
bash scripts/upstream.sh --force
cd upstream && git apply ../patches/0001-pt-br.patch   # ou editar à mão
# ...editar...
git add -A && git diff --cached > ../patches/0001-pt-br.patch
```
