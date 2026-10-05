# Caderno Acadêmico

Aplicação web para professores organizarem turmas e avaliações e para alunos acompanharem datas, materiais e etapas de estudo. O projeto é dividido entre uma API REST NestJS e um frontend React; os dados de conta e planejamento são persistidos em PostgreSQL.

## Funcionalidades implementadas

### Conta e sessão

- Cadastro com nome, e-mail, senha e perfil de **aluno** ou **professor**.
- Login por e-mail e senha.
- Senhas armazenadas com hash bcrypt.
- Sessão por token JWT com validade de 12 horas; o frontend valida a sessão ao abrir e permite sair da conta.
- Ações e dados são limitados ao usuário autenticado e ao seu perfil.

### Turmas

- Professores podem criar turmas informando nome e disciplina.
- Cada turma recebe um código de acesso que o professor pode consultar para compartilhar com os alunos.
- Alunos podem entrar em uma turma usando esse código.
- Professores veem suas turmas e os códigos de acesso na página **Disciplinas**.

### Avaliações

- Professores podem criar avaliações para suas turmas com título, data e horário, peso, conteúdo e URLs de materiais de apoio.
- É possível editar ou cancelar avaliações existentes. O cancelamento é registrado como status, em vez de apagar a avaliação.
- Alunos consultam as avaliações das turmas às quais pertencem.
- A agenda oferece visualização em lista e calendário mensal, com data, disciplina, docente, turma, peso e contagem regressiva.
- Busca textual, filtros por período (todas, esta semana e este mês), disciplina e data.
- Links de apoio podem ser abertos a partir dos detalhes da avaliação; a API valida URLs com protocolo.

### Planejamento de estudo do aluno

- Checklists de estudo associados a avaliações, privados por aluno.
- Criar, concluir/reabrir e remover etapas de estudo.
- Indicadores de etapas concluídas e pendentes no painel.

### Notificações

- Notificações internas para alunos quando um professor cria, atualiza ou cancela uma avaliação da turma.
- O painel indica notificações não lidas; ao abrir uma notificação, ela é marcada como lida.

### Interface

- Layout responsivo para desktop e dispositivos móveis.
- Páginas de visão geral, avaliações, calendário e disciplinas.
- Acesso rápido à busca com `Ctrl+K` ou `⌘K`.
- Interface e mensagens em português.

## O que ainda não está implementado

- Login social, recuperação de senha e edição/exclusão de conta.
- Upload e armazenamento de arquivos ou PDFs; os materiais são URLs externas.
- Envio de notificações por e-mail ou Web Push, lembretes programados ou alertas configuráveis. As notificações atuais são apenas internas e geradas por eventos de avaliação.
- PWA, suporte offline e sincronização offline.
- Visualização semanal do calendário.
- Interface para consultar a lista de membros de uma turma, embora a rota correspondente da API esteja disponível.

## Tecnologias

- **Frontend:** React, TypeScript, Vite e `lucide-react`.
- **API:** NestJS, TypeScript, validação com `class-validator`/`class-transformer`.
- **Banco de dados:** PostgreSQL.
- **Autenticação:** JWT e bcrypt.
- **Testes da API:** Jest e Supertest.

## Requisitos

- Node.js 20.19+ (linha 20) ou 22.12+ (linha 22), versões compatíveis com o Vite atual.
- npm.
- PostgreSQL local ou acessível pela rede. Há uma configuração de desenvolvimento com Docker Compose em [`apps/api/docker-compose.yml`](./apps/api/docker-compose.yml).

## Como executar localmente

Instale as dependências na raiz do monorepo:

```bash
npm install
```

### 1. Configurar e iniciar a API

Em um terminal:

```bash
cd apps/api
cp .env.example .env
```

Edite `apps/api/.env` e configure um `JWT_SECRET` aleatório com pelo menos 32 bytes. Ajuste `DATABASE_URL` se o PostgreSQL não estiver usando os valores locais de desenvolvimento; `WEB_ORIGIN` deve incluir a origem do frontend. Para iniciar o banco de desenvolvimento com Docker Compose e executar a API, siga [`apps/api/README.md`](./apps/api/README.md).

Com PostgreSQL disponível:

```bash
npm run start:dev
```

A API fica em `http://localhost:3000`, usa o prefixo `/api` e cria/verifica o schema do banco ao iniciar. A rota pública de health check é `GET /api/health`.

### 2. Iniciar o frontend

Em outro terminal, na raiz do projeto:

```bash
npm --workspace apps/web run dev
```

Abra o endereço informado pelo Vite (por padrão, `http://localhost:5173`). Em desenvolvimento, o Vite encaminha `/api` para `http://localhost:3000`. Para usar outra URL de API, configure `VITE_API_URL` conforme [`apps/web/.env.example`](./apps/web/.env.example).

Na primeira visita, crie uma conta de aluno ou professor. Para testar o fluxo completo, crie uma turma com a conta de professor, copie seu código, entre nela com uma conta de aluno e cadastre avaliações.

## Rotas da API

As rotas abaixo são prefixadas por `/api`. Rotas protegidas exigem `Authorization: Bearer <token>`.

| Método | Rota | Acesso e finalidade |
| --- | --- | --- |
| `POST` | `/auth/register` | Público; cria uma conta (`name`, `email`, `password`, `role`) e inicia a sessão. |
| `POST` | `/auth/login` | Público; autentica por e-mail e senha. |
| `GET` | `/auth/me` | Autenticado; retorna o usuário da sessão. |
| `GET`, `POST` | `/classrooms` | Autenticado; lista as próprias turmas; somente professores podem criar. |
| `POST` | `/classrooms/join` | Aluno; entra em uma turma usando `{ "code": "..." }`. |
| `GET` | `/classrooms/:id/members` | Professor dono da turma; lista seus membros. |
| `GET`, `POST` | `/exams` | Autenticado; lista avaliações acessíveis; somente professores criam. |
| `GET`, `PATCH`, `DELETE` | `/exams/:id` | Membros da turma consultam; o professor dono edita ou cancela. |
| `GET`, `POST` | `/checklists` | Aluno; lista ou cria etapas privadas de estudo. |
| `PATCH`, `DELETE` | `/checklists/:id` | Aluno dono do item; atualiza ou remove uma etapa. |
| `GET` | `/notifications` | Autenticado; lista notificações do usuário. |
| `PATCH` | `/notifications/:id/read` | Dono da notificação; marca como lida. |

`GET /exams` aceita os filtros `classroomId`, `status` (`scheduled` ou `cancelled`), `from`, `to` e `search`. A busca da interface atual é aplicada aos dados carregados no frontend. Materiais usam objetos `{ "title": "...", "url": "https://..." }`.

## Verificações

```bash
# Build e lint do frontend
npm --workspace apps/web run build
npm --workspace apps/web run lint

# Testes e build da API
npm --workspace apps/api run test
npm --workspace apps/api run test:e2e
npm --workspace apps/api run build
```

## Estrutura do repositório

```text
apps/
  api/   API NestJS, módulos, testes e configuração do PostgreSQL
  web/   frontend React, telas, estilos e cliente HTTP
```
