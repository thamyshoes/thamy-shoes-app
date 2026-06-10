# Ficha de Produção Consolidada - Fluxo de Ponta a Ponta

## Escopo

Este documento descreve o fluxo real implementado no repositório Thamy Shoes para geração de fichas de produção a partir de pedidos de compra. Existem dois caminhos de consolidado no código atual:

| Fluxo | Rota | Uso atual | Saída |
|---|---|---|---|
| Consolidado V2 sem persistência | `POST /api/consolidar` | Usado pela tela `/pedidos/consolidar` | Retorna PDFs em base64 para download imediato no navegador |
| Consolidado persistente | `POST /api/fichas/consolidar` | API disponível, não é o caminho usado pela tela principal de consolidado | Salva PDFs no Supabase Storage e registros em `FichaProducao` |

Também existe o fluxo individual (`POST /api/fichas/gerar`), que gera fichas persistidas para um único pedido.

---

## Stack Técnica

| Camada | Implementação atual |
|---|---|
| Frontend | Next.js 15 App Router, React 18, TailwindCSS, componentes internos |
| Backend | Route Handlers do Next.js em `src/app/api` |
| Banco de dados | PostgreSQL via Prisma ORM |
| Storage de PDFs persistidos | Supabase Storage, bucket `fichas-producao` |
| Geração de PDF | `@react-pdf/renderer` + `yoga-layout` |
| Autenticação | JWT próprio em cookie `auth-token`, assinado com `jose` |
| Integração Bling | `blingService` usando conexão armazenada em `bling_connections` |

Supabase é usado para storage. A autenticação do sistema não usa Supabase Auth.

---

## Entidades do Banco Envolvidas

```text
PedidoCompra
  ├── numero
  ├── dataEmissao
  ├── fornecedorNome
  ├── ItemPedido[]
  ├── FichaProducao[]
  └── ConsolidadoPedido[]

ItemPedido
  ├── skuBruto
  ├── modelo / modeloId
  ├── cor / corDescricao
  ├── tamanho
  ├── quantidade
  └── status: PENDENTE | RESOLVIDO

Modelo
  ├── codigo / nome
  ├── cabedal / sola / palmilha / facheta
  ├── materialCabedal / materialSola / materialPalmilha / materialFacheta
  └── ModeloVarianteCor[]

ModeloVarianteCor
  ├── corCodigo
  ├── imagemUrl
  └── corCabedal / corSola / corPalmilha / corFacheta

MapeamentoCor
  └── codigo -> descricao / hex

GradeNumeracao + GradeModelo
  └── define a faixa de tamanhos aplicável a um código de modelo

Consolidado
  ├── ConsolidadoPedido[]
  └── FichaProducao[]

FichaProducao
  ├── pedidoId ou consolidadoId
  ├── setor
  ├── pdfUrl
  ├── totalPares
  └── dadosJson
```

**Status de pedido:**

| Status | Uso |
|---|---|
| `IMPORTADO` | Pedido importado e disponível para ajuste/geração |
| `PENDENTE_AJUSTE` | Status previsto para pedidos com itens pendentes |
| `FICHAS_GERADAS` | Pelo menos uma ficha individual foi gerada para o pedido |

Observação importante: a rota `POST /api/pedidos/importar` interpreta os itens após importar, mas no código atual não muda automaticamente o pedido para `PENDENTE_AJUSTE` quando sobram itens pendentes. A geração de fichas ainda é bloqueada no fluxo individual persistente porque `gerarFichas()` valida os status dos itens.

**Status de item:**

| Status | Uso |
|---|---|
| `PENDENTE` | SKU não foi resolvido completamente |
| `RESOLVIDO` | `modelo`, `cor` e `tamanho` foram determinados |

---

## Fase 1 - Importação do Pedido

**Rota:** `POST /api/pedidos/importar`  
**Input real:** `{ idBling: number }`  
**Acesso:** ADMIN e PCP, conforme middleware.

O sistema:

1. Valida `idBling` com `importPedidoSchema`.
2. Bloqueia duplicata por `PedidoCompra.idBling`.
3. Busca o pedido no Bling via `blingService.getPedidoCompra(idBling)`.
4. Busca o nome do fornecedor via `getContatoNome()` quando o detalhe do pedido não traz nome.
5. Cria `PedidoCompra` com status `IMPORTADO`.
6. Cria `ItemPedido` para cada item do Bling com status inicial `PENDENTE`.
7. Executa `interpretarItens()` para tentar resolver SKU, modelo, cor, tamanho, produto e modelo cadastrado.

Campos criados por item:

| Campo | Origem |
|---|---|
| `descricaoBruta` | `item.descricao` do Bling |
| `skuBruto` | `item.produto.codigo` |
| `quantidade` | `item.quantidade` |
| `unidade` | `item.unidade` ou `PAR` |
| `variacoes` | `item.variacoes`, quando presente |
| `status` | começa como `PENDENTE` |

---

## Fase 2 - Interpretação de SKU

**Arquivo:** `src/lib/bling/sku-parser.ts`

A regra ativa vem da tabela `regras_sku`. O cache da regra fica em memória por processo e pode ser invalidado por `invalidarCacheRegra()`.

### Modo SEPARADOR

Divide a SKU pelo separador configurado e preenche os campos conforme `ordem`.

```text
RegraSkU: separador="-", ordem=["modelo", "cor", "tamanho"]
SKU "8054-298-37" -> modelo=8054, cor=298, tamanho=37
```

Neste modo, o parse exige presença de `modelo`, `cor` e `tamanho`. Na etapa de update, `tamanho` precisa ser numérico para o item ficar `RESOLVIDO`.

### Modo SUFIXO

Extrai segmentos da direita para a esquerda conforme `digitosSufixo`. O restante vira `modelo`.

```text
RegraSkU: digitosSufixo=[{campo:"tamanho",digitos:2},{campo:"cor",digitos:3}]
SKU "805429837" -> tamanho=37, cor=298, modelo=8054
```

Neste modo, `cor` e `tamanho` precisam ser numéricos. SKUs com letras nos segmentos extraídos, como `805400131b` ou `307000624bm02`, ficam `PENDENTE`.

### Enriquecimento dos itens

`interpretarItens()` executa:

1. `parseSku()` para todos os itens.
2. Busca de `MapeamentoCor` pelas cores extraídas.
3. Busca de `Produto` por `codigo` igual ao modelo extraído.
4. Busca de `Modelo` por `codigo` igual ao modelo extraído, incluindo variantes de cor.
5. Auto-criação de `MapeamentoCor` como `(codigo, codigo)` somente para cores ausentes que existem como variante de um modelo encontrado.
6. Atualização dos `ItemPedido` em lotes de 10.

O item recebe:

| Campo | Como é preenchido |
|---|---|
| `modelo` | Resultado do parser |
| `cor` | Resultado do parser |
| `corDescricao` | `MapeamentoCor.descricao` ou o próprio código |
| `tamanho` | Inteiro quando o tamanho é numérico |
| `produtoId` | Produto local cujo `codigo` bate com o modelo |
| `modeloId` | Modelo local cujo `codigo` bate com o modelo |
| `status` | `RESOLVIDO` quando parse e tamanho são válidos; caso contrário `PENDENTE` |

A resolução manual é feita por `PUT /api/pedidos/[id]/itens`. Quando todos os itens ficam resolvidos, a rota tenta voltar um pedido `PENDENTE_AJUSTE` para `IMPORTADO`.

---

## Fase 3 - Montagem de Grades Persistentes

**Função:** `montarGradesConsolidadas(pedidoIds, { agruparPorFaixa? })`

Esta função alimenta o fluxo individual persistente e o fluxo consolidado persistente (`/api/fichas/consolidar`). Ela busca apenas itens `RESOLVIDO` com `modelo`, `cor` e `tamanho` preenchidos.

### Agrupamento base

| Opção | Chave usada |
|---|---|
| `agruparPorFaixa=false` | `modelo + cor` |
| `agruparPorFaixa=true` | `modelo + cor + faixa` |

A faixa é calculada assim:

```text
tamanho <= 27 -> INFANTIL
tamanho >= 28 -> ADULTO
```

Quando há `GradeModelo` para o modelo, a grade renderizada usa todo o intervalo `tamanhoMin..tamanhoMax`. Tamanhos sem quantidade entram com valor `0` e são renderizados em branco no PDF, não removidos da estrutura.

### Estrutura real de `GradeRow`

```typescript
interface GradeRow {
  modelo: string
  modeloNome?: string
  modeloCabedal?: string
  modeloSola?: string
  modeloPalmilha?: string
  modeloFacheta?: string
  materialCabedal?: string
  materialSola?: string
  materialPalmilha?: string
  materialFacheta?: string
  imagemUrl?: string
  corCabedal?: string
  corSola?: string
  corPalmilha?: string
  corFacheta?: string
  cor: string
  corDescricao: string
  tamanhos: Record<string, number>
  totalPares: number
}
```

`GradeRow` não carrega `pedidoNumero`, `pedidoData`, `fornecedor` ou `faixa` como campos separados. Esses dados são montados depois, no serviço de PDF ou na rota V2.

---

## Fase 4 - Conversão para Cards PDF

**Arquivo:** `src/lib/pdf/pdf-generator.tsx`

No fluxo persistente, cada `GradeRow` vira `ConsolidadoCardData` por `gradeRowToCard()`.

O card contém:

```typescript
interface ConsolidadoCardData {
  pedido: {
    numero: string
    data: Date | string
    fornecedor: string
  }
  item: {
    sku: string
    modelo: ModeloData
    variante: VarianteData
    quantidades: Record<number, number>
  }
  base64Imagem: string | null
  tamanhos: number[]
}
```

As descrições das cores de componentes (`corCabedalDesc`, `corSolaDesc`, `corPalmilhaDesc`, `corFachetaDesc`) são resolvidas por `buildCorDescMap()` a partir de `MapeamentoCor`.

---

## Fase 5 - Merge por Setor no Fluxo Persistente

**Função:** `mergeCardsPorSetor(setor, cards)` em `src/lib/pdf/pdf-generator.tsx`.

O merge é aplicado nos fluxos persistentes (`POST /api/fichas/gerar` e `POST /api/fichas/consolidar`). Ele não é aplicado pela rota V2 `POST /api/consolidar`.

| Setor | Regra real de merge persistente |
|---|---|
| CABEDAL | Não faz merge. Cada card permanece separado. |
| SOLA | Agrupa por `Modelo.sola + corSola`. `materialSola` não entra na chave atual. |
| PALMILHA | Agrupa por `Modelo.palmilha + corPalmilha + materialPalmilha`. |
| FACHETA | Filtra cards sem `Modelo.facheta` e agrupa por `Modelo.facheta + corFacheta + materialFacheta + corSola`. |

Se a referência ou a cor do componente estiver ausente, o card não é fundido com outros e recebe uma chave única baseada em SKU e pedido.

### FACHETA no fluxo persistente

No serviço persistente:

1. A facheta só renderiza cards cujo `item.modelo.facheta` existe.
2. `renderConsolidadoPdf()` também filtra cards sem facheta antes de renderizar.
3. Se nenhum modelo tiver facheta, o setor FACHETA não entra na lista automática do consolidado persistente.
4. No fluxo individual persistente, se algum modelo do pedido tem facheta, o serviço adiciona FACHETA à lista de setores mesmo que a UI não envie esse setor.

---

## Fase 6 - Renderização de PDF

**Arquivo:** `src/lib/pdf/render-consolidado.tsx`

A função `renderConsolidadoPdf(setor, cards)` escolhe o template por setor e monta um `PageLayout`.

| Setor | Template | Cards por página |
|---|---|---|
| CABEDAL | `TemplateCabedal` | 5 |
| PALMILHA | `TemplatePalmilha` | 5 |
| SOLA | `TemplateSola` | 5 |
| FACHETA | `TemplateFacheta` | 6 |

### Templates

| Setor | Característica |
|---|---|
| CABEDAL | Mostra SKU, REF/Cor/Material do cabedal, REF/Cor da sola, REF/Cor da palmilha e imagem da variante quando disponível. |
| SOLA | Usa `TemplateSimples` com REF Sola, Cor Sola e Material Sola. |
| PALMILHA | Usa `TemplateSimples` com REF Palmilha, Cor Palmilha e Material Palmilha. |
| FACHETA | Usa layout de 3 colunas com dados de pedido, facheta e sola. |

### Sequencial vs paralelo

| Fluxo | Comportamento atual |
|---|---|
| `PdfGeneratorService.gerarFichas()` | Renderiza setores sequencialmente. CABEDAL é ordenado por último por causa das imagens. |
| `PdfGeneratorService.gerarFichasConsolidadas()` | Renderiza setores sequencialmente antes da transação de banco. |
| `POST /api/consolidar` | Renderiza setores com `Promise.all`, ou seja, em paralelo. |

---

## Fase 7 - Fluxo Individual Persistente

**Rota:** `POST /api/fichas/gerar`  
**Input:**

```typescript
{
  pedidoId: string
  setores?: Array<'CABEDAL' | 'SOLA' | 'PALMILHA' | 'FACHETA'>
}
```

Quando `setores` não é informado, usa `[CABEDAL, PALMILHA, SOLA]`.

### Validações

- Pedido precisa existir.
- Pedido precisa ter pelo menos um item.
- Todos os itens precisam estar `RESOLVIDO`.
- A tela de detalhe do pedido também consulta `/api/modelos/verificar-variantes` e bloqueia o botão quando faltam variantes por modelo/cor.

### Persistência

Para cada setor gerado:

1. Converte imagens para base64 somente no CABEDAL.
2. Aplica merge por setor.
3. Renderiza PDF.
4. Faz upload para Supabase Storage.
5. Cria `FichaProducao` com `pedidoId`.
6. Ao final, se ao menos uma ficha foi gerada, atualiza o pedido para `FICHAS_GERADAS`.

Path real no storage:

```text
pedidos/{pedidoId}/{setor-em-minusculo}.pdf
```

Exemplo: `pedidos/uuid-do-pedido/palmilha.pdf`.

---

## Fase 8 - Consolidado V2 Sem Persistência

**Rota:** `POST /api/consolidar`  
**Tela:** `/pedidos/consolidar`  
**Componente:** `src/components/pedidos/consolidado-page.tsx`

Este é o fluxo usado pela UI principal de consolidado.

### Input real

```typescript
{
  pedidoIds: string[]          // mínimo 1 UUID
  setores: Array<'CABEDAL' | 'SOLA' | 'PALMILHA' | 'FACHETA'>
  agruparPorFaixa?: boolean
}
```

A tela envia sempre os setores padrão:

```typescript
['CABEDAL', 'SOLA', 'PALMILHA']
```

FACHETA não é enviada pelo frontend. A rota detecta e adiciona FACHETA automaticamente quando algum card tem `Modelo.facheta` preenchido (ver Processamento abaixo).

### Processamento

A rota:

1. Aplica rate limit específico de consolidado.
2. Busca itens `RESOLVIDO` dos pedidos selecionados.
3. Busca dados dos pedidos (`numero`, `dataEmissao`, `fornecedorNome`).
4. Busca `Modelo` e `ModeloVarianteCor`.
5. Resolve descrições de cores por componente via `MapeamentoCor` (`corCabedalDesc`, `corSolaDesc`, `corPalmilhaDesc`, `corFachetaDesc`).
6. Agrupa por `pedidoId + modelo + cor` ou `pedidoId + modelo + cor + faixa`.
7. Converte imagens para base64 quando CABEDAL está entre os setores.
8. Divide grupos em chunks de 20 apenas como organização interna.
9. Auto-detecta FACHETA: se `consolidadoCards.some(c => !!c.item.modelo.facheta)`, adiciona FACHETA aos setores.
10. Renderiza um PDF por setor **sequencialmente** (não em paralelo — yoga-layout WASM instável).
11. Omite setores sem cards relevantes (evita PDF vazio).
12. Retorna os PDFs em base64.

### Saída

```typescript
Array<{
  setor: string
  pdfBase64: string
  totalCards: number
  chunks: number
}>
```

O navegador transforma cada `pdfBase64` em `Blob` e dispara download automático com nome:

```text
consolidado-{setor-em-minusculo}.pdf
```

### Limitações atuais do V2

- Não cria `Consolidado`.
- Não cria `ConsolidadoPedido`.
- Não cria `FichaProducao`.
- Não faz upload para Supabase Storage.
- Não aparece posteriormente na Central de Fichas.
- Não aplica `mergeCardsPorSetor()`.
- Não valida explicitamente se todos os itens dos pedidos estão resolvidos; itens pendentes simplesmente não entram porque a query filtra `status=RESOLVIDO`.
- A UI permite gerar com 1 pedido selecionado.

**Comportamentos corrigidos em 2026-05-20:**

- FACHETA agora é detectada e incluída automaticamente quando algum modelo tem `facheta` cadastrado.
- Descrições de cores por componente (`corPalmilhaDesc`, `corSolaDesc`, `corCabedalDesc`, `corFachetaDesc`) agora são resolvidas via `MapeamentoCor` antes de montar os cards.
- Renderização alterada de `Promise.all` para loop sequencial.
- `totalCards` agora é retornado por setor, não global.

---

## Fase 9 - Consolidado Persistente

**Rota:** `POST /api/fichas/consolidar`

### Input

```typescript
{
  pedidoIds: string[]          // mínimo 2, máximo 100
  agruparPorFaixa?: boolean
}
```

A lista de setores é automática: CABEDAL, PALMILHA, SOLA e FACHETA quando algum card tem `modeloFacheta`.

### Validações

- Todos os pedidos informados precisam existir.
- Todos os itens dos pedidos encontrados precisam estar `RESOLVIDO`.

A rota não recebe seleção de setores.

### Persistência

O serviço:

1. Monta grades via `montarGradesConsolidadas()`.
2. Renderiza todos os PDFs sequencialmente.
3. Abre uma transação Prisma.
4. Cria `Consolidado`.
5. Cria registros `ConsolidadoPedido`.
6. Faz upload dos PDFs para Supabase Storage.
7. Cria `FichaProducao` com `consolidadoId`.

Path real no storage:

```text
consolidados/{consolidadoId}/{setor-em-minusculo}.pdf
```

Exemplo: `consolidados/uuid-do-consolidado/palmilha.pdf`.

Observação: a transação garante rollback dos registros de banco se uma etapa de banco falhar. O upload no Supabase é uma chamada externa; se um upload ocorrer e uma falha posterior abortar a transação, pode haver arquivo órfão no storage.

---

## Rotas Relacionadas

| Rota | Método | Uso |
|---|---|---|
| `/api/pedidos/importar` | POST | Importa pedido do Bling e interpreta SKUs |
| `/api/pedidos/[id]` | GET | Detalhe do pedido, itens, grades e `temFacheta` |
| `/api/pedidos/[id]/itens` | PUT | Ajuste manual de item pendente |
| `/api/modelos/verificar-variantes` | GET | Bloqueia geração individual quando faltam variantes modelo/cor |
| `/api/fichas/gerar` | POST | Gera fichas individuais persistidas |
| `/api/consolidar` | POST | Gera consolidado V2 em base64, sem persistência |
| `/api/fichas/consolidar` | GET | Preview persistente de grades consolidadas |
| `/api/fichas/consolidar` | POST | Gera consolidado persistido |
| `/api/fichas` | GET | Lista fichas persistidas, com filtro por setor para PRODUCAO |
| `/api/fichas/download/[id]` | GET | Baixa ficha persistida do Supabase Storage |

---

## Acesso por Perfil

| Perfil | Importa pedidos | Gera fichas | Gera consolidado | Visualiza fichas |
|---|---|---|---|---|
| ADMIN | Sim | Sim | Sim | Todos os setores |
| PCP | Sim | Sim | Sim | Todos os setores |
| PRODUCAO | Não | Não | Não | Apenas setores atribuídos ao usuário |

O middleware injeta `x-user-id`, `x-user-perfil` e `x-user-setores` nas rotas autenticadas. A listagem e o download de fichas restringem PRODUCAO aos setores do usuário.

---

## Limites Técnicos

| Parâmetro | Valor atual |
|---|---|
| Timeout em rotas pesadas | `maxDuration = 60` |
| Batch de atualização de itens | 10 updates simultâneos |
| Página padrão de fichas | 20 itens |
| Página de seleção do consolidado | 15 pedidos |
| Máximo do consolidado persistente | 100 pedidos |
| Rate limit de `/api/fichas/gerar` e `/api/fichas/consolidar` | 30 req/min por IP |
| Rate limit de `/api/consolidar` | 10 req/min por IP |
| Chunk lógico no consolidado V2 | 20 cards |
| Storage bucket | `fichas-producao` |

O rate limiter é em memória. Em ambiente serverless com múltiplas instâncias, o limite não é global.

---

## Diagrama do Fluxo Usado Pela Tela de Consolidado

```text
/pedidos/consolidar
      |
      | seleciona 1+ pedidos
      | setores enviados: CABEDAL, SOLA, PALMILHA
      v
POST /api/consolidar
      |
      | busca ItemPedido RESOLVIDO
      | busca PedidoCompra, Modelo, ModeloVarianteCor
      | resolve corDescMap via MapeamentoCor (corPalmilhaDesc, etc.)
      v
Agrupa por pedidoId + modelo + cor [+ faixa]
      |
      | CABEDAL converte imagens para base64
      | auto-detecta FACHETA (cards.some(c => !!c.item.modelo.facheta))
      | setoresFinais = [CABEDAL, SOLA, PALMILHA] + [FACHETA se detectada]
      v
para cada setor (sequencial):
  cardsDoSetor = filtrar por setor (FACHETA filtra por modelo.facheta)
  if cardsDoSetor.length === 0 → omitir setor
  renderConsolidadoPdf(setor, cardsDoSetor)
      |
      v
Resposta JSON com pdfBase64 por setor
      |
      v
Browser baixa consolidado-cabedal.pdf,
              consolidado-sola.pdf,
              consolidado-palmilha.pdf
              [+ consolidado-facheta.pdf quando detectada]
```

---

## Pontos de Atenção

1. **Dois consolidados diferentes:** a tela principal usa `/api/consolidar` e não persiste nada. A rota `/api/fichas/consolidar` persiste, mas não é o caminho atual do botão da tela de consolidado.

2. **FACHETA no consolidado V2:** a tela envia somente CABEDAL, SOLA e PALMILHA, mas a rota detecta automaticamente se algum card tem `Modelo.facheta` e inclui FACHETA nos setores a renderizar. Se nenhum modelo tiver facheta, FACHETA é omitida sem gerar PDF vazio. Correção aplicada em 2026-05-20.

3. **Merge por setor:** `mergeCardsPorSetor()` existe apenas no serviço persistente. O consolidado V2 renderiza os cards agrupados pela própria rota, sem aplicar essa função.

4. **Zeros na grade:** quando há grade cadastrada para o modelo, os tamanhos do intervalo inteiro são renderizados. Quantidades zero aparecem como célula em branco, não são removidas.

5. **Imagem CABEDAL:** no fluxo individual persistente, falta de `imagemUrl` gera aviso, mas não bloqueia geração. Na tela de detalhe, a geração individual é bloqueada antes quando faltam variantes modelo/cor.

6. **Status PENDENTE_AJUSTE:** existe no domínio, mas a importação atual não o aplica automaticamente após interpretar SKUs. O bloqueio efetivo da geração persistente acontece pela validação dos itens pendentes.

7. **Storage em minúsculo:** os paths usam `setor.toLowerCase()`, por exemplo `palmilha.pdf`, não `PALMILHA.pdf`.
