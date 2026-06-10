/**
 * Seed script — popula banco com dados fictícios para testar todas as features.
 * Run: bun seed.ts
 */

import { createClient } from "@libsql/client";

const db = createClient({
  url: "libsql://2ab4831c-a2e6-44b0-888b-d9533b1bdee7-runable.aws-us-east-2.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3ODA3ODE0MjQsInAiOnsicnciOnsibnMiOlsiMDE5ZTllZDgtMWUwMS03ZThlLTk0YjEtYjYyNjY4OGQ2MjJmIl19fSwicmlkIjoiYjI3OWE0NDUtNjQxOS00YmYzLTgxOTEtODhkZDUxMDUwZTQyIn0.qNyT0zXujCQjY3KNGrJr-MPiwI34KRY4f7PonROuBZ-cOtSN1BEPO-VkqJ8bCNgxXGkknqOO4Zc003O_lFAcCg",
});

const HOJE = new Date();
HOJE.setHours(0, 0, 0, 0);
const ts = (d: Date) => Math.floor(d.getTime() / 1000);

function diasAtras(n: number) {
  const d = new Date(HOJE);
  d.setDate(d.getDate() - n);
  return d;
}
function diasFrente(n: number) {
  const d = new Date(HOJE);
  d.setDate(d.getDate() + n);
  return d;
}

// Dia da semana de hoje em PT-BR
const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const diaHoje = DIAS_SEMANA[HOJE.getDay()];
// Semana: usa o próximo dia de semana que não seja domingo nem sábado como "dia de aula"
function diaUtil(offset = 0) {
  const dias = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  // Para garantir que aulas de hoje apareçam no dashboard, retorna diaHoje quando offset=0
  if (offset === 0) return diaHoje === "Domingo" ? "Segunda" : diaHoje;
  return dias[offset % dias.length];
}

const ASSUNTOS_DATA = [
  {
    nome: "Fundamentos de Atendimento ao Cliente",
    disciplina: "Atendimento",
    totalQuestoes: 28,
    percentual: 18.5,
    percentualAcumulado: 18.5,
    prioridade: "alta",
    pesoEdital: 5,
    conteudoMd: `## Fundamentos de Atendimento ao Cliente

### O que é Atendimento ao Cliente?
Atendimento ao cliente é o conjunto de práticas e ações que uma organização realiza para satisfazer as necessidades e expectativas dos seus clientes, antes, durante e após uma compra ou prestação de serviço.

### Princípios Fundamentais

**1. Foco no Cliente**
O cliente é o centro de todas as decisões. Suas necessidades devem ser compreendidas e atendidas com excelência.

**2. Empatia**
Capacidade de se colocar no lugar do cliente, compreendendo seus sentimentos e necessidades.

**3. Proatividade**
Antecipar problemas e necessidades antes que o cliente precise solicitá-los.

**4. Resolubilidade**
Capacidade de resolver problemas de forma eficaz e no menor tempo possível.

### Tipos de Atendimento Bancário

| Tipo | Características | Canal |
|------|----------------|-------|
| Presencial | Contato direto, humanizado | Agência |
| Telefônico | Rápido, distância | Call Center |
| Digital | 24h, autoatendimento | App/Internet |
| Escrito | Formal, registrado | E-mail/Chat |

### Qualidade no Atendimento

A qualidade é mensurada por:
- **Tempo de espera**: quanto o cliente aguarda
- **Resolução no primeiro contato (FCR)**: problema resolvido sem retornar
- **Satisfação do cliente (CSAT)**: pesquisa pós-atendimento
- **Net Promoter Score (NPS)**: probabilidade de indicação

### SAC — Serviço de Atendimento ao Consumidor

> Decreto 6.523/2008: empresas de setores regulados devem disponibilizar SAC gratuito 24h por dia, 7 dias por semana.

**Principais obrigações do SAC:**
- Atendimento humano em no máximo 60 segundos
- Proibido exigir reapresentação de dados já informados
- Reclamações devem ser respondidas em até 5 dias úteis

### Boas Práticas no Banco do Brasil

▸ Cumprimentar o cliente pelo nome  
▸ Manter postura profissional e vestuário adequado  
▸ Ouvir sem interromper  
▸ Confirmar entendimento antes de agir  
▸ Despedir-se com cordialidade  

### Questões-chave para a prova

**Q1:** O conceito de "momento da verdade" em atendimento refere-se a qualquer episódio em que o cliente entra em contato com algum aspecto da empresa e forma uma opinião sobre a qualidade do serviço. **(CERTO)**

**Q2:** O omnichannel implica integração dos canais de atendimento, garantindo experiência consistente independentemente do canal utilizado. **(CERTO)**`,
  },
  {
    nome: "Vendas e Negociação — Técnicas Fundamentais",
    disciplina: "Vendas e Negociação",
    totalQuestoes: 22,
    percentual: 14.5,
    percentualAcumulado: 33.0,
    prioridade: "alta",
    pesoEdital: 4,
    conteudoMd: `## Vendas e Negociação — Técnicas Fundamentais

### O Processo de Vendas

O processo de vendas bancárias segue etapas estruturadas:

**1. Prospecção** → Identificação de potenciais clientes  
**2. Abordagem** → Primeiro contato e rapport  
**3. Levantamento de Necessidades** → Perguntas abertas e escuta ativa  
**4. Apresentação** → Proposta de valor alinhada à necessidade  
**5. Manejo de Objeções** → Tratamento das resistências  
**6. Fechamento** → Conclusão da venda  
**7. Pós-venda** → Fidelização e relacionamento  

### Técnicas de Negociação

#### BATNA (Best Alternative to a Negotiated Agreement)
Melhor alternativa caso a negociação não chegue a um acordo. Quem tem melhor BATNA tem mais poder de negociação.

#### Negociação Ganha-Ganha (Win-Win)
Busca resultado satisfatório para ambas as partes. Foco em interesses, não em posições.

#### Ancoragem
Primeira oferta lançada serve como referência psicológica para toda a negociação.

### Comunicação em Vendas

> "As pessoas compram de quem elas confiam e gostam."

**Escuta Ativa:**
- Manter contato visual
- Confirmar com perguntas de clarificação
- Parafrasear o que o cliente disse
- Não interromper

**Perguntas Abertas vs. Fechadas:**
| Tipo | Exemplo | Uso |
|------|---------|-----|
| Aberta | "Como o senhor usa sua conta hoje?" | Levantar necessidades |
| Fechada | "O senhor tem conta poupança?" | Confirmar informações |

### Objeções Comuns no Banco

| Objeção | Resposta Sugerida |
|---------|------------------|
| "Está muito caro" | "Vamos ver o custo-benefício juntos?" |
| "Não preciso disso" | "O que seria mais útil para o senhor?" |
| "Vou pensar" | "Que informação adicional posso fornecer?" |

### Produtos Bancários para o Agente Comercial

▸ **Conta Corrente** — produto básico de relacionamento  
▸ **Cartão de Crédito/Débito** — rentabilidade e conveniência  
▸ **Crédito Pessoal** — necessidades pontuais  
▸ **Poupança** — reserva financeira  
▸ **Seguro de Vida** — proteção e margem  
▸ **Previdência Privada** — planejamento de longo prazo  

### Indicadores de Desempenho em Vendas

- **Taxa de conversão**: % de abordagens que resultam em venda
- **Ticket médio**: valor médio por venda
- **Cross-selling**: venda de produtos complementares
- **Up-selling**: venda de versão superior do produto`,
  },
  {
    nome: "Matemática Financeira — Juros e Taxas",
    disciplina: "Matemática Financeira",
    totalQuestoes: 18,
    percentual: 11.9,
    percentualAcumulado: 44.9,
    prioridade: "alta",
    pesoEdital: 4,
    conteudoMd: `## Matemática Financeira — Juros e Taxas

### Conceitos Básicos

**Capital (C):** valor inicial aplicado ou emprestado  
**Taxa de juros (i):** percentual sobre o capital por período  
**Tempo (n):** número de períodos  
**Montante (M):** capital + juros  

### Juros Simples

\`M = C × (1 + i × n)\`

**Exemplo:** R$ 1.000 a 2% a.m. por 6 meses  
M = 1.000 × (1 + 0,02 × 6) = 1.000 × 1,12 = **R$ 1.120**

### Juros Compostos

\`M = C × (1 + i)^n\`

**Exemplo:** R$ 1.000 a 2% a.m. por 6 meses  
M = 1.000 × (1,02)^6 = 1.000 × 1,1262 = **R$ 1.126,20**

> **Regra de ouro:** Em juros simples, os juros incidem sempre sobre o capital inicial. Em juros compostos, incidem sobre o montante acumulado (juros sobre juros).

### Equivalência de Taxas

Para taxas compostas:
\`(1 + i_anual) = (1 + i_mensal)^12\`

**Taxa mensal equivalente à anual de 12%:**  
(1 + 0,12)^(1/12) - 1 = 0,9489% a.m.

### Desconto

**Desconto Comercial (Bancário):**  
\`D = N × d × n\`  
\`A = N × (1 - d × n)\`

**Desconto Racional (Por Dentro):**  
\`A = N / (1 + i × n)\`

Onde: N = Valor Nominal, d = taxa de desconto, A = Valor Atual

### Tabela Price (SAC e PRICE)

| Sistema | Prestação | Amortização | Saldo |
|---------|-----------|-------------|-------|
| PRICE | Constante | Crescente | Decrescente |
| SAC | Decrescente | Constante | Decrescente |

> No **SAC**, a amortização é sempre igual. No **PRICE**, a prestação é sempre igual.

### Regra de 72

Para estimar em quantos períodos um capital dobra com juros compostos:  
**n ≈ 72 / taxa%**

Exemplo: taxa de 6% a.a. → dobra em ≈ 12 anos

### Taxa Real vs. Taxa Nominal

**Equação de Fisher:**  
\`(1 + r) = (1 + i) / (1 + π)\`

Onde: r = taxa real, i = taxa nominal, π = inflação

### Itens Mais Cobrados em Prova

▸ Cálculo de montante (juros simples e compostos)  
▸ Equivalência de taxas  
▸ Desconto comercial vs. racional  
▸ Diferença SAC × PRICE  
▸ Cálculo de taxa real`,
  },
  {
    nome: "Conhecimentos Bancários — Sistema Financeiro Nacional",
    disciplina: "Conhecimentos Bancários",
    totalQuestoes: 20,
    percentual: 13.2,
    percentualAcumulado: 58.1,
    prioridade: "alta",
    pesoEdital: 4,
    conteudoMd: `## Sistema Financeiro Nacional (SFN)

### Estrutura do SFN

O SFN é composto por **órgãos normativos**, **supervisores** e **operadores**.

#### Órgãos Normativos
- **CMN** — Conselho Monetário Nacional (maior autoridade)
- **CNPC** — Conselho Nacional de Previdência Complementar
- **CNSP** — Conselho Nacional de Seguros Privados

#### Supervisores
- **BACEN** — Banco Central do Brasil
- **CVM** — Comissão de Valores Mobiliários
- **PREVIC** — Superintendência de Previdência Complementar
- **SUSEP** — Superintendência de Seguros Privados

#### Operadores
Instituições financeiras que interagem diretamente com o público: bancos, corretoras, seguradoras, etc.

### Banco Central do Brasil (BACEN)

**Missão:** Assegurar a estabilidade do poder de compra da moeda e um sistema financeiro sólido e eficiente.

**Funções principais:**
▸ Emissor de moeda (único)  
▸ Banco dos bancos (emprestador de última instância)  
▸ Banqueiro do governo  
▸ Supervisor do SFN  
▸ Gestor das reservas internacionais  
▸ Executor da política monetária  

### CMN — Conselho Monetário Nacional

**Composição:**
- Ministro da Fazenda (Presidente)
- Ministro do Planejamento
- Presidente do Banco Central

**Não tem função executiva** — apenas normativa.

### Banco do Brasil — Características

| Aspecto | Detalhe |
|---------|---------|
| Natureza | Sociedade de economia mista |
| Controlador | União Federal |
| Registro | B3 (Bolsa de Valores) |
| Origem | 1808 — D. João VI |

**Papel especial do BB:**
- Agente financeiro do Tesouro Nacional
- Executor da política de crédito rural
- Câmara de liquidação do cheque

### Política Monetária

**Instrumentos:**
1. **Taxa SELIC** — taxa básica de juros (meta definida pelo COPOM)
2. **Depósito Compulsório** — % dos depósitos que bancos recolhem ao BACEN
3. **Operações de Mercado Aberto (Open Market)** — compra/venda de títulos públicos
4. **Redesconto** — empréstimos do BACEN aos bancos

> **COPOM** (Comitê de Política Monetária): define a meta da taxa SELIC a cada 45 dias.

### Produtos e Serviços Bancários

**Captação:**
- Conta corrente / poupança
- CDB (Certificado de Depósito Bancário)
- LCI / LCA (Letras de Crédito)

**Crédito:**
- Empréstimo pessoal
- Crédito consignado
- Financiamento imobiliário
- Cheque especial

**Serviços:**
- Cobrança
- Câmbio
- Custódia de valores`,
  },
  {
    nome: "Língua Portuguesa — Interpretação de Texto",
    disciplina: "Língua Portuguesa",
    totalQuestoes: 15,
    percentual: 9.9,
    percentualAcumulado: 68.0,
    prioridade: "media",
    pesoEdital: 3,
    conteudoMd: `## Língua Portuguesa — Interpretação de Texto

### Estratégias de Interpretação

**1. Leitura panorâmica**
Primeira leitura rápida para identificar tema geral, extensão e estrutura do texto.

**2. Leitura analítica**
Segunda leitura atenta, marcando ideias principais, palavras-chave e conectivos.

**3. Responder às perguntas básicas**
- O quê? (assunto)
- Quem? (emissor/receptor)
- Por quê? (finalidade)
- Como? (modo/meio)

### Tipologia Textual

| Tipo | Objetivo | Características |
|------|----------|----------------|
| Narrativo | Contar | Sequência temporal, personagens |
| Descritivo | Descrever | Características, estado, aparência |
| Dissertativo | Argumentar | Tese, argumentos, conclusão |
| Expositivo | Informar | Clareza, objetividade |
| Injuntivo | Instruir | Verbos imperativos |

### Coesão e Coerência

**Coesão** = ligação formal entre as partes do texto (conectivos, pronomes, sinônimos)

**Coerência** = lógica das ideias, sentido do texto

### Conectivos e Suas Relações

| Conectivo | Relação |
|-----------|---------|
| portanto, logo, assim | Conclusão |
| porém, mas, contudo | Oposição |
| porque, pois, já que | Causalidade |
| embora, apesar de | Concessão |
| se, caso, desde que | Condição |
| para que, a fim de que | Finalidade |

### Inferência e Pressuposto

- **Inferência:** conclusão lógica que se tira do texto, não explicitamente dita
- **Pressuposto:** informação que o texto toma como já conhecida

**Exemplo:**  
"João parou de fumar" → pressuposto: João fumava antes

### Figuras de Linguagem Frequentes em Provas

▸ **Metáfora:** comparação implícita ("a vida é uma viagem")  
▸ **Ironia:** dizer o contrário do que se quer significar  
▸ **Eufemismo:** suavizar expressão dura ("passou desta para melhor")  
▸ **Hipérbole:** exagero ("estou morrendo de fome")  
▸ **Antítese:** oposição de ideias ("amor e ódio")  

### Crase

Ocorre com a fusão de **a** (preposição) + **a** (artigo ou pronome demonstrativo).

**Regra básica:** só há crase antes de palavras **femininas** que admitem artigo.

**Dica:** substituir por "ao" — se couber, usa crase.  
"Fui **à** escola." → "Fui ao escola?" → Não funciona? → Tem crase.

**Casos em que NÃO há crase:**
- Antes de verbos
- Antes de palavras masculinas
- Antes de pronomes pessoais`,
  },
  {
    nome: "Raciocínio Lógico — Proposições e Tabela-Verdade",
    disciplina: "Raciocínio Lógico",
    totalQuestoes: 14,
    percentual: 9.2,
    percentualAcumulado: 77.2,
    prioridade: "media",
    pesoEdital: 3,
    conteudoMd: `## Raciocínio Lógico — Proposições e Tabela-Verdade

### O que é uma Proposição?

Proposição é uma sentença declarativa que pode ser classificada como **verdadeira (V)** ou **falsa (F)**, mas nunca ambas.

**Não são proposições:**
- Perguntas ("Que horas são?")
- Ordens ("Feche a porta!")
- Exclamações sem valor lógico ("Que belo dia!")
- Sentenças abertas ("x + 2 = 5")

### Conectivos Lógicos

| Conectivo | Símbolo | Nome | Verdadeiro quando |
|-----------|---------|------|------------------|
| e | ∧ | Conjunção | Ambas V |
| ou | ∨ | Disjunção | Pelo menos uma V |
| não | ¬ | Negação | A proposição é F |
| se...então | → | Condicional | A não é V com B sendo F |
| se e somente se | ↔ | Bicondicional | Ambas iguais |

### Condicional (→) — Mais Cobrado!

**"Se P, então Q"** → P → Q

| P | Q | P → Q |
|---|---|-------|
| V | V | **V** |
| V | F | **F** |
| F | V | **V** |
| F | F | **V** |

> A condicional só é **FALSA** quando P é verdadeiro e Q é falso!

### Negação das Proposições Compostas

| Original | Negação |
|----------|---------|
| P ∧ Q | ¬P ∨ ¬Q (De Morgan) |
| P ∨ Q | ¬P ∧ ¬Q (De Morgan) |
| P → Q | P ∧ ¬Q |
| P ↔ Q | P ↔ ¬Q |

### Equivalências Importantes

**Contrapositiva:** P → Q ≡ ¬Q → ¬P  
(A contrapositiva é sempre equivalente ao original)

**Negação da condicional:** ¬(P → Q) ≡ P ∧ ¬Q

### Silogismo — Dedução

**Todo A é B. Todo B é C. Logo, todo A é C.** ✓

**Exemplo:**  
"Todo concurseiro estuda muito."  
"Moisés é concurseiro."  
→ "Moisés estuda muito." ✓

### Argumentos Válidos

Um argumento é válido quando as premissas verdadeiras **necessariamente** conduzem à conclusão verdadeira.

**Modus Ponens:**  
P → Q  
P  
∴ Q  

**Modus Tollens:**  
P → Q  
¬Q  
∴ ¬P  

### Dica de Prova

▸ Ao ver "somente se" → inverte a ordem  
▸ "A menos que B" = "Se não A, então B"  
▸ "Apenas se" = "somente se" (mesma coisa)  
▸ Negação de "todos" = "existe pelo menos um que não"  
▸ Negação de "nenhum" = "existe pelo menos um que"`,
  },
  {
    nome: "Ética no Serviço Público",
    disciplina: "Ética e Legislação",
    totalQuestoes: 12,
    percentual: 7.9,
    percentualAcumulado: 85.1,
    prioridade: "media",
    pesoEdital: 2,
    conteudoMd: `## Ética no Serviço Público

### Fundamentos Éticos

**Ética** é o conjunto de princípios e valores que orientam o comportamento humano, distinguindo o certo do errado.

**Moral** é o código de conduta específico de um grupo ou sociedade.

### Princípios da Administração Pública

Art. 37 da Constituição Federal:

> **LIMPE** — Legalidade, Impessoalidade, Moralidade, Publicidade, Eficiência

| Princípio | Significado |
|-----------|-------------|
| Legalidade | Só fazer o que a lei autoriza |
| Impessoalidade | Tratar todos igualmente, sem favorecimentos |
| Moralidade | Agir com ética e honestidade |
| Publicidade | Transparência nos atos administrativos |
| Eficiência | Realizar com qualidade, rapidez e menor custo |

### Código de Ética do Servidor Público

**Decreto 1.171/1994** — Código de Ética Profissional do Servidor Público Civil Federal.

**Deveres do servidor:**
▸ Exercer com dedicação as atribuições do cargo  
▸ Ser assíduo e pontual  
▸ Tratar com urbanidade os colegas e cidadãos  
▸ Guardar sigilo das informações  
▸ Zelar pela economia do material público  

**Vedações (proibições):**
▸ Usar o cargo para obter vantagens pessoais  
▸ Prejudicar deliberadamente a reputação de colegas  
▸ Apresentar declarações falsas  
▸ Coartar a liberdade de consciência  
▸ Aceitar presentes de quem tenha interesse em decisão  

### Sigilo Bancário

**Lei Complementar 105/2001** — regula o sigilo das operações de instituições financeiras.

**Regra:** dados bancários são sigilosos.

**Exceções (sem autorização judicial):**
- Comissões Parlamentares de Inquérito (CPI)
- Receita Federal (para fins fiscais)
- BACEN (supervisão)
- COAF (lavagem de dinheiro)

### Prevenção à Lavagem de Dinheiro

**Lei 9.613/1998** (alterada pela Lei 12.683/2012)

**Fases da lavagem:**
1. **Colocação** — inserção do dinheiro no sistema financeiro
2. **Ocultação** — dissimulação da origem ilícita
3. **Integração** — retorno do dinheiro ao mercado como "limpo"

**COAF** — Conselho de Controle de Atividades Financeiras  
Responsável por receber, analisar e disseminar informações sobre atividades suspeitas.

**Operações suspeitas que devem ser comunicadas:**
▸ Movimentações incompatíveis com a renda declarada  
▸ Depósitos em espécie acima de R$ 50.000  
▸ Operações com países de alto risco  

### Responsabilidade do Servidor

**Responsabilidade Administrativa** → processo administrativo disciplinar (PAD)  
**Responsabilidade Civil** → ressarcimento ao erário  
**Responsabilidade Penal** → crimes funcionais`,
  },
  {
    nome: "Informática — Internet e Segurança Digital",
    disciplina: "Conhecimentos de Informática",
    totalQuestoes: 10,
    percentual: 6.6,
    percentualAcumulado: 91.7,
    prioridade: "baixa",
    pesoEdital: 2,
    conteudoMd: `## Informática — Internet e Segurança Digital

### Conceitos de Internet

**Protocolos fundamentais:**
- **TCP/IP** — protocolo base da internet
- **HTTP/HTTPS** — transferência de páginas web (S = seguro, criptografado)
- **FTP** — transferência de arquivos
- **SMTP/POP3/IMAP** — e-mail
- **DNS** — converte nomes de domínio em IPs

**URL:** Uniform Resource Locator  
Exemplo: \`https://www.bancodobrasil.com.br/servicos\`  
- Protocolo: https  
- Domínio: www.bancodobrasil.com.br  
- Caminho: /servicos

### Segurança da Informação

**Os 5 pilares (DICAI):**

| Pilar | Descrição |
|-------|-----------|
| Disponibilidade | Sistema acessível quando necessário |
| Integridade | Dado não alterado sem autorização |
| Confidencialidade | Acesso apenas por quem tem permissão |
| Autenticidade | Garantia da identidade do usuário |
| Irretratabilidade | Impossibilidade de negar autoria |

### Ameaças Digitais

**Malwares:**
▸ **Vírus** — se replica aderindo a arquivos  
▸ **Worm** — se propaga pela rede automaticamente  
▸ **Trojan** — parece legítimo, mas é malicioso  
▸ **Ransomware** — sequestra dados e pede resgate  
▸ **Spyware** — monitora atividade sem conhecimento  
▸ **Adware** — exibe propagandas indesejadas  
▸ **Keylogger** — registra teclas digitadas  

**Engenharia Social:**
- **Phishing** — e-mail falso para roubar dados
- **Vishing** — phishing por voz (telefone)
- **Smishing** — phishing por SMS
- **Pretexting** — criação de cenário falso

### Criptografia

**Simétrica:** mesma chave para criptografar e descriptografar  
**Assimétrica:** par de chaves (pública + privada)

> O **HTTPS** usa criptografia assimétrica (TLS/SSL) para proteger a comunicação.

### Backup

**Tipos:**
| Tipo | O que copia | Tempo | Espaço |
|------|-------------|-------|--------|
| Completo | Tudo | Lento | Muito |
| Incremental | Mudanças desde último backup | Rápido | Pouco |
| Diferencial | Mudanças desde último completo | Médio | Médio |

**Regra 3-2-1:** 3 cópias, em 2 mídias diferentes, 1 fora do local.

### Nuvem (Cloud Computing)

**Modelos de serviço:**
- **IaaS** — Infraestrutura como Serviço (servidores, rede)
- **PaaS** — Plataforma como Serviço (ambiente de desenvolvimento)
- **SaaS** — Software como Serviço (aplicações prontas: Gmail, Office 365)

**Modelos de implantação:**
- Pública, Privada, Híbrida, Comunitária`,
  },
];

async function run() {
  console.log("🌱 Iniciando seed...\n");

  // ── 1. Criar Análise ──────────────────────────────────────────────────────
  console.log("📊 Criando análise...");
  const analiseRes = await db.execute({
    sql: `INSERT INTO analises (titulo, cargo, banca, status, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id`,
    args: [
      "Banco do Brasil — Edital 2024",
      "Agente Comercial",
      "CESGRANRIO",
      "concluido",
      ts(diasAtras(10)),
    ],
  });
  const analiseId = Number(analiseRes.rows[0].id);
  console.log(`   ✅ Análise criada (id=${analiseId})`);

  // ── 2. Criar Assuntos ─────────────────────────────────────────────────────
  console.log("📋 Criando assuntos...");
  for (const a of ASSUNTOS_DATA) {
    await db.execute({
      sql: `INSERT INTO assuntos (analise_id, nome, disciplina, total_questoes, percentual, percentual_acumulado, prioridade, peso_edital) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [analiseId, a.nome, a.disciplina, a.totalQuestoes, a.percentual, a.percentualAcumulado, a.prioridade, a.pesoEdital],
    });
  }
  console.log(`   ✅ ${ASSUNTOS_DATA.length} assuntos criados`);

  // ── 3. Criar Plano de Estudo ──────────────────────────────────────────────
  console.log("📅 Criando plano de estudo...");
  const planoJson = JSON.stringify({
    diasEstudo: 45,
    horasDia: 3,
    semanas: [
      {
        semana: 1,
        dias: [
          { dia: "Segunda", assunto: "Fundamentos de Atendimento ao Cliente", disciplina: "Atendimento", prioridade: "alta" },
          { dia: "Terça", assunto: "Vendas e Negociação — Técnicas Fundamentais", disciplina: "Vendas e Negociação", prioridade: "alta" },
          { dia: "Quarta", assunto: "Matemática Financeira — Juros e Taxas", disciplina: "Matemática Financeira", prioridade: "alta" },
          { dia: "Quinta", assunto: "Conhecimentos Bancários — Sistema Financeiro Nacional", disciplina: "Conhecimentos Bancários", prioridade: "alta" },
          { dia: "Sexta", assunto: "Língua Portuguesa — Interpretação de Texto", disciplina: "Língua Portuguesa", prioridade: "media" },
          { dia: "Sábado", assunto: "Revisão da Semana 1", disciplina: "Revisão", prioridade: "alta" },
        ],
      },
      {
        semana: 2,
        dias: [
          { dia: "Segunda", assunto: "Raciocínio Lógico — Proposições e Tabela-Verdade", disciplina: "Raciocínio Lógico", prioridade: "media" },
          { dia: "Terça", assunto: "Ética no Serviço Público", disciplina: "Ética e Legislação", prioridade: "media" },
          { dia: "Quarta", assunto: "Informática — Internet e Segurança Digital", disciplina: "Conhecimentos de Informática", prioridade: "baixa" },
          { dia: "Quinta", assunto: "Vendas: Cross-selling e Up-selling", disciplina: "Vendas e Negociação", prioridade: "alta" },
          { dia: "Sexta", assunto: "Matemática Financeira — Séries e Anuidades", disciplina: "Matemática Financeira", prioridade: "media" },
          { dia: "Sábado", assunto: "Revisão da Semana 2", disciplina: "Revisão", prioridade: "alta" },
        ],
      },
    ],
  });

  await db.execute({
    sql: `INSERT INTO planos_estudo (analise_id, dias_estudo, horas_dia, plano_json, created_at) VALUES (?, ?, ?, ?, ?)`,
    args: [analiseId, 45, 3, planoJson, ts(diasAtras(10))],
  });
  console.log("   ✅ Plano criado");

  // ── 4. Criar Curso ────────────────────────────────────────────────────────
  console.log("📚 Criando curso...");
  const cursoRes = await db.execute({
    sql: `INSERT INTO cursos_aula (titulo, cargo, analise_id, gerando_status, total_aulas_geradas, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [
      "Banco do Brasil — Agente Comercial 2024",
      "Agente Comercial",
      analiseId,
      "concluido",
      12,
      ts(diasAtras(9)),
    ],
  });
  const cursoId = Number(cursoRes.rows[0].id);
  console.log(`   ✅ Curso criado (id=${cursoId})`);

  // ── 5. Criar Aulas ────────────────────────────────────────────────────────
  console.log("🎓 Criando aulas...");

  // Mapeamento semana/dia para as aulas
  const AULAS_CONFIG = [
    // Semana 1 — aulas concluídas (já estudadas)
    { semana: 1, dia: "Segunda", idx: 0, status: "concluida", concluidaHa: 7 },
    { semana: 1, dia: "Terça",   idx: 1, status: "concluida", concluidaHa: 6 },
    { semana: 1, dia: "Quarta",  idx: 2, status: "concluida", concluidaHa: 5 },
    { semana: 1, dia: "Quinta",  idx: 3, status: "concluida", concluidaHa: 4 },
    // Semana 1 restante — pendentes
    { semana: 1, dia: "Sexta",   idx: 4, status: "gerada", concluidaHa: null },
    { semana: 1, dia: "Sábado",  idx: 5, status: "gerada", concluidaHa: null },
    // Semana 2 — HOJE e próximos dias
    { semana: 2, dia: diaUtil(0), idx: 6, status: "gerada", concluidaHa: null },  // HOJE
    { semana: 2, dia: diaUtil(1), idx: 7, status: "gerada", concluidaHa: null },
    { semana: 2, dia: diaUtil(2), idx: 2, status: "gerada", concluidaHa: null },
    { semana: 2, dia: diaUtil(3), idx: 3, status: "gerada", concluidaHa: null },
    { semana: 2, dia: diaUtil(4), idx: 4, status: "gerada", concluidaHa: null },
    { semana: 2, dia: diaUtil(5), idx: 5, status: "gerada", concluidaHa: null },
  ];

  const aulaIds: number[] = [];
  const aulasConcluidasIds: number[] = []; // para criar revisões

  for (let i = 0; i < AULAS_CONFIG.length; i++) {
    const cfg = AULAS_CONFIG[i];
    const assunto = ASSUNTOS_DATA[cfg.idx];
    const concluidaEm = cfg.concluidaHa !== null ? ts(diasAtras(cfg.concluidaHa)) : null;

    const res = await db.execute({
      sql: `INSERT INTO aulas (curso_id, ordem, semana, dia_semana, assunto, disciplina, prioridade, conteudo_md, status, concluida_em, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      args: [
        cursoId,
        i + 1,
        cfg.semana,
        cfg.dia,
        assunto.nome,
        assunto.disciplina,
        assunto.prioridade,
        assunto.conteudoMd,
        cfg.status,
        concluidaEm,
        ts(diasAtras(9)),
      ],
    });
    const aulaId = Number(res.rows[0].id);
    aulaIds.push(aulaId);
    if (cfg.status === "concluida" && cfg.concluidaHa !== null) {
      aulasConcluidasIds.push(aulaId);
    }
    process.stdout.write(`   ✅ Aula ${i + 1}/12: ${assunto.nome.substring(0, 40)}...\n`);
  }

  // ── 6. Criar Revisões ─────────────────────────────────────────────────────
  console.log("\n🔁 Criando revisões espaçadas...");

  // Aula 1 (concluída há 7 dias) → revisão 7d HOJE, 30d em 23 dias, 90d em 83 dias
  // Aula 2 (concluída há 6 dias) → revisão 7d em 1 dia
  // Aula 3 (concluída há 5 dias) → revisão 7d em 2 dias
  // Aula 4 (concluída há 4 dias) → revisão 24h (já passou, atrasada), 7d em 3 dias

  const REVISOES = [
    // Aula 1 — revisão 7d HOJE (para aparecer no dashboard!)
    { aulaIdx: 0, tipo: "7d",  agendadaEm: HOJE, concluida: false },
    // Aula 1 — revisão 30d
    { aulaIdx: 0, tipo: "30d", agendadaEm: diasFrente(23), concluida: false },
    // Aula 2 — revisão 24h (concluída)
    { aulaIdx: 1, tipo: "24h", agendadaEm: diasAtras(5), concluida: true },
    // Aula 2 — revisão 7d HOJE também
    { aulaIdx: 1, tipo: "7d",  agendadaEm: HOJE, concluida: false },
    // Aula 3 — revisão 24h concluída
    { aulaIdx: 2, tipo: "24h", agendadaEm: diasAtras(4), concluida: true },
    // Aula 3 — revisão 7d em 2 dias
    { aulaIdx: 2, tipo: "7d",  agendadaEm: diasFrente(2), concluida: false },
    // Aula 4 — revisão 24h HOJE
    { aulaIdx: 3, tipo: "24h", agendadaEm: HOJE, concluida: false },
    // Aula 4 — revisão 7d futura
    { aulaIdx: 3, tipo: "7d",  agendadaEm: diasFrente(3), concluida: false },
  ];

  for (const rev of REVISOES) {
    const aulaId = aulasConcluidasIds[rev.aulaIdx];
    if (!aulaId) continue;
    await db.execute({
      sql: `INSERT INTO revisoes (aula_id, curso_id, tipo, agendada_para, concluida_em, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        aulaId,
        cursoId,
        rev.tipo,
        ts(rev.agendadaEm),
        rev.concluida ? ts(diasAtras(1)) : null,
        ts(diasAtras(5)),
      ],
    });
    console.log(`   ✅ Revisão ${rev.tipo} para aula ${rev.aulaIdx + 1} — ${rev.agendadaEm.toLocaleDateString("pt-BR")} ${rev.concluida ? "(concluída)" : "(pendente)"}`);
  }

  console.log("\n✨ Seed concluído!");
  console.log(`   📊 Análise: ${analiseId}`);
  console.log(`   📚 Curso: ${cursoId}`);
  console.log(`   🎓 ${aulaIds.length} aulas criadas`);
  console.log(`   🔁 ${REVISOES.length} revisões criadas`);
  console.log(`   📅 Dia de hoje detectado: ${diaHoje}`);
  console.log(`\n   Dashboard deve mostrar:`);
  console.log(`   - 1 aula de hoje (${diaHoje}, semana 2)`);
  console.log(`   - 3 revisões hoje (7d aula 1, 7d aula 2, 24h aula 4)`);
}

run().catch(console.error);
