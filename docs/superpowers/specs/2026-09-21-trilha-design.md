# trilha — plataforma de trilhas de aprendizado (Mentingo)

Data: 2026-09-21. Status: aprovado pelo Vitor (brainstorm), aguardando revisão
da spec escrita.

## Objetivo

Plataforma interna da FlyingStudio para trilhas de aprendizado por setor
(externa, interna, produção, pós-produção, comercial, diretoria, operacional,
TI), com certificado ao concluir. Base: **Mentingo v4.20.1** (MIT,
Selleo/mentingo), LMS open source com trilhas, grupos, certificados e marca
branca. Não escrevemos um LMS; empacotamos, traduzimos e operamos o Mentingo
seguindo as regras da VPS (`CLAUDE.md` global e
`POSTIZ_MARKETING/docs/05-nova-aplicacao.md`).

Mapeamento de domínio:

| Conceito FlyingStudio | Mentingo |
|---|---|
| Setor | Grupo (`group`), com gestor de grupo (`group_manager`) |
| Trilha do setor | Learning path com cursos em ordem (`sequenceEnabled`), matriculada ao grupo |
| Certificado | Certificado da trilha e/ou do curso, com validade e recertificação |
| Colaborador | Usuário `student`, entra por convite |

URL de produção: `https://trilha.flyingstudio.com.br`. Nome da aplicação em
todos os lugares: **`trilha`**.

## Decisões tomadas

| Decisão | Escolha | Motivo |
|---|---|---|
| Português na interface | Overlay pt-BR aplicado no build, sem fork; PR upstream depois | Regra global "sem fork"; Mentingo aceita traduções por PR |
| Onde construir imagens | GitHub Actions → GHCR, repositório público `trilha-build` | Não há imagem pública; build pesado (10–25 min) não deve rodar na VPS |
| Storage S3 | MinIO na própria stack | Autocontido, entra no backup, sem custo externo |
| E-mail | Resend, SMTP 465, remetente `trilha@impulseon.com.br` | Domínio já verificado; mesmo provedor do Postiz e do comercial |
| Login | Convite por e-mail + senha, cadastro aberto desligado | Funciona para qualquer e-mail; SSO Google fica para depois, pelo painel |
| Validação | Local na máquina do Vitor primeiro, VPS depois | Pedido explícito |

## Arquitetura

### Dois repositórios com papéis separados

**`trilha-build`** (esta pasta `MENTINGO_TRILHAS`, GitHub público). Só o que
gera imagem. Sem segredos.

```
trilha-build/
  patches/                         # overlay pt-BR (ver seção Tradução)
    packages/shared/src/constants/languages.ts
    apps/web/app/locales/pt/translation.json
    apps/api/src/...               # mapas de e-mail/certificado
  build/
    api.Dockerfile                 # clona upstream na tag, aplica overlay, constrói
    web.Dockerfile                 # idem; recebe VITE_API_URL/VITE_APP_URL por build-arg
  scripts/
    translate.mjs                  # gera pt a partir de en (assistido), reporta chaves faltantes
    check-overlay.sh               # confere que cada arquivo do overlay ainda existe no upstream
  .github/workflows/build.yml      # publica ghcr.io/<user>/trilha-api e trilha-web
  MENTINGO_VERSION                 # ex.: v4.20.1
  docs/superpowers/specs/          # esta spec
  README.md
```

**`POSTIZ_MARKETING/trilha/`** (repositório de infraestrutura, espelho de
`/opt/apps/trilha`).

```
trilha/
  docker-compose.yml
  docker-compose.local.yml         # só para validar na máquina local
  .env.example
  scripts/backup.sh
  scripts/restore.sh
  README.md
proxy/sites/trilha.caddy
docs/05-nova-aplicacao.md          # ganha uma linha na tabela
```

### Imagens

Tag das imagens: `<versão upstream>-pt.<n>`, ex.: `4.20.1-pt.1`. `n` sobe
quando o overlay ou o Dockerfile mudam sem mudar o upstream. O compose fixa a
tag; `latest` não é usado.

- `trilha-api`: parte de `api.Dockerfile` do upstream (node 20 alpine com
  chromium, libreoffice, ffmpeg). Estágio extra antes do build: `git clone
  --depth 1 --branch $MENTINGO_VERSION`, `cp -r patches/. .`, `pnpm
  generate:client` se o script existir no upstream, senão falha o build.
- `trilha-web`: parte de `web.Dockerfile` do upstream (nginx 1.27 servindo
  SPA na 8080). A URL pública entra por `--build-arg`. O workflow gera duas
  variantes: `-prod` (`https://trilha.flyingstudio.com.br`) e `-local`
  (`https://trilha.localhost`).

O workflow roda em `push` de tag `v*` e manualmente (`workflow_dispatch`).
Faz login no GHCR com `GITHUB_TOKEN`. Depois do primeiro build o Vitor torna
os pacotes públicos (uma vez).

### Stack na VPS

Projeto Compose `name: trilha`. Rede `internal` para tudo; rede externa
`proxy` só em `trilha` (API) e `trilha-web`. Sem `ports:`. Todo serviço tem
`logging` com rotação (10m × 3), `restart: always`, limite de memória e
healthcheck.

| Serviço | Container | Imagem | Memória inicial | Healthcheck |
|---|---|---|---|---|
| `api` | `trilha` | `ghcr.io/<user>/trilha-api:4.20.1-pt.1` | 1536m | `GET http://127.0.0.1:3000/api/healthcheck` |
| `web` | `trilha-web` | `ghcr.io/<user>/trilha-web:4.20.1-pt.1-prod` | 64m | `GET http://127.0.0.1:8080/` |
| `db` | `trilha-db` | `pgvector/pgvector:pg16` (digest fixado) | 512m | `pg_isready` |
| `redis` | `trilha-redis` | `redis:8.x-alpine` (tag fixa) | 128m | `redis-cli ping` |
| `minio` | `trilha-minio` | `minio/minio:RELEASE.<data>` | 256m | `mc ready local` ou `curl /minio/health/live` |
| `migrate` | one-shot, `profiles: [ops]` | mesma da API, `command: migrate` | — | — |
| `seed` | one-shot, `profiles: [ops]` | mesma da API, `command: seed-prod` | — | — |

Limites são chute inicial conservador; medir com `docker stats` após uma
semana e registrar no README. A API roda os workers BullMQ no mesmo processo
(upstream não separa).

`migrate` e `seed` nunca sobem com `up -d`: exigem `docker compose run --rm
migrate`. O seed do upstream **trunca todas as tabelas** e cria contas demo
com senha `password` e troca obrigatória no primeiro login. O README manda
rodar o seed exatamente uma vez e apagar as contas demo que não forem usadas.

Variáveis obrigatórias (guarda `${VAR:?...}` no compose): `DATABASE_URL`,
`REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRATION_TIME`,
`MASTER_KEY` (32 bytes base64), `CORS_ORIGIN` (= URL pública; também vira o
host do tenant no seed), `EMAIL_ADAPTER=smtp`, `SMTP_HOST=smtp.resend.com`,
`SMTP_PORT=465`, `SMTP_USER=resend`, `SMTP_PASSWORD` (chave Resend),
`SMTP_EMAIL_FROM`, `S3_*` apontando para `http://trilha-minio:9000`,
`NODE_ENV=production`. Desligados: OpenAI, Bunny, Stripe, LiveKit, Langfuse,
Sentry, PostHog. Segredos ficam em `.env` (600, só na VPS); o repositório
versiona `.env.example`.

Proxy (`proxy/sites/trilha.caddy`):

```caddyfile
trilha.flyingstudio.com.br {
	encode zstd gzip
	handle /api/* {
		reverse_proxy trilha:3000
	}
	handle {
		reverse_proxy trilha-web:8080
	}
}
```

WebSocket do Mentingo vive em `/api/ws`, já coberto. Não reescrever `/api`.

**Storage precisa de hostname público.** O Mentingo entrega arquivos ao
navegador por URL pré-assinada apontando direto para o endpoint S3, e a
assinatura cobre host e caminho. Logo o MinIO recebe um segundo registro DNS,
`trilha-storage.flyingstudio.com.br` (nuvem cinza), roteado pelo mesmo
`trilha.caddy` para `trilha-minio:9000`. `S3_ENDPOINT` na API é essa URL
pública (a API a resolve pelo DNS e passa pelo Caddy). Console do MinIO
(porta 9001) não é publicado. Exceção deliberada à regra "um nome, um
subdomínio": é o mesmo app, mesma pasta, mesmo arquivo de proxy.

Localmente o mesmo desenho roda em HTTP puro (`http://trilha.localhost` e
`http://trilha-storage.localhost`) com `NODE_ENV=development`, porque o
cookie de sessão é `secure` em produção e o navegador o rejeitaria sem TLS.
A API resolve esses nomes por alias de rede do serviço `caddy` local no
Compose.

### Validação local

`docker-compose.local.yml` sobrepõe: imagens `-local` (ou build local pelos
mesmos Dockerfiles), um serviço `caddy` na rede `internal` publicando
`127.0.0.1:80` em HTTP puro para `trilha.localhost` e
`trilha-storage.localhost`, `CORS_ORIGIN=http://trilha.localhost`,
`NODE_ENV=development`. Chrome resolve `*.localhost` sozinho. O `.env`
local tem segredos gerados descartáveis.

Roteiro de aceite local (também é o roteiro de aceite na VPS):

1. `docker compose up -d` sem erro; todos `healthy`.
2. `run --rm migrate`, depois `run --rm seed` uma vez.
3. Login como admin, troca de senha forçada funciona.
4. Interface em pt-BR selecionável; menus, painel de admin, tela de curso e
   e-mail de convite em português.
5. Painel: ligar `learningPathsEnabled`, subir logo, definir cor primária.
6. Criar grupo "Comercial", convidar um usuário por e-mail (o e-mail chega
   via Resend na VPS; localmente basta ver o log da API).
7. Criar dois cursos curtos com uma lição e um quiz cada, criar a trilha
   "Comercial" com os dois em ordem, matricular o grupo.
8. Como aluno: ver a trilha, concluir os cursos, baixar o certificado em PDF
   (prova de que o Chromium funciona no container).
9. `docker stats`: ninguém perto do limite. Registrar os números.

### Deploy na VPS

Segue `docs/05-nova-aplicacao.md`: registro A `trilha` → `189.126.105.219`
nuvem cinza; `scp -r trilha proxy docs kinghost:/opt/apps/`; `.env` com
`chmod 600`; `docker compose config --services`; `up -d`; `run --rm migrate`;
`run --rm seed` uma vez; reload do Caddy. Provas antes de declarar pronto:

- `curl -s -o /dev/null -w "%{http_code}" https://trilha.flyingstudio.com.br/api/healthcheck` → `200`.
- `curl -m 5 http://189.126.105.219:3000` e `:9000` falham.
- Login real pelo navegador, e-mail de convite recebido, PDF baixado.
- `docker stats` sem serviço perto do limite; `OOMKilled=false`.
- `backup.sh` rodou e `restore.sh` restaurou num teste.

### Backup

`scripts/backup.sh` (cron 03:00): `pg_dump` do banco, tar do volume do
MinIO, tar do volume de uploads da API, e uma cópia do `.env` (contém
`MASTER_KEY`; sem ela os segredos gravados no painel e os hashes de token
ficam ilegíveis). Retenção: 7 diários, 4 semanais. `restore.sh <TS>` recria
os três. Restauração testada uma vez antes de considerar pronto.

## Tradução pt-BR (overlay)

Arquivos do overlay, todos existentes no upstream em v4.20.1:

1. `packages/shared/src/constants/languages.ts`: adiciona `PT: "pt"`.
2. `apps/web/app/locales/pt/translation.json`: gerado por
   `scripts/translate.mjs` a partir de `en/translation.json`, chave por
   chave, preservando placeholders `{{x}}` e HTML. Revisão manual por
   amostragem das telas do roteiro de aceite. O script também lista chaves
   que existem em `en` e faltam em `pt` (para futuras versões).
3. Registro do idioma no i18n do web (arquivo de init do i18next e mapa de
   rótulos/bandeiras do seletor); localizar exatamente durante a
   implementação com `rg "pl/translation"`.
4. Mapas de tradução da API: `apps/api/src/common/emails/translations.ts`,
   `apps/api/src/course-chat/course-chat-email.translations.ts`,
   `apps/api/src/localization/` (o que tiver chave por idioma).
5. Se o idioma for enum no Postgres, uma migração Drizzle adicionando `pt`
   (verificar em `apps/api/src/storage/schema`).

`scripts/check-overlay.sh` confere, contra o clone na tag, que cada arquivo
do overlay que substitui um existente ainda existe e que a enum ainda tem o
formato esperado; roda no início do workflow. Ao subir de versão do
upstream, esse script e o build são o detector de quebra.

Depois de validado, abrir PR em Selleo/mentingo com a tradução; se aceita, o
overlay encolhe para zero.

## Fora do escopo

- Conteúdo das trilhas de cada setor (feito por vocês no painel).
- SSO Google/Microsoft (liga-se pelo painel quando quiser).
- IA Mentor, geração de curso, voz (exigem OpenAI/LiveKit).
- Papel Postgres separado com RLS (`LMS_DATABASE_URL` ≠
  `MIGRATOR_DATABASE_URL`): fica documentado no README como melhoria;
  o upstream aceita uma URL só.
- Bunny Stream para vídeo: vídeos vão pelo MinIO.

## Riscos

- **Tradução automática de um JSON grande**: risco de termos estranhos.
  Mitigação: glossário fixo no script (curso, trilha, lição, capítulo,
  certificado, grupo, gestor) e revisão das telas principais.
- **Upstream muda estrutura do i18n** em versão futura: `check-overlay.sh`
  e o build quebram cedo; nunca em produção.
- **Memória da API** com Chromium + LibreOffice: começa em 1536m; a VPS tem
  ~4 GB livres. Medir e ajustar.
- **Seed destrutivo**: só via `profiles: [ops]` e `run --rm`, documentado em
  negrito no README.
- **URL gravada no build do web**: trocar domínio exige nova imagem.
  Aceito; o domínio é fixo.
