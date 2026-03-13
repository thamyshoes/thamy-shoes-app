# TASKLIST — Alinhamento Implementação ↔ Brief (Fichas V2)

> **Gerado em:** 2026-03-13
> **Fonte:** INTAKE-SKELETON.md + Rock-1 (config-modelos-variantes) + Rock-2 (fichas-templates-pdf) + Codex MCP análise
> **Escopo:** Corrigir TODOS os gaps entre a implementação atual e o brief spec
> **Modelo de execução:** Sequencial (cada task depende da anterior)

---

## Inventário de Gaps (Codex + análise manual)

| # | Prioridade | Gap | Tipo |
|---|-----------|-----|------|
| 1 | P0 | Tabela de modelos: faltam 5 colunas (refs + linha) | fix |
| 2 | P0 | Modal de edição: não expõe refs (cabedal/sola/palmilha) nem linha | fix |
| 3 | P0 | API de modelos: PATCH/POST não aceita refs nem linha | fix |
| 4 | P0 | PDF: pdf-generator.tsx usa template legado, não os modernos por setor | connect+refactor |
| 5 | P0 | PDF: templates modernos não atendem layout exato do brief | fix |
| 6 | P0 | PDF: falta adapter GradeRow → dados dos templates modernos | refactor |
| 7 | P1 | Campo facheta: ambiguidade ref vs descrição na UI | fix |
| 8 | P1 | Consolidado: 2 APIs duplicadas com contratos diferentes | refactor |
| 9 | P1 | Consolidado oficial ignora FACHETA por padrão | fix |
| 10 | P2 | Testes acoplados ao comportamento antigo | fix |

---

## TASK 1 — Tabela de Modelos + Modal + API (Rock-1 alignment)

### Objetivo
Alinhar `/configuracoes/modelos` com o brief Rock-1: tabela com 12 colunas em 6 grupos, modal com todos os campos, API aceitando refs e linha.

### Arquivos a modificar

| Arquivo | O que fazer |
|---------|-------------|
| `src/components/modelos/tabela-modelos.tsx` | Adicionar 5 colunas: ref cabedal, ref sola, ref palmilha, ref facheta, linha. Renomear "Descrição" → "Facheta (ref)". Reordenar coluna "Material Facheta" junto com ref. |
| `src/components/modelos/modal-edicao-modelo.tsx` | Adicionar campos: cabedal (ref), sola (ref), palmilha (ref), linha. Organizar em seções: "Identificação" (código, nome, linha) + "Referências" (cabedal, sola, palmilha, facheta) + "Materiais" (materialCabedal, materialSola, materialPalmilha, materialFacheta). |
| `src/app/api/configuracoes/modelos/route.ts` | POST: aceitar campos `cabedal`, `sola`, `palmilha`, `linha` no body e persistir no create. |
| `src/app/api/configuracoes/modelos/[id]/route.ts` | PATCH: aceitar campos `cabedal`, `sola`, `palmilha`, `linha` no body e persistir no update. |
| `src/app/configuracoes/modelos/page.tsx` | Se houver lógica de fetch/state para modelos, garantir que retorna todos os campos novos. |

### Subtasks detalhadas

**ST001 — Tabela: adicionar colunas de referência**

Estrutura esperada dos grupos (com bordas grossas entre eles):

```
| Base          | Cabedal           | Sola              | Palmilha           | Facheta              | Final                    |
| Código | Nome | Ref    | Material | Ref  | Material    | Ref      | Material | Ref    | Material     | Linha | Variantes | Ações |
```

- Cada grupo de componente tem 2 sub-colunas: `Ref` (campo do modelo: cabedal/sola/palmilha/facheta) e `Material` (materialCabedal/materialSola/materialPalmilha/materialFacheta)
- O grupo "Final" tem 3 colunas: `linha`, `variantes` ("N cores"), `ações`
- Aplicar `border-left: 2px solid` (ou equivalente Tailwind `border-l-2`) no primeiro `<th>/<td>` de cada grupo
- Valores vazios: exibir `—` (traço em dash, não vazio)

Onde mapear cada campo do modelo Prisma:

| Coluna na tabela | Campo Prisma `Modelo.*` |
|-----------------|------------------------|
| Base > Código | `codigo` |
| Base > Nome | `nome` |
| Cabedal > Ref | `cabedal` |
| Cabedal > Material | `materialCabedal` |
| Sola > Ref | `sola` |
| Sola > Material | `materialSola` |
| Palmilha > Ref | `palmilha` |
| Palmilha > Material | `materialPalmilha` |
| Facheta > Ref | `facheta` |
| Facheta > Material | `materialFacheta` |
| Final > Linha | `linha` |
| Final > Variantes | contagem de `variantesCor` |
| Final > Ações | botões editar/excluir |

**ST002 — Modal de edição: adicionar refs + linha**

Layout do modal (grid 2 colunas):

```
┌─────────────────────────────────┐
│ IDENTIFICAÇÃO                   │
│ Código*    │ Nome*              │
│ Linha      │ (vazio)            │
├─────────────────────────────────┤
│ REFERÊNCIAS POR COMPONENTE      │
│ Cabedal    │ Sola               │
│ Palmilha   │ Facheta            │
├─────────────────────────────────┤
│ MATERIAIS POR COMPONENTE        │
│ Mat. Cabedal │ Mat. Sola        │
│ Mat. Palmilha│ Mat. Facheta     │
└─────────────────────────────────┘
```

- Campo "Linha" é `<input>` de texto livre, maxLength 100
- Campos de referência são `<input>` de texto livre, maxLength 200
- Campos de material são `<input>` de texto livre, maxLength 200
- Todos opcionais (exceto código e nome)
- O campo "Facheta" (ref) quando preenchido indica que o modelo tem facheta → gera ficha FACHETA no PDF

**ST003 — API: PATCH e POST aceitam refs + linha**

Campos a adicionar no Zod schema (ou validação existente):

```typescript
// No POST /api/configuracoes/modelos
cabedal: z.string().max(200).optional(),
sola: z.string().max(200).optional(),
palmilha: z.string().max(200).optional(),
linha: z.string().max(100).optional(),

// No PATCH /api/configuracoes/modelos/[id]
// Mesmos campos acima
```

No `prisma.modelo.create/update`, incluir:
```typescript
data: {
  ...existingFields,
  cabedal: body.cabedal ?? null,
  sola: body.sola ?? null,
  palmilha: body.palmilha ?? null,
  linha: body.linha ?? null,
}
```

### Critérios de aceite (TASK 1)

- [ ] Tabela exibe 13 colunas em 6 grupos com bordas grossas entre grupos
- [ ] Cada grupo de componente mostra ref + material
- [ ] Grupo "Final" mostra linha, variantes, ações (sem "Descrição")
- [ ] Modal de edição tem 3 seções: Identificação, Referências, Materiais
- [ ] Modal de criação (Novo Modelo) também tem os campos novos
- [ ] API POST aceita e persiste cabedal, sola, palmilha, linha
- [ ] API PATCH aceita e persiste cabedal, sola, palmilha, linha
- [ ] Valores vazios exibem "—" na tabela
- [ ] Busca full-text inclui campos novos (linha, cabedal, sola, palmilha)

---

## TASK 2 — Conectar templates modernos ao pdf-generator.tsx

### Objetivo
Substituir o uso do template legado (FichaTemplate landscape) pelos templates modernos por setor (card-based, A4 portrait, 4 por página) na geração oficial de fichas.

### Contexto do problema

Existem dois sistemas de templates:
1. **Legado** (`src/lib/pdf/templates/ficha-template.tsx`): tabela landscape genérica. É o que `pdf-generator.tsx` usa hoje via `this.renderPdf()`.
2. **Moderno** (`src/components/pdf/templates/template-{setor}.tsx`): cards A4 portrait, 4 por página. Existe mas NÃO é usado pelo fluxo oficial.

O pdf-generator.tsx precisa passar a usar os templates modernos, roteando por setor.

### Arquivos a modificar

| Arquivo | O que fazer |
|---------|-------------|
| `src/lib/pdf/pdf-generator.tsx` | Refatorar `renderPdf()` para rotear por setor e usar templates modernos |
| `src/components/pdf/pdf-types.ts` | Verificar e ajustar tipos se necessário |
| `src/components/pdf/templates/template-cabedal.tsx` | Ajustar layout para brief (TASK 3) |
| `src/components/pdf/templates/template-sola.tsx` | Ajustar layout para brief (TASK 3) |
| `src/components/pdf/templates/template-palmilha.tsx` | Ajustar layout para brief (TASK 3) |
| `src/components/pdf/templates/template-facheta.tsx` | Ajustar layout para brief (TASK 3) |
| `src/components/pdf/page-layout.tsx` | Revisar se paginação 4-per-page está correta |

### Subtasks detalhadas

**ST001 — Criar função adapter: GradeRow[] → dados para templates modernos**

O pipeline atual (`montarGradesConsolidadas`) retorna `GradeRow[]`. Os templates modernos esperam `PedidoData` + `ItemData[]`. Criar um adapter:

```typescript
// src/lib/pdf/grade-to-item-adapter.ts

import type { GradeRow } from '@/types'
import type { PedidoData, ItemData } from '@/components/pdf/pdf-types'

interface AdapterInput {
  numeroPedido: string
  dataEmissao: Date
  grades: GradeRow[]
}

export function gradeRowsToItemData(input: AdapterInput): {
  pedido: PedidoData
  items: ItemData[]
} {
  const pedido: PedidoData = {
    numero: input.numeroPedido,
    data: input.dataEmissao,
  }

  const items: ItemData[] = input.grades.map((g) => ({
    sku: g.modelo, // código do modelo como identificador
    modelo: {
      codigo: g.modelo,
      materialCabedal: g.materialCabedal,
      materialSola: g.materialSola,
      materialPalmilha: g.materialPalmilha,
      materialFacheta: g.materialFacheta,
      facheta: g.modeloFacheta,
      // Refs do modelo
      cabedal: g.modeloCabedal,
      sola: g.modeloSola,
      palmilha: g.modeloPalmilha,
    },
    variante: {
      corPrincipal: g.corDescricao ?? g.cor,
      corCodigo: g.cor,
      corCabedal: g.corCabedal,
      corSola: g.corSola,
      corPalmilha: g.corPalmilha,
      corFacheta: g.corFacheta,
      imagemBase64: g.imagemBase64, // já convertido pelo pdf-generator
    },
    quantidades: Object.fromEntries(
      Object.entries(g.tamanhos).map(([k, v]) => [Number(k), v])
    ),
    tamanhos: Object.keys(g.tamanhos).map(Number).sort((a, b) => a - b),
  }))

  return { pedido, items }
}
```

**IMPORTANTE:** `ModeloData` em `pdf-types.ts` precisa ser expandido para incluir os campos de referência:

```typescript
export interface ModeloData {
  codigo?: string
  // Refs
  cabedal?: string
  sola?: string
  palmilha?: string
  // Materiais
  materialCabedal?: string
  materialSola?: string
  materialPalmilha?: string
  materialFacheta?: string
  facheta?: string
}
```

E `VarianteData` precisa de `imagemBase64` e `corCodigo`:

```typescript
export interface VarianteData {
  corPrincipal: string
  corCodigo?: string
  corCabedal?: string
  corSola?: string
  corPalmilha?: string
  corFacheta?: string
  imagemBase64?: string
}
```

**ST002 — Refatorar renderPdf() no pdf-generator.tsx**

Substituir o método `renderPdf()` atual (que importa FichaTemplate) por roteamento por setor:

```typescript
private async renderPdf(
  setor: Setor,
  pedido: PedidoData,
  items: ItemData[],
): Promise<Buffer> {
  const { renderToBuffer } = await import('@react-pdf/renderer')

  // Importar template por setor
  let TemplateComponent: React.ComponentType<any>
  switch (setor) {
    case Setor.CABEDAL:
      TemplateComponent = (await import('@/components/pdf/templates/template-cabedal')).TemplateCabedal
      break
    case Setor.SOLA:
      TemplateComponent = (await import('@/components/pdf/templates/template-sola')).TemplateSola
      break
    case Setor.PALMILHA:
      TemplateComponent = (await import('@/components/pdf/templates/template-palmilha')).TemplatePalmilha
      break
    case Setor.FACHETA:
      TemplateComponent = (await import('@/components/pdf/templates/template-facheta')).TemplateFacheta
      break
  }

  // Montar props e renderizar
  const REACT_ELEMENT_TYPE = Symbol.for('react.element')
  const element = {
    '$$typeof': REACT_ELEMENT_TYPE,
    type: TemplateComponent,
    key: null,
    ref: null,
    props: { pedido, items },
  }
  return renderToBuffer(element as any)
}
```

**ST003 — Atualizar chamadas no gerarFichas()**

No loop de `setoresFiltrados.map()`, substituir:

```typescript
// ANTES:
const pdfBuffer = await this.renderPdf({
  numeroPedido: pedido.numero,
  dataEmissao: pedido.dataEmissao,
  fornecedor: pedido.fornecedorNome,
  setor,
  grades: gradesComImagem,
  totalPares,
  camposExtras,
  geradoEm: new Date(),
})

// DEPOIS:
const { pedido: pedidoData, items } = gradeRowsToItemData({
  numeroPedido: pedido.numero,
  dataEmissao: pedido.dataEmissao,
  grades: gradesComImagem,
})
const pdfBuffer = await this.renderPdf(setor, pedidoData, items)
```

**ST004 — Atualizar gerarFichasConsolidadas() da mesma forma**

Aplicar a mesma refatoração no método `gerarFichasConsolidadas()`, usando o adapter e os templates modernos.

**ST005 — Remover (ou deprecar) dependência do template legado**

- `src/lib/pdf/templates/ficha-template.tsx` pode ser mantido como backup mas NÃO deve ser importado por nenhum código ativo
- `src/lib/pdf/templates/shared-styles.ts` idem (usado apenas pelo legado)
- Garantir que nenhum `import` ativo referencia esses arquivos

### Critérios de aceite (TASK 2)

- [ ] `renderPdf()` roteia por setor usando templates modernos
- [ ] Adapter `gradeRowsToItemData` converte GradeRow[] corretamente
- [ ] Geração individual (`gerarFichas`) usa templates modernos
- [ ] Geração consolidada (`gerarFichasConsolidadas`) usa templates modernos
- [ ] PDFs gerados são A4 portrait com 4 cards por página
- [ ] Template legado não é mais importado por código ativo
- [ ] Build compila sem erros de tipo

---

## TASK 3 — Ajustar conteúdo dos templates PDF para o brief

### Objetivo
Garantir que cada template renderiza EXATAMENTE os campos especificados no brief Rock-2.

### Layout esperado por setor (do brief)

#### Ficha CABEDAL
```
┌──────────────────────────────────────────────────────┐
│ FICHA DE PRODUÇÃO - CABEDAL                          │
├──────────────┬───────────────┬────────────────────────┤
│ Pedido: XXX  │ Data: DD/MM   │ [IMAGEM VARIANTE]     │
│ Setor: CAB   │               │ (ou vazio se ausente)  │
├──────────────┬───────────────┬────────────────────────┤
│ REF Cabedal  │ Cor Cabedal   │ Material Cabedal       │
│ REF Sola     │ REF Palmilha  │                        │
│ Cor Sola     │ Cor Palmilha  │                        │
├──────────────┴───────────────┴────────────────────────┤
│ |28|29|30|31|32|33|34|35|36|37|38|39|  ← header preto│
│ | 2|  |  | 1| 3|  |  |  | 2|  |  |  |  ← body branco│
│                                    Total: XX pares    │
└──────────────────────────────────────────────────────┘
```

Dados e suas fontes:
- `Pedido: XXX` → `PedidoData.numero`
- `Data: DD/MM` → `PedidoData.data` formatado
- `IMAGEM` → `VarianteData.imagemBase64`
- `REF Cabedal` → `ModeloData.cabedal` (campo Modelo.cabedal)
- `REF Sola` → `ModeloData.sola`
- `REF Palmilha` → `ModeloData.palmilha`
- `Cor Cabedal` → `VarianteData.corCabedal` (ModeloVarianteCor.corCabedal)
- `Cor Sola` → `VarianteData.corSola`
- `Cor Palmilha` → `VarianteData.corPalmilha`
- `Material Cabedal` → `ModeloData.materialCabedal`
- Grade → `ItemData.quantidades` + `ItemData.tamanhos`

#### Ficha FACHETA (condicional: só se ModeloData.facheta preenchido)
```
┌──────────────────────────────────────────────────────┐
│ FICHA DE PRODUÇÃO - FACHETA                          │
├────────────────────────┬─────────────────────────────┤
│ Pedido: XXX            │ Data: DD/MM                 │
│ Setor: FACHETA         │                             │
├──────────────┬─────────┴───────┬──────────────────────┤
│ REF Facheta  │ Cor Facheta     │ Material Facheta     │
│ REF Sola     │                 │                      │
│ Cor Sola     │                 │                      │
├──────────────┴─────────────────┴──────────────────────┤
│ Grade de numeração (igual)                            │
└──────────────────────────────────────────────────────┘
```

- SEM imagem (bloco de identificação tem 2 colunas, não 3)
- `REF Facheta` → `ModeloData.facheta`
- `Cor Facheta` → `VarianteData.corFacheta`
- `Material Facheta` → `ModeloData.materialFacheta`
- `REF Sola` + `Cor Sola` → repetidos do modelo

#### Ficha PALMILHA
```
┌──────────────────────────────────────────────────────┐
│ FICHA DE PRODUÇÃO - PALMILHA                         │
├────────────────────────┬─────────────────────────────┤
│ Pedido: XXX            │ Data: DD/MM                 │
├──────────────┬─────────┴───────┬──────────────────────┤
│ REF Palmilha │ Cor Palmilha    │ Material Palmilha    │
├──────────────┴─────────────────┴──────────────────────┤
│ Grade de numeração                                    │
└──────────────────────────────────────────────────────┘
```

- `REF Palmilha` → `ModeloData.palmilha`
- `Cor Palmilha` → `VarianteData.corPalmilha`
- `Material Palmilha` → `ModeloData.materialPalmilha`

#### Ficha SOLA (idêntica à Palmilha, trocando refs)
```
┌──────────────────────────────────────────────────────┐
│ FICHA DE PRODUÇÃO - SOLA                             │
├────────────────────────┬─────────────────────────────┤
│ Pedido: XXX            │ Data: DD/MM                 │
├──────────────┬─────────┴───────┬──────────────────────┤
│ REF Sola     │ Cor Sola        │ Material Sola        │
├──────────────┴─────────────────┴──────────────────────┤
│ Grade de numeração                                    │
└──────────────────────────────────────────────────────┘
```

### Arquivos a modificar

| Arquivo | O que fazer |
|---------|-------------|
| `src/components/pdf/templates/template-cabedal.tsx` | Reescrever bloco de specs: 3 colunas com REFs, cores e material conforme brief |
| `src/components/pdf/templates/template-facheta.tsx` | Reescrever: 2 cols identificação (sem imagem), 3 cols specs com REF facheta/sola |
| `src/components/pdf/templates/template-palmilha.tsx` | Reescrever: 2 cols id, 3 cols specs (REF palmilha, cor palmilha, material palmilha) |
| `src/components/pdf/templates/template-sola.tsx` | Reescrever: 2 cols id, 3 cols specs (REF sola, cor sola, material sola) |
| `src/components/pdf/pdf-types.ts` | Expandir ModeloData com refs (cabedal, sola, palmilha) |
| `src/components/pdf/grade-numeracao.tsx` | Revisar: header preto/branco, body branco/preto conforme brief |

### Subtasks

**ST001** — Expandir `ModeloData` e `VarianteData` em pdf-types.ts (se não feito na TASK 2)

**ST002** — Reescrever `template-cabedal.tsx`:
- Bloco identificação: 3 colunas (pedido+setor | data | imagem)
- Bloco especificações: 3 colunas conforme layout acima
- Todos os campos com fallback para `—` se vazio
- Imagem: se `imagemBase64` disponível, renderizar; senão espaço vazio

**ST003** — Reescrever `template-facheta.tsx`:
- Bloco identificação: 2 colunas (SEM imagem)
- Bloco especificações: REF facheta + sola/cor sola | cor facheta | material facheta
- Filtro: NÃO renderizar card se `item.modelo.facheta` é nulo/vazio

**ST004** — Reescrever `template-palmilha.tsx`:
- Bloco identificação: 2 colunas
- Bloco especificações: REF palmilha | cor palmilha | material palmilha

**ST005** — Reescrever `template-sola.tsx`:
- Bloco identificação: 2 colunas
- Bloco especificações: REF sola | cor sola | material sola

**ST006** — Verificar `grade-numeracao.tsx`: header fundo preto texto branco, body fundo branco texto preto

### Critérios de aceite (TASK 3)

- [ ] Cada template renderiza EXATAMENTE os campos do brief (REFs, cores, materiais)
- [ ] CABEDAL é o único template com imagem (3 cols no bloco id)
- [ ] FACHETA renderiza somente para modelos com facheta preenchido
- [ ] PALMILHA e SOLA mostram 3 campos: ref, cor, material do componente
- [ ] Grade de numeração: header preto/branco, body branco/preto
- [ ] Campos ausentes exibem "—" (não quebram o layout)
- [ ] 4 cards por página A4 portrait, margens 10mm, gaps 2mm

---

## TASK 4 — Consolidado: unificar APIs e incluir FACHETA

### Objetivo
Eliminar a duplicação de APIs de consolidação e garantir que FACHETA é tratado corretamente.

### Problema atual
- `POST /api/fichas/consolidar` (oficial, usa pdf-generator.tsx, persiste FichaProducao) — ignora FACHETA
- `POST /api/consolidar` (alternativo, usa render-consolidado.tsx, retorna base64 sem persistir) — usa templates modernos mas não persiste
- Dois caminhos divergentes para o mesmo recurso

### Arquivos a modificar

| Arquivo | O que fazer |
|---------|-------------|
| `src/lib/pdf/pdf-generator.tsx` | No `gerarFichasConsolidadas`: incluir FACHETA no array de setores padrão (condicional: se algum modelo tem facheta) |
| `src/app/api/fichas/consolidar/route.ts` | Aceitar setores opcionais no body (como `/api/fichas/gerar` já faz) |
| `src/app/api/consolidar/route.ts` | Deprecar ou redirecionar para `/api/fichas/consolidar` |
| `src/lib/pdf/render-consolidado.tsx` | Avaliar se ainda é necessário após unificação |
| `src/components/pedidos/consolidado-page.tsx` | Usar API oficial `/api/fichas/consolidar` em vez de `/api/consolidar` |
| `src/lib/validators.ts` | Schema de consolidação: aceitar array de setores |

### Subtasks

**ST001** — `gerarFichasConsolidadas`: lógica FACHETA condicional
```typescript
// Detectar se algum modelo dos pedidos tem facheta preenchida
const setores = [Setor.CABEDAL, Setor.PALMILHA, Setor.SOLA]
const codigosModelo = [...new Set(pedidos.flatMap(p => p.itens.map(i => i.modelo).filter(Boolean)))]
if (codigosModelo.length > 0) {
  const modelosComFacheta = await prisma.modelo.count({
    where: { codigo: { in: codigosModelo }, facheta: { not: null } },
  })
  if (modelosComFacheta > 0) setores.push(Setor.FACHETA)
}
```

**ST002** — Unificar API de consolidação:
- `/api/fichas/consolidar` aceita `{ pedidoIds: string[], setores?: Setor[] }`
- Deprecar `/api/consolidar` (manter redirect ou remover)
- `consolidado-page.tsx` chama a API oficial

**ST003** — Remover `render-consolidado.tsx` se não for mais necessário após unificação

### Critérios de aceite (TASK 4)

- [ ] Consolidado gera FACHETA quando algum modelo tem facheta preenchida
- [ ] Existe uma única API de consolidação (sem duplicação)
- [ ] Consolidado usa os mesmos templates modernos que fichas individuais
- [ ] Consolidado persiste FichaProducao no banco (como fichas individuais)

---

## TASK 5 — Atualizar testes

### Objetivo
Alinhar testes com o novo comportamento (templates modernos, 4 setores, refs).

### Arquivos a modificar

| Arquivo | O que fazer |
|---------|-------------|
| `src/lib/pdf/__tests__/pdf-generator.test.ts` | Atualizar mocks para templates modernos; testar 4 setores; testar adapter |
| `src/lib/pdf/__tests__/render-consolidado.test.ts` | Remover ou adaptar (se render-consolidado foi removido) |
| `e2e/fichas-v2-geracao.spec.ts` | Verificar se testa 4 setores e layout correto |
| `src/components/pedidos/__tests__/popover-acao.test.ts` | Manter (já cobre variantes) |

### Subtasks

**ST001** — `pdf-generator.test.ts`:
- Mock dos templates modernos (TemplateCabedal, TemplateSola, etc.) em vez de FichaTemplate
- Teste: "deve gerar 4 fichas quando modelo tem facheta"
- Teste: "deve gerar 3 fichas quando nenhum modelo tem facheta"
- Teste: adapter `gradeRowsToItemData` converte corretamente

**ST002** — Testes do consolidado:
- Se render-consolidado.tsx foi removido: remover seu teste
- Teste da API unificada `/api/fichas/consolidar` com FACHETA

**ST003** — E2E:
- Verificar que fichas-v2-geracao.spec.ts já cobre o fluxo correto
- Adicionar caso de teste para FACHETA condicional se ausente

### Critérios de aceite (TASK 5)

- [ ] Todos os testes unitários passam
- [ ] Cobertura de 4 setores (não apenas 3)
- [ ] Adapter testado com dados completos e com campos vazios
- [ ] Nenhum teste referencia o template legado

---

## TASK 6 — Revisão final (PROMPT DE VERIFICAÇÃO)

### Objetivo
Verificar sistematicamente TODOS os pontos de integração entre a implementação e o brief.

### Bloco A — Tabela de Modelos (/configuracoes/modelos)

- [ ] A1: Tabela exibe 13 colunas em 6 grupos (Base, Cabedal, Sola, Palmilha, Facheta, Final)
- [ ] A2: Cada grupo de componente tem 2 sub-colunas (Ref + Material)
- [ ] A3: Grupo Final tem: Linha, Variantes ("N cores"), Ações
- [ ] A4: Bordas grossas visíveis entre grupos
- [ ] A5: Coluna "Descrição" NÃO existe mais (removida/renomeada)
- [ ] A6: Valores vazios exibem "—"
- [ ] A7: Busca funciona com campos novos (linha, cabedal, sola, palmilha)

### Bloco B — Modal de Edição/Criação

- [ ] B1: Modal tem 3 seções: Identificação, Referências, Materiais
- [ ] B2: Campo "Linha" está na seção Identificação
- [ ] B3: Campos Cabedal/Sola/Palmilha/Facheta (refs) estão na seção Referências
- [ ] B4: Campos Material Cabedal/Sola/Palmilha/Facheta estão na seção Materiais
- [ ] B5: Criar modelo com todos os campos funciona (POST)
- [ ] B6: Editar modelo com todos os campos funciona (PATCH)
- [ ] B7: Campos opcionais podem ser salvos como vazio

### Bloco C — PDF Templates (renderização)

- [ ] C1: CABEDAL tem imagem no bloco de identificação (3 colunas)
- [ ] C2: CABEDAL specs: REF cabedal + sola/cor sola | cor cabedal + palmilha/cor palmilha | material cabedal
- [ ] C3: FACHETA NÃO tem imagem (2 colunas no bloco id)
- [ ] C4: FACHETA specs: REF facheta + sola/cor sola | cor facheta | material facheta
- [ ] C5: FACHETA só é renderizada quando Modelo.facheta é preenchido
- [ ] C6: PALMILHA specs: REF palmilha | cor palmilha | material palmilha
- [ ] C7: SOLA specs: REF sola | cor sola | material sola
- [ ] C8: Grade: header preto/branco, body branco/preto
- [ ] C9: 4 cards por página A4 portrait, margens 10mm
- [ ] C10: Campos ausentes exibem "—" (não quebram layout)
- [ ] C11: Imagem ausente no CABEDAL não bloqueia geração

### Bloco D — Conexão pdf-generator → templates

- [ ] D1: `renderPdf()` usa templates modernos (NÃO o FichaTemplate legado)
- [ ] D2: Adapter `gradeRowsToItemData` mapeia TODOS os campos corretamente
- [ ] D3: `gerarFichas()` gera 1 PDF por setor selecionado
- [ ] D4: `gerarFichasConsolidadas()` gera 1 PDF por setor
- [ ] D5: Consolidado inclui FACHETA quando aplicável
- [ ] D6: Template legado não é importado por nenhum código ativo

### Bloco E — API

- [ ] E1: POST /api/configuracoes/modelos aceita refs + linha
- [ ] E2: PATCH /api/configuracoes/modelos/[id] aceita refs + linha
- [ ] E3: POST /api/fichas/gerar retorna { data: { fichas }, avisos }
- [ ] E4: POST /api/fichas/consolidar aceita setores opcionais
- [ ] E5: Não existe API duplicada de consolidação

### Bloco F — Tipos

- [ ] F1: `ModeloData` (pdf-types.ts) inclui refs: cabedal, sola, palmilha
- [ ] F2: `VarianteData` inclui imagemBase64 e corCodigo
- [ ] F3: `GradeRow` (types/index.ts) continua tendo TODOS os campos
- [ ] F4: Nenhum `any` introduzido nos tipos novos

### Bloco G — Testes

- [ ] G1: pdf-generator.test.ts passa com templates modernos
- [ ] G2: Teste de 4 setores (incluindo FACHETA condicional)
- [ ] G3: Teste do adapter com dados completos e com campos vazios
- [ ] G4: Build compila sem erros (`npx tsc --noEmit`)

---

## Ordem de execução

```
TASK 1 (tabela + modal + API)
  ↓
TASK 2 (conectar templates modernos ao pdf-generator)
  ↓
TASK 3 (ajustar conteúdo dos templates PDF)
  ↓
TASK 4 (consolidado: unificar + FACHETA)
  ↓
TASK 5 (testes)
  ↓
TASK 6 (revisão final — 34 pontos de verificação)
```

Cada task só deve ser iniciada após a anterior estar completa e sem erros de compilação.
