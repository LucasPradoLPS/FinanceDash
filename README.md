# FinanceDash – Dashboard de Controle Financeiro

Aplicação web para controle de finanças pessoais: lançamentos (entradas/saídas), resumo, filtros avançados, gráfico de gastos por categoria, exportação CSV e sincronização opcional via Firebase.

## Arquitetura Atual (Multi‑páginas)

| Página | Descrição |
|--------|-----------|
| `index.html` | Tela de Login (email/senha) + registro. Gerencia sessão local e redireciona ao dashboard. |
| `dashboard.html` | Dashboard completo (lançamentos, filtros, gráfico, exportação, modal de edição). |

Scripts principais:
- `auth.js` – Gerencia sessão simples (LocalStorage: `auth_session_email`).
- `login.js` – Fluxo de login/registro usando placeholders Firebase.
- `app.js` – Regras de negócio das transações, filtros, gráfico, modal e export CSV.
- `firebase.template.js` – Template para implementar Firebase (Auth + Firestore) substituindo placeholders.

## Como executar
1. Abra `index.html` diretamente no navegador (ou sirva com um servidor estático se preferir).  
2. Crie conta ou faça login (placeholders aceitam qualquer valor e simulam retorno).  
3. Após login você é redirecionado para `dashboard.html`.  
4. Adicione lançamentos, filtre, exporte e (opcional) ative sincronização Firebase quando configurado.

## Fluxo de Autenticação
1. `login.js` chama `window.FirebaseAPI.auth.login/register` (placeholders por padrão).  
2. Se sucesso, salva o email em `localStorage` e navega para `dashboard.html`.  
3. `dashboard.html` valida a sessão; se ausente, redireciona de volta ao login.  
4. Logout remove a chave de sessão.

Para usar Firebase real substitua as funções em `firebase.template.js` (ou importe seu bundle) e garanta que `window.FirebaseAPI.auth.*` e transações (`saveTransaction`, etc.) estejam implementadas.

## Funcionalidades
| Área | Descrição |
|------|-----------|
| Lançamentos | CRUD (adicionar, editar via modal, excluir). |
| Cálculos | Totais de entradas, saídas e saldo automático. |
| Filtros | Intervalo de datas, mês específico (input month), categoria dinâmica. |
| Gráfico | Pizza agrupando top 6 categorias + “Outros” (apenas despesas). |
| Exportação | CSV com base no conjunto filtrado. |
| Sincronização | Placeholder para Firestore (merge por ID). |
| Segurança básica | Redirecionamento se sessão ausente no dashboard. |
| Navegação | Sidebar responsiva com âncoras, destaque de seção e scroll suave. |

## Modal de Edição
Substitui prompts simples. Abre com dados do lançamento, permite alterar e salvar. Implementado diretamente em `app.js`.

## Estrutura de Arquivos
```
index.html          # Login
dashboard.html      # Dashboard pós-autenticação
styles.css          # Estilos globais + tema + layout de login
app.js              # Lógica principal (transações/filtros/gráfico/modal)
login.js            # Fluxo de login/registro
auth.js             # Sessão local
firebase.template.js# Template Firebase (Auth + Firestore)
navigation.js       # Lógica da sidebar (scroll suave + highlight + toggle mobile)
README.md           # Documentação
```

## Filtros

- Intervalo de data (date from/to)
- Mês (input type=month)
- Categoria (auto-populada)

## Exportar CSV
- Botão “Exportar CSV” gera arquivo com dados filtrados.

## Sincronização com Firebase
- Checkbox “Enviar para Firebase” tenta carregar/mesclar dados e enviar novos lançamentos.
- Requer implementar funções reais no template.

## Próximos Passos (Sugestões)
- Tema claro/escuro com toggle.
- Cores determinísticas por categoria no gráfico.
- Paginação ou busca textual de lançamentos.
- Recuperação de senha real via Firebase Auth.
- Acessibilidade extra: foco navegável na sidebar e trap no modal.
- Indicação de progresso em carregamento (skeleton / spinner) se integrar backend.

## Notas de Segurança
- Não exponha chaves Firebase em repositórios públicos.
- Considere usar bundler e variáveis de ambiente para produção.

## QA / Smoke Tests
1. Login/Registro → Redireciona para dashboard.  
2. Adicionar lançamento → Aparece na lista, totais atualizam.  
3. Editar (modal) → Valores atualizam.  
4. Excluir → Removido e totais corrigidos.  
5. Filtros (data/mês/categoria) → List/Resumo/Gráfico refletem escopo.  
6. Exportar CSV → Gera arquivo coerente com filtro.  
7. (Opcional) Ativar sincronização → Sem erros no console.  

## Checklist de Entrega
- [x] Multi-páginas (login + dashboard)
- [x] Lançamentos persistidos (LocalStorage)
- [x] Saldo e totais corretos
- [x] Gráfico de pizza (top categorias + Outros)
- [x] Filtros funcionais
- [x] Modal de edição
- [x] Export CSV
- [x] Template Firebase
- [x] Estilo profissional de login
- [x] Sidebar de navegação responsiva

## Licença
MIT

Filtros

- Filtre por intervalo de datas (data inicial e final).
- Filtre por mês (input tipo month) para selecionar rapidamente um mês e aplicar o filtro.
- Filtre por categoria usando o select — as categorias são populadas automaticamente com base nas transações salvas.

Exportar CSV

- Clique em "Exportar CSV" para baixar um relatório CSV com as transações atualmente filtradas.

Sincronização com Firebase

- Marque o checkbox "Enviar para Firebase" para tentar carregar e mesclar transações do Firestore e enviar novas transações ao salvar. Configure `window.FirebaseAPI` com as funções reais do template para ativar.

QA / Smoke tests

Siga estes passos rápidos após abrir `index.html` para verificar o funcionamento básico:

1. Adicionar lançamentos
	- Preencha descrição, valor, tipo e categoria. Clique em "Adicionar".
	- Verifique se o lançamento aparece na lista, se o total e saldo são atualizados e se o gráfico reflete as despesas.

2. Editar e excluir
	- Clique em "Editar" num lançamento e altere valores (usamos prompts simples). Verifique atualização imediata.
	- Clique em "Excluir" e confirme que o lançamento é removido e o saldo/ gráfico atualizam.

3. Filtros
	- Use filtro por data (From/To) e por mês para limitar os dados mostrados. Verifique se totais e gráfico respeitam os filtros.
	- Selecione uma categoria no select para filtrar por categoria.

4. Exportar CSV
	- Aplique alguns filtros e clique em "Exportar CSV". Abra o arquivo gerado para confirmar que contém apenas os lançamentos filtrados.

5. Autenticação e sincronização (opcional)
	- Configure `firebase.template.js` com suas credenciais e implemente as funções exportadas (veja comentários no arquivo).
	- Substitua as placeholders em `window.FirebaseAPI` pelas funções reais (ou importe o arquivo JS compilado).
	- Faça login com email/senha, ative a sincronização e verifique se os dados são carregados/mesclados.

Notas de segurança

- Não comite suas chaves do Firebase em repositórios públicos. Use variáveis de ambiente ou arquivos locais ignorados pelo Git para armazenar credenciais.

Checklist de entrega

- [ ] Lançamentos adicionados e persistidos em LocalStorage
- [ ] Saldo e totais corretos
- [ ] Gráfico de pizza com top categorias + "Outros"
- [ ] Filtragem por data/mês/categoria funcionando
- [ ] Edição e exclusão funcionando
- [ ] Export CSV funcionando
- [ ] Integração com Firebase (opcional) configurada e testada

---
> Observação: Este projeto é um protótipo estático. Para produção considere pipeline de build, minificação, testes automatizados e hospedagem segura (HTTPS).
