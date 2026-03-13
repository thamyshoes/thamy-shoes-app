# TASKLIST — Hardening do Fluxo Bling → Fichas de Produção

**Objetivo:** Garantir que o sistema identifique corretamente a variante de cor de cada sandália importada do Bling e renderize a imagem correta na ficha de CABEDAL. Eliminar falhas silenciosas e tornar o fluxo confiável para uso em produção.

**Contexto:** A análise MCP Codex identificou 7 gaps. Esta tasklist os resolve em ordem de severidade.

---

## TASK-01 — Corrigir seed: regra SKU padrão deve ser SUFIXO 2+3

**Arquivo:** `prisma/seed.ts`

### Por que
O seed atual cria como regra ativa uma regra no modo `SEPARADOR` (split por `-`). O INTAKE especifica que o formato real dos SKUs do Bling é posicional de sufixo: `tamanho=2 últimos dígitos, cor=3 anteriores, modelo=restante`. Se o banco de um ambiente novo for seedado sem intervenção manual, o `parseSku` retornará `null` para todos os campos e nenhuma ficha terá imagem.

### O que mudar

Em `prisma/seed.ts`, encontre o bloco `if (regraSKUCount === 0)` (~linha 184) que faz `createMany` com duas regras. Substitua o conteúdo do `data` para:

```ts
data: [
  {
    nome: 'Sufixo Padrão (Bling)',
    modo: 'SUFIXO',
    separador: '',
    ordem: ['modelo', 'cor', 'tamanho'],
    digitosSufixo: [
      { campo: 'tamanho', digitos: 2 },
      { campo: 'cor', digitos: 3 },
    ],
    ativa: true,
  },
  {
    nome: 'Separador Legado',
    modo: 'SEPARADOR',
    separador: '-',
    ordem: ['modelo', 'cor', 'tamanho'],
    segmentos: { modelo: { posicao: 0 }, cor: { posicao: 1 }, tamanho: { posicao: 2 } },
    ativa: false,
  },
],
```

> **Atenção:** `digitosSufixo` é um campo JSON do Prisma. O seed existente já usa Prisma diretamente — o valor passado será serializado automaticamente. Não há necessidade de usar `Prisma.JsonNull`.

### Validação
Após editar, execute:
```bash
npx tsx prisma/seed.ts
```
Verifique no banco que existe uma `RegraSkU` com `ativa=true`, `modo='SUFIXO'` e `digitosSufixo=[{campo:'tamanho',digitos:2},{campo:'cor',digitos:3}]`.

Teste manual: chame `parseSku('1611600128')` (via teste ou via seed de teste) e verifique que retorna `{ modelo: '16116', cor: '001', tamanho: '28', status: 'RESOLVIDO' }`.

### Erros comuns a evitar
- Não alterar o seed para `createMany` usando objetos aninhados sem verificar que o campo `digitosSufixo` no schema Prisma é `Json` — ele aceita arrays diretamente.
- Não manter `ativa: true` em mais de uma regra simultaneamente.
- Não esquecer o `console.log` de confirmação após o bloco alterado.

---

## TASK-02 — Invalidar cache da regra SKU ao editar ou criar regra

**Arquivos:**
- `src/app/api/configuracoes/regras-sku/[id]/route.ts` (PATCH)
- `src/app/api/configuracoes/regras-sku/route.ts` (POST)

### Por que
O `sku-parser.ts` mantém um cache em memória da regra ativa (`cachedRegra`). Atualmente, `invalidarCacheRegra()` só é chamado na rota `/ativar`. Isso significa:
- Se o admin **edita** a regra ativa (ex: muda `digitosSufixo`), o cache antigo continua sendo usado até o próximo restart do servidor ou até alguém chamar "ativar" novamente.
- Se o admin **cria** uma nova regra e a ativa via UI em dois passos (create → ativar), a sequência funciona. Mas se criar já marcando `ativa: true` diretamente via API, o cache não é invalidado.

### O que mudar

**Em `src/app/api/configuracoes/regras-sku/[id]/route.ts`:**

1. Adicione o import no topo do arquivo:
```ts
import { invalidarCacheRegra } from '@/lib/bling/sku-parser'
```

2. No handler `PATCH`, logo após o `await prisma.regraSkU.update(...)` e antes do `return NextResponse.json(regra)`, adicione:
```ts
invalidarCacheRegra()
```

O bloco final do PATCH deve ficar:
```ts
const regra = await prisma.regraSkU.update({ ... })
invalidarCacheRegra()
return NextResponse.json(regra)
```

**Em `src/app/api/configuracoes/regras-sku/route.ts`:**

1. Adicione o import no topo do arquivo:
```ts
import { invalidarCacheRegra } from '@/lib/bling/sku-parser'
```

2. No handler `POST`, logo após o `await prisma.regraSkU.create(...)` e antes do `return NextResponse.json(regra, { status: 201 })`, adicione:
```ts
invalidarCacheRegra()
```

### Validação
- Execute `npx tsc --noEmit` após as alterações — deve retornar zero erros.
- Confirme que o import `invalidarCacheRegra` está presente e que a função é chamada em exatamente 3 lugares: `ativar/route.ts`, `[id]/route.ts` (PATCH) e `route.ts` (POST).

### Erros comuns a evitar
- Não adicionar `invalidarCacheRegra()` dentro do bloco `try/catch` de forma que um erro silencioso deixe o cache sujo — a chamada deve estar **após** o await bem-sucedido, antes do return.
- O `invalidarCacheRegra()` é síncrono (apenas seta `cachedRegra = undefined`), não retorna Promise — não use `await`.

---

## TASK-03 — Melhorar verificar-variantes: validar cor específica do pedido

**Arquivo:** `src/app/api/modelos/verificar-variantes/route.ts`

### Por que
A validação atual pergunta: "cada modelo tem pelo menos 1 variante?" Mas o que importa é: "cada par `(modelo, cor)` que existe nos itens do pedido tem uma variante cadastrada com esse `corCodigo` exato?" Um modelo pode ter 5 variantes e ainda assim falhar se a cor do pedido for `003` e só existirem variantes `001`, `002`.

### O que mudar

Substitua o conteúdo completo do arquivo `src/app/api/modelos/verificar-variantes/route.ts` pelo seguinte:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface ModeloSemVariante {
  codigo: string
  nome: string
}

interface CorSemVariante {
  codigo: string
  nome: string
  cor: string
}

// GET /api/modelos/verificar-variantes?pedidoId={id}
// Retorna:
// - modelosSemVariante: modelos sem nenhuma variante cadastrada
// - coresSemVariante: pares (modelo, cor) do pedido sem variante correspondente
// - todosComVariante: true somente se ambas as listas estiverem vazias
export async function GET(req: NextRequest) {
  const pedidoId = req.nextUrl.searchParams.get('pedidoId')
  if (!pedidoId) {
    return NextResponse.json({ error: 'pedidoId é obrigatório' }, { status: 400 })
  }

  // Buscar pares (modelo, cor) distintos dos itens do pedido com status RESOLVIDO
  const itens = await prisma.itemPedido.findMany({
    where: { pedidoId },
    select: { modelo: true, cor: true },
  })

  const codigosModelo = [...new Set(
    itens.map((i) => i.modelo).filter((m): m is string => !!m)
  )]

  if (codigosModelo.length === 0) {
    // Pedido sem modelos identificados — não bloquear
    return NextResponse.json({
      todosComVariante: true,
      modelosSemVariante: [],
      coresSemVariante: [],
    })
  }

  // Buscar modelos com suas variantes de cor
  const modelos = await prisma.modelo.findMany({
    where: { codigo: { in: codigosModelo } },
    select: {
      codigo: true,
      nome: true,
      variantesCor: { select: { corCodigo: true } },
    },
  })

  const modeloMapa = new Map(modelos.map((m) => [m.codigo, m]))

  // 1. Modelos sem nenhuma variante cadastrada
  const modelosComCadastroSemVariante: ModeloSemVariante[] = modelos
    .filter((m) => m.variantesCor.length === 0)
    .map((m) => ({ codigo: m.codigo, nome: m.nome }))

  // 2. Modelos sem cadastro algum (tratamos como sem variante)
  const codigosComCadastro = new Set(modelos.map((m) => m.codigo))
  const semCadastro: ModeloSemVariante[] = codigosModelo
    .filter((c) => !codigosComCadastro.has(c))
    .map((c) => ({ codigo: c, nome: 'Não cadastrado' }))

  const modelosSemVariante: ModeloSemVariante[] = [...modelosComCadastroSemVariante, ...semCadastro]

  // 3. Pares (modelo, cor) do pedido sem variante correspondente
  // Considerar apenas itens que têm AMBOS modelo e cor preenchidos
  const paresUnicos = new Map<string, { modelo: string; cor: string }>()
  for (const item of itens) {
    if (item.modelo && item.cor) {
      paresUnicos.set(`${item.modelo}__${item.cor}`, { modelo: item.modelo, cor: item.cor })
    }
  }

  const coresSemVariante: CorSemVariante[] = []
  for (const { modelo, cor } of paresUnicos.values()) {
    const modeloInfo = modeloMapa.get(modelo)
    if (!modeloInfo) continue // já está em modelosSemVariante
    const temVarianteCor = modeloInfo.variantesCor.some((v) => v.corCodigo === cor)
    if (!temVarianteCor) {
      coresSemVariante.push({ codigo: modelo, nome: modeloInfo.nome, cor })
    }
  }

  return NextResponse.json({
    todosComVariante: modelosSemVariante.length === 0 && coresSemVariante.length === 0,
    modelosSemVariante,
    coresSemVariante,
  })
}
```

### Validação
- `npx tsc --noEmit` — zero erros.
- Teste manual: crie um pedido com item `modelo='16116', cor='001'`. Se o modelo `16116` tiver variante com `corCodigo='001'`, `todosComVariante=true`. Se não tiver, `coresSemVariante=[{codigo:'16116', nome:'...', cor:'001'}]`.

### Erros comuns a evitar
- Não filtrar por `status: StatusItem.RESOLVIDO` na query dos itens — a verificação deve cobrir todos os itens (inclusive PENDENTE), pois o usuário pode estar verificando antes de resolver todos. O bloqueio do botão por itens pendentes é feito em outra camada (pdf-generator).
- Não incluir pares onde `cor` é null — um item sem cor extraída não pode ter variante verificada.
- Garantir que `coresSemVariante` não duplique entradas de `modelosSemVariante` (o `continue` acima garante isso).

---

## TASK-04 — Atualizar hook e UI do botão para exibir coresSemVariante

**Arquivos:**
- `src/hooks/use-verificar-variantes.ts`
- `src/components/pedidos/popover-acao.tsx` (leia antes de editar)
- `src/components/pedidos/botao-gerar-fichas.tsx`

### Por que
A API agora retorna `coresSemVariante` além de `modelosSemVariante`. O hook e o componente de popover/botão precisam consumir esse novo campo para mostrar ao usuário exatamente quais cores estão faltando, com link direto para cadastrar a variante.

### O que mudar

**Em `src/hooks/use-verificar-variantes.ts`:**

1. Adicione a interface `CorSemVariante`:
```ts
interface CorSemVariante {
  codigo: string
  nome: string
  cor: string
}
```

2. Atualize `VerificarVariantesResult` para incluir o novo campo:
```ts
interface VerificarVariantesResult {
  todosComVariante: boolean
  modelosSemVariante: ModeloSemVariante[]
  coresSemVariante: CorSemVariante[]
}
```

**Em `src/components/pedidos/popover-acao.tsx`:**

Leia o arquivo antes de editar. O objetivo é exibir também `coresSemVariante`. Adicione a prop `coresSemVariante` ao componente. Para cada item em `coresSemVariante`, exiba uma linha com mensagem como: `"Modelo 16116 — sem variante para cor 001"` com link para `/configuracoes/modelos?search=16116`.

Siga o padrão visual já existente para `modelosSemVariante`.

**Em `src/components/pedidos/botao-gerar-fichas.tsx`:**

Passe `coresSemVariante={verificacao.coresSemVariante}` para `<PopoverAcao>`.

Atualize também a condição `disabled`: manter como `!verificacao?.todosComVariante` (já está correto, pois `todosComVariante` agora considera ambas as listas).

### Validação
- `npx tsc --noEmit` — zero erros.
- Abra a página de um pedido importado onde o modelo tem variantes mas não tem a cor específica dos itens. O botão "Gerar fichas" deve estar desabilitado e o popover deve listar a cor ausente com link para o modelo.

### Erros comuns a evitar
- Não esquecer de propagar `coresSemVariante` do hook para o componente — o TypeScript vai acusar se a prop for adicionada à interface do `PopoverAcao` mas não passada em `BotaoGerarFichas`.
- Leia `popover-acao.tsx` completamente antes de editar — ele pode ter lógica de estilo que deve ser mantida consistente.
- Não alterar o tipo de `ModeloSemVariante` existente — apenas adicionar `CorSemVariante` ao lado.

---

## TASK-05 — Bloquear RESOLVIDO quando tamanho não é numérico válido

**Arquivo:** `src/lib/bling/sku-parser.ts`

### Por que
Na função `interpretarItens` (~linha 152), o código faz:
```ts
tamanho: r.tamanho ? parseInt(r.tamanho, 10) || null : null,
```
Se `r.tamanho` for uma string não-numérica como `'AB'`, `parseInt('AB', 10)` retorna `NaN`. O operador `||` converte `NaN` para `null` (correto). Mas o `status` já foi definido como `RESOLVIDO` no `parseSku` (que não valida se tamanho é numérico), então o item fica com `status=RESOLVIDO` e `tamanho=null` no banco — um estado incoerente. Isso faz o item aparecer como resolvido, mas `montarGradesConsolidadas` filtra por `status: RESOLVIDO` e tenta usar o tamanho, podendo gerar grades com zeros.

### O que mudar

Em `src/lib/bling/sku-parser.ts`, na função `interpretarItens`, localize o bloco `data:` do `prisma.itemPedido.update`:

```ts
data: {
  modelo: r.modelo,
  cor: r.cor,
  corDescricao: corDescricao || null,
  tamanho: r.tamanho ? parseInt(r.tamanho, 10) || null : null,
  status: r.status,
  produtoId,
},
```

Substitua por:

```ts
const tamanhoNumerico = r.tamanho ? parseInt(r.tamanho, 10) : null
const tamanhoValido = tamanhoNumerico !== null && !isNaN(tamanhoNumerico)
const statusFinal = r.status === StatusItem.RESOLVIDO && !tamanhoValido
  ? StatusItem.PENDENTE
  : r.status

data: {
  modelo: r.modelo,
  cor: r.cor,
  corDescricao: corDescricao || null,
  tamanho: tamanhoValido ? tamanhoNumerico : null,
  status: statusFinal,
  produtoId,
},
```

Também atualize a condição de push para `interpretados` logo abaixo:

```ts
if (statusFinal === StatusItem.RESOLVIDO && r.modelo && r.cor && r.tamanho) {
```

> Mude `r.status` para `statusFinal` nessa linha de condição.

### Validação
- `npx tsc --noEmit` — zero erros.
- Teste unitário mental: SKU onde o sufixo de 2 dígitos é `'AB'` deve resultar em `status=PENDENTE` e `tamanho=null`, não `RESOLVIDO` com `tamanho=null`.

### Erros comuns a evitar
- A variável `tamanhoNumerico` e `statusFinal` devem ser declaradas **fora** do objeto `data`, não inline — o objeto `data` do Prisma não suporta declarações de variável inline.
- Não alterar a lógica para casos válidos: `'28'` → `parseInt = 28`, `!isNaN(28) = true`, `statusFinal = r.status`. Comportamento normal preservado.
- Garantir que `statusFinal` é usado tanto no `data.status` quanto na condição do `if` do `interpretados.push`.

---

## TASK-06 — Avisar usuário quando CABEDAL gera sem imagem de variante

**Arquivo:** `src/lib/pdf/pdf-generator.tsx`

### Por que
Atualmente, quando `montarGradesConsolidadas` não encontra variante para um par `(modelo, cor)`, `grade.imagemUrl` fica `undefined`. O `imageUrlToBase64` recebe `null/undefined` e retorna `null`. O PDF do CABEDAL renderiza `—` no lugar da imagem (linha 192 do template). Nenhum erro é lançado e o usuário não sabe que o PDF está incompleto.

O comportamento correto é: gerar o PDF mesmo assim (não bloquear), mas avisar claramente quais grades ficaram sem imagem para que o usuário saiba que precisa cadastrar a variante.

### O que mudar

Em `src/lib/pdf/pdf-generator.tsx`, dentro do método `gerarFichas`, após o bloco de conversão de imagens para base64 (após a linha ~79 onde `imagensBase64` é populado), adicione a seguinte verificação:

```ts
// Detectar grades CABEDAL sem imagem e logar aviso
if (setoresFiltrados.includes(Setor.CABEDAL)) {
  const gradesSemImagem = grades.filter((g) => !g.imagemUrl)
  if (gradesSemImagem.length > 0) {
    const nomes = gradesSemImagem.map((g) => `${g.modelo} cor ${g.cor ?? '?'}`).join(', ')
    console.warn(`[gerarFichas] CABEDAL: ${gradesSemImagem.length} grade(s) sem imagem de variante: ${nomes}`)
  }
}
```

Depois, para que o aviso chegue ao usuário, retorne `avisos` como campo adicional no response da rota de geração. Em `src/app/api/fichas/gerar/route.ts`, localize onde `gerarFichas` é chamado e o resultado é retornado. Adicione ao retorno a lista de avisos.

Para construir os avisos, extraia-os do `pdf-generator.tsx`: modifique o método `gerarFichas` para retornar também `avisos`:

1. Declare no início de `gerarFichas`:
```ts
const avisos: string[] = []
```

2. Substitua o `console.warn` por:
```ts
const gradesSemImagem = grades.filter((g) => !g.imagemUrl)
if (gradesSemImagem.length > 0) {
  const nomes = gradesSemImagem.map((g) => `${g.modelo} cor ${g.cor ?? '?'}`).join(', ')
  const aviso = `CABEDAL: ${gradesSemImagem.length} grade(s) sem imagem — ${nomes}. Cadastre a variante de cor em Configurações > Modelos.`
  console.warn('[gerarFichas]', aviso)
  avisos.push(aviso)
}
```

3. Atualize o tipo de retorno de `gerarFichas` de `Promise<FichaGerada[]>` para `Promise<{ fichas: FichaGerada[]; avisos: string[] }>`:
```ts
async gerarFichas(...): Promise<{ fichas: FichaGerada[]; avisos: string[] }> {
```

4. No `return` final do método (após a transação), substitua:
```ts
return fichasGeradas
```
por:
```ts
return { fichas: fichasGeradas, avisos }
```

5. Em `src/app/api/fichas/gerar/route.ts`, atualize onde `gerarFichas` é chamado para usar o novo formato:
```ts
const { fichas, avisos } = await service.gerarFichas(pedidoId, setores)
return NextResponse.json({ data: { fichas }, avisos })
```

6. Em `src/components/pedidos/botao-gerar-fichas.tsx`, atualize o handler para exibir avisos como toasts de warning:
```ts
const result = await res.json() as { data?: { fichas?: unknown[] }; avisos?: string[] }
const count = result?.data?.fichas?.length ?? 0
toast.success(count > 0 ? `${count} fichas geradas com sucesso` : 'Fichas geradas com sucesso')

// Exibir avisos (não bloqueantes) — ex: grades sem imagem
if (result.avisos && result.avisos.length > 0) {
  for (const aviso of result.avisos) {
    toast.warning(aviso, { duration: 8000 })
  }
}
```

### Validação
- `npx tsc --noEmit` — zero erros.
- Gere fichas para um pedido onde um modelo tem `cor='999'` mas a variante `999` não existe. O PDF deve ser gerado, o toast de sucesso aparece, e em seguida toast(s) de warning listando quais modelos/cores ficaram sem imagem.
- Inspecione o response JSON de `/api/fichas/gerar` — deve ter `{ data: { fichas: [...] }, avisos: [...] }`.

### Erros comuns a evitar
- Não alterar a interface `FichaGerada` exportada — ela é usada em outros lugares. Apenas o tipo de retorno do método `gerarFichas` muda.
- Não usar `toast.warning` sem verificar se a lib Sonner suporta — confirme que `toast.warning` existe em `sonner`. Se não existir, use `toast(aviso, { icon: '⚠️' })`.
- Não bloquear a geração quando houver avisos — o comportamento correto é gerar e avisar, nunca rejeitar.
- A detecção de grades sem imagem deve acontecer **antes** do bloco de conversão base64 (ou seja, verificar `g.imagemUrl` nula), não depois (onde `imagensBase64.has(url)` indicaria falha de conversão — isso é um caso diferente e mais raro).

---

## TASK-07 — REVISÃO FINAL: Auditoria completa do fluxo Bling → Fichas

> Esta é a task de revisão. Execute somente após concluir TASK-01 a TASK-06.

### Prompt de revisão

Execute cada verificação abaixo em sequência. Para cada ponto, confirme ✅ ou documente o problema encontrado.

---

### BLOCO A — Compilação e tipos

```
1. Execute: npx tsc --noEmit
   → Esperado: zero erros. Se houver erros, corrija antes de continuar.

2. Verifique que nenhum `any` novo foi introduzido nos arquivos editados.
   Busque: grep -n "as any\|: any" prisma/seed.ts src/app/api/modelos/verificar-variantes/route.ts src/app/api/configuracoes/regras-sku/[id]/route.ts src/app/api/configuracoes/regras-sku/route.ts src/lib/bling/sku-parser.ts src/lib/pdf/pdf-generator.tsx src/hooks/use-verificar-variantes.ts src/components/pedidos/botao-gerar-fichas.tsx

3. Confirme que nenhum import foi deixado sem uso após as edições.
   Execute: npx eslint --max-warnings=0 [arquivos editados]
```

---

### BLOCO B — Seed e regra SKU

```
4. Verifique o conteúdo de prisma/seed.ts:
   - A primeira regra do createMany tem modo='SUFIXO' e ativa=true ✅
   - digitosSufixo é um array com [{campo:'tamanho',digitos:2},{campo:'cor',digitos:3}] ✅
   - A segunda regra tem modo='SEPARADOR' e ativa=false ✅
   - Nenhuma outra regra tem ativa=true no seed ✅

5. Execute o seed em banco de desenvolvimento:
   npx tsx prisma/seed.ts
   Verifique no banco: SELECT modo, ativa, "digitosSufixo" FROM "RegraSkU";
   Esperado: 1 linha com modo='SUFIXO' e ativa=true

6. Verifique que invalidarCacheRegra() é chamado em 3 lugares:
   grep -rn "invalidarCacheRegra" src/
   Esperado: 3 ocorrências:
   - src/app/api/configuracoes/regras-sku/[id]/ativar/route.ts
   - src/app/api/configuracoes/regras-sku/[id]/route.ts
   - src/app/api/configuracoes/regras-sku/route.ts
```

---

### BLOCO C — Parsing de SKU

```
7. Teste de parse do SKU de referência do INTAKE:
   SKU de entrada: '1611600128'
   Regra ativa: SUFIXO [{campo:'tamanho',digitos:2},{campo:'cor',digitos:3}]
   Resultado esperado: { modelo:'16116', cor:'001', tamanho:'28', status:'RESOLVIDO' }

   Para verificar, você pode temporariamente chamar parseSku via tsx:
   npx tsx -e "import('@/lib/bling/sku-parser').then(m => m.parseSku('1611600128').then(r => console.log(r)))"
   (ajuste o caminho se necessário)

8. Teste de SKU com tamanho não-numérico:
   SKU hipotético: '16116001AB' (sufixo 'AB' não é número)
   Resultado esperado: status='PENDENTE', tamanho=null

   Confirme em sku-parser.ts que a lógica de statusFinal está presente e correta.

9. Teste de SKU vazio:
   parseSku('') deve retornar { modelo:null, cor:null, tamanho:null, status:'PENDENTE' }
   Confirme que o early return na linha ~82 cobre esse caso.

10. Teste de SKU muito curto para o sufixo:
    SKU '123' com sufixo [tamanho:2, cor:3] → total necessário: 5 chars, mas SKU tem 3
    Esperado: status='PENDENTE' (parseSkuSufixo retorna null em todos os campos quando remaining.length < seg.digitos)
    Confirme o early return dentro de parseSkuSufixo (~linha 63).
```

---

### BLOCO D — Verificação de variantes (API e hook)

```
11. Leia o arquivo src/app/api/modelos/verificar-variantes/route.ts completo.
    Confirme:
    - Interface CorSemVariante com campos: codigo, nome, cor ✅
    - Query de itens busca AMBOS os campos: select: { modelo: true, cor: true } ✅
    - Busca de modelos inclui variantesCor: { select: { corCodigo: true } } ✅
    - modelosSemVariante cobre: (a) modelos com 0 variantes, (b) modelos sem cadastro ✅
    - coresSemVariante só processa pares onde item.modelo && item.cor (ambos não-null) ✅
    - coresSemVariante não duplica entradas de modelosSemVariante (o 'continue' no loop) ✅
    - todosComVariante = modelosSemVariante.length === 0 && coresSemVariante.length === 0 ✅

12. Leia src/hooks/use-verificar-variantes.ts:
    - Interface VerificarVariantesResult inclui coresSemVariante: CorSemVariante[] ✅
    - CorSemVariante tem os mesmos campos que a API retorna ✅

13. Leia src/components/pedidos/popover-acao.tsx:
    - Recebe e exibe coresSemVariante ✅
    - Link de cada cor aponta para /configuracoes/modelos?search={codigo} ✅

14. Leia src/components/pedidos/botao-gerar-fichas.tsx:
    - Passa coresSemVariante={verificacao.coresSemVariante} para PopoverAcao ✅
    - disabled continua sendo !verificacao?.todosComVariante ✅
    - showPopover continua sendo !loading && verificacao?.todosComVariante === false ✅
```

---

### BLOCO E — Geração de fichas e avisos

```
15. Leia src/lib/pdf/pdf-generator.tsx:
    - Tipo de retorno de gerarFichas: Promise<{ fichas: FichaGerada[]; avisos: string[] }> ✅
    - avisos[] declarado no início do método ✅
    - Bloco de detecção de gradesSemImagem presente antes do Promise.all de uploads ✅
    - return final: { fichas: fichasGeradas, avisos } ✅

16. Leia src/app/api/fichas/gerar/route.ts:
    - Desestrutura { fichas, avisos } do resultado de gerarFichas ✅
    - Response JSON: { data: { fichas }, avisos } ✅

17. Leia src/components/pedidos/botao-gerar-fichas.tsx:
    - Tipo do result.json() inclui avisos?: string[] ✅
    - Loop sobre result.avisos exibindo toast.warning ✅
    - Toast de sucesso exibe contagem de fichas, não é suprimido pelos avisos ✅
    - toast.warning existe em sonner (confirme na documentação ou com grep em node_modules/sonner)
      Se não existir, a alternativa é: toast(aviso, { icon: '⚠️', duration: 8000 })
```

---

### BLOCO F — Fluxo end-to-end manual

```
18. Prepare o ambiente:
    - Certifique-se que docker compose está rodando (banco na porta 5433)
    - npm run dev está rodando
    - Seed foi aplicado (regra SUFIXO ativa)

19. Crie (ou use existente) um modelo com código '16116' e adicione variante com corCodigo='001'
    (com imagem de teste via /configuracoes/modelos → ícone de variantes)

20. Acesse a aba "Importar Pedidos" e importe um pedido do Bling que contenha um item
    com SKU no formato posicional (ex: '1611600128')

21. Verifique que o item importado tem:
    - modelo = '16116'
    - cor = '001'
    - tamanho = 28
    - status = 'RESOLVIDO'
    (via banco: SELECT modelo, cor, tamanho, status FROM "ItemPedido" WHERE "pedidoId" = '...')

22. Acesse a aba de detalhes do pedido:
    - Botão "Gerar fichas" DEVE estar habilitado (modelo tem variante para a cor '001')

23. Remova a variante '001' do modelo '16116' (ou mude o corCodigo para '999'):
    - Botão "Gerar fichas" DEVE estar desabilitado
    - Popover DEVE mostrar "Modelo 16116 — sem variante para cor 001"
    - Link no popover DEVE apontar para /configuracoes/modelos?search=16116

24. Restaure a variante '001' e clique em "Gerar fichas":
    - Modal de setores aparece ✅
    - Selecione CABEDAL + PALMILHA + SOLA ✅
    - Fichas geradas com sucesso ✅
    - Toast de sucesso aparece ✅
    - Nenhum toast de warning (imagem foi encontrada) ✅

25. Opcional: teste o caso de warning. Crie uma variante '001' SEM imagem:
    - Gere as fichas novamente (resetar status do pedido via banco se necessário)
    - Toast de sucesso deve aparecer
    - Toast de warning deve aparecer informando que o CABEDAL ficou sem imagem para o modelo
    - O PDF CABEDAL deve ter sido gerado com '—' no lugar da imagem
```

---

### BLOCO G — Regressão: comportamento existente não quebrado

```
26. Verifique que modelos sem nenhum item com cor no pedido não bloqueiam o botão:
    - Item com modelo='16116' e cor=null (parsing falhou)
    - coresSemVariante DEVE estar vazia para esse item (pois cor é null, não processa)
    - modelosSemVariante só bloqueia se o modelo não tem variante alguma

27. Verifique que o botão continua bloqueado para modelos sem cadastro:
    - Item com modelo='XXXX' (não existe no banco)
    - modelosSemVariante DEVE conter {codigo:'XXXX', nome:'Não cadastrado'}
    - todosComVariante = false → botão desabilitado ✅

28. Verifique que a rota DELETE de regras-sku ainda bloqueia exclusão de regra ativa:
    - src/app/api/configuracoes/regras-sku/[id]/route.ts
    - Bloco de validação `if (regra.ativa)` deve estar intacto ✅

29. Execute npx tsc --noEmit uma última vez para confirmar zero erros após todas as edições.

30. Se existirem testes automatizados no projeto:
    Rode: npm test (ou npx jest)
    Confirme que nenhum teste existente quebrou.
    Se algum teste quebrou, investigue — pode ser que o teste estava validando o comportamento bugado (ex: esperava que verificarVariantes retornasse apenas modelosSemVariante). Atualize os testes para refletir o comportamento correto.
```

---

**Resultado esperado ao final desta revisão:**
- Zero erros de TypeScript
- Seed cria regra SUFIXO como padrão ativa
- Cache de regra SKU invalidado em todas as rotas de mutação
- Verificação de variantes valida cor específica do pedido, não apenas "tem alguma variante"
- Tamanho não-numérico mantém item como PENDENTE
- Geração de fichas avisa o usuário quando CABEDAL fica sem imagem, sem bloquear a geração
- Fluxo completo `SKU Bling → cor extraída → variante encontrada → imagem no CABEDAL` validado manualmente
