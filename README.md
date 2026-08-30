# Sistema de Gestão de Avaliações e Estudos

Plataforma educacional para agendamento, acompanhamento e organização de provas e rotinas de estudo com perfis dedicados para Professores e Alunos.

---

## 🛠️ Stack Tecnológica

- **Linguagem:** [TypeScript](https://www.typescriptlang.org/)
- **Backend:** [NestJS](https://nestjs.com/) (Node.js framework)
- **Frontend:** [React](https://react.dev/) (SPA com suporte a PWA)
- **Segurança & Criptografia:** JWT, Argon2/bcrypt e HTTPS/TLS 1.3
- **Testes:** Jest / React Testing Library

---

## 📌 Funcionalidades Principais

### Autenticação e Gestão de Turmas
- Cadastro e login via e-mail/senha ou autenticação social com separação de perfis (Professor/Aluno)[cite: 1].
- Criação e adesão a turmas via código alfanumérico ou matrícula.

### Módulo do Professor
- Cadastro completo de avaliações (título, turma, data/hora, peso, conteúdo e anexos PDF/links)[cite: 1].
- Edição e cancelamento de avaliações em tempo real.
- Painel consolidado com visualizações em lista e calendário.

### Módulo do Aluno
- Feed To-Do cronológico de avaliações agrupadas por proximidade (Hoje, Esta Semana, Próximo Mês).
- Calendário integrado (mensal/semanal) com marcadores de avaliações.
- Modal com detalhes completos da prova, critérios e materiais de apoio.
- Checklist privado para criação e acompanhamento de subtarefas de estudo vinculadas a cada prova.
- Filtros por disciplina, status e busca textual.

### Notificações e Alertas
- Disparos automáticos por e-mail e Web Push em eventos de criação, alteração ou cancelamento de provas.
- Lembretes automáticos com contagem regressiva (7 dias, 48h e 24h antes da prova).
- Configuração de alertas personalizados para rotinas de estudo.

---

## 🔒 Requisitos Não Funcionais e Conformidade

- **Desempenho:** Tempo de resposta e carregamento do calendário inferior a 1,5s em 4G padrão.
- **Segurança:** Senhas protegidas com hashing forte (Argon2/bcrypt) e comunicação restrita a HTTPS.
- **Privacidade (LGPD):** Anonimização e exclusão de contas sob demanda com controle estrito de acesso.
- **Disponibilidade:** Mínimo de 99,5% de uptime com suporte a picos de fim de semestre.
- **Offline First:** Cache local (PWA) para consulta de dados sem conexão ativa.
- **Acessibilidade:** Conformidade com padrões WCAG 2.1 nível AA.
- **Compatibilidade:** Suporte aos principais navegadores modernos e sistemas móveis (Android 10+ e iOS 15.

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- Node.js (v18+)
- NPM ou Yarn
- Instância de banco de dados (ex: PostgreSQL)

### 1. Clonar o repositório
```bash
git clone https://github.com/Dvni0/meu-projeto-app-todo
