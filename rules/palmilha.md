# Ficha de Produção - PALMILHA

## Escopo

Este documento descreve a ficha do setor PALMILHA conforme os templates, rotas e serviços atuais do repositório. A ficha pode ser gerada em três contextos:

| Contexto | Rota | Persistência |
|---|---|---|
| Individual | `POST /api/fichas/gerar` | Salva PDF no Supabase Storage e cria `FichaProducao` |
| Consolidado V2 da tela `/pedidos/consolidar` | `POST /api/consolidar` | Retorna PDF em base64 para download, sem salvar no banco |
| Consolidado persistente | `POST /api/fichas/consolidar` | Salva PDF no Supabase Storage e cria `Consolidado`/`FichaProducao` |

---

## O que é o setor PALMILHA

O setor PALMILHA processa a palmilha interna do calçado, ou seja, a peça que fica em contato com a planta do pé. A ficha é simples: identifica pedido, fornecedor, referência de palmilha, cor, material e quantidades por tamanho.

A ficha de PALMILHA não usa imagem e é renderizada pelo componente `TemplatePalmilha`, que delega o layout base para `TemplateSimples`.

---

## Template e Arquivos

| Responsabilidade | Arquivo |
|---|---|
| Template do setor | `src/components/pdf/templates/template-palmilha.tsx` |
| Layout simples compartilhado | `src/components/pdf/templates/template-simples.tsx` |
| Tabela de grade | `src/components/pdf/grade-numeracao.tsx` |
| Paginação PDF | `src/components/pdf/page-layout.tsx` |
| Render por setor | `src/lib/pdf/render-consolidado.tsx` |
| Serviço persistente | `src/lib/pdf/pdf-generator.tsx` |

---

## Dados Exibidos na Ficha

### Identificação

| Campo no PDF | Fonte real |
|---|---|
| Pedido | `PedidoCompra.numero` |
| Data | `PedidoCompra.dataEmissao` no fluxo V2; `pedido.data` montado pelo serviço no fluxo persistente |
| Fornecedor | `PedidoCompra.fornecedorNome` |

No consolidado persistente, o serviço monta um `PedidoData` sintético:

| Campo | Valor |
|---|---|
| `numero` | números dos pedidos unidos por vírgula |
| `data` | `new Date()` no momento da geração |
| `fornecedor` | fornecedores únicos unidos por vírgula |

No consolidado V2, cada card mantém os dados do pedido original porque o agrupamento inclui `pedidoId`.

### Componentes da palmilha

| Campo no PDF | Fonte real | Formatação |
|---|---|---|
| REF Palmilha | `Modelo.palmilha` | `-` quando vazio |
| Cor Palmilha | `ModeloVarianteCor.corPalmilha` | `formatCor(codigo, descricao)` |
| Descrição Cor Palmilha | `MapeamentoCor.descricao` resolvida para `corPalmilha` | Código da palmilha, não da cor principal do produto |
| Material Palmilha | `Modelo.materialPalmilha` | `-` quando vazio |

`formatCor()` exibe `codigo - descrição` quando os valores são diferentes. Se código e descrição forem iguais, exibe apenas um deles.

**Como a descrição é resolvida no consolidado V2 (após correção 2026-05-20):**

A rota `POST /api/consolidar` coleta todos os códigos de cor dos componentes das variantes encontradas, faz uma query em `MapeamentoCor` e monta um `corDescMap`. O campo `corPalmilhaDesc` é populado com `corDescMap.get(corPalmilha) ?? corPalmilha` antes de montar o `ConsolidadoCardData`. Se não houver mapeamento para o código, o próprio código é exibido (sem fallback para `corPrincipal`).

Antes da correção, `corPalmilhaDesc` não era populado e o template usava `corPrincipal` (descrição da cor da SKU/produto) como fallback — o que podia exibir a descrição errada quando a cor da palmilha diferia da cor principal.

---

## Grade Numérica

A grade é renderizada por `GradeNumeracao` com:

| Elemento | Comportamento |
|---|---|
| Cabeçalho | Lista os tamanhos recebidos no card |
| Linha de quantidades | Mostra a quantidade por tamanho |
| Total | Soma as quantidades dos tamanhos exibidos |
| Quantidade zero | Renderiza a célula em branco, usando texto branco |

No fluxo persistente, quando o modelo tem `GradeModelo`, `montarGradesConsolidadas()` usa todo o intervalo `GradeNumeracao.tamanhoMin..tamanhoMax`. Por isso, tamanhos sem quantidade continuam presentes na grade, mas aparecem visualmente vazios.

No consolidado V2 (`/api/consolidar`), os tamanhos vêm das quantidades presentes no grupo montado pela rota.

---

## Layout do Card

```text
+--------------------------------------+
|              PALMILHA                |
+------------------+-------------------+
| Pedido: xxx      | Data: dd/mm/aaaa   |
| Fornecedor: xxx  |                   |
+--------------------------------------+
| REF Palmilha: xxx                    |
| Cor Palmilha: 001 - branco           |
| Material Palmilha: espuma            |
+--------------------------------------+
| 34 | 35 | 36 | 37 | 38 | Total       |
|    |  5 |  8 |  2 |    | 15          |
+--------------------------------------+
| Observação:                          |
+--------------------------------------+
```

A ficha de PALMILHA usa 5 cards por página.

---

## Regras de Agrupamento

Há diferença entre o fluxo persistente e o consolidado V2 usado pela tela.

### Fluxo persistente

`mergeCardsPorSetor(Setor.PALMILHA, cards)` agrupa por:

```text
Modelo.palmilha + ModeloVarianteCor.corPalmilha + Modelo.materialPalmilha
```

Na implementação, a chave também inclui o número do pedido montado para o card. No consolidado persistente esse número é uma string com todos os pedidos, então cards equivalentes do consolidado podem ser fundidos. No fluxo individual, todos os cards pertencem ao mesmo pedido.

Se `Modelo.palmilha` ou `corPalmilha` estiver vazio, o card não é fundido com outros e usa chave única baseada em SKU e pedido.

### Consolidado V2 da tela

A rota `POST /api/consolidar` não chama `mergeCardsPorSetor()`. Ela agrupa antes por:

```text
pedidoId + modelo + cor
```

ou, quando `agruparPorFaixa=true`:

```text
pedidoId + modelo + cor + faixa
```

Consequência: dois pedidos diferentes com a mesma palmilha continuam como cards separados no consolidado V2.

---

## Exemplo de Merge Persistente

```text
Pedido A, modelo 8054, palmilha PM-10, corPalmilha=001, material=Espuma
  tamanhos {37: 5, 38: 10}

Pedido B, modelo 8054, palmilha PM-10, corPalmilha=001, material=Espuma
  tamanhos {38: 5, 39: 8}

Consolidado persistente após merge:
  tamanhos {37: 5, 38: 15, 39: 8}
```

Se a referência de palmilha, a cor de palmilha ou o material forem diferentes, os cards permanecem separados.

---

## Critério de Inclusão

PALMILHA não tem critério condicional como FACHETA.

| Fluxo | Como PALMILHA entra |
|---|---|
| Individual pela tela do pedido | Selecionada por padrão no `DialogSetores`; usuário pode desmarcar, mas se nenhum setor for enviado a API usa os setores padrão |
| Botão `Gerar Individual` da tela de consolidado | Usa setores padrão sem abrir diálogo |
| Consolidado V2 da tela | Sempre enviada em `SETORES_PADRAO = ['CABEDAL', 'SOLA', 'PALMILHA']` |
| Consolidado persistente | Sempre incluída na lista automática do serviço |

Se `Modelo.palmilha` não estiver preenchido, a ficha ainda pode ser gerada; o campo REF Palmilha aparece como `-`. Se `corPalmilha` não existir, o campo de cor usa fallback de descrição/cor principal quando disponível e o card não participa do merge por palmilha.

---

## Relação com CABEDAL

A ficha CABEDAL também mostra dados de palmilha:

| Campo em CABEDAL | Fonte |
|---|---|
| REF Palmilha | `Modelo.palmilha` |
| Cor Palmilha | `ModeloVarianteCor.corPalmilha` + descrição resolvida |

Isso permite que o operador do cabedal confira a combinação de componentes do par sem consultar a ficha de PALMILHA separadamente.

---

## Configurações Relevantes

### Modelo

| Campo | Uso |
|---|---|
| `palmilha` | Referência do fornecedor para a palmilha |
| `materialPalmilha` | Material exibido na ficha e usado no merge persistente |

### ModeloVarianteCor

| Campo | Uso |
|---|---|
| `corCodigo` | Cor principal da variante, usada para localizar a variante do item |
| `corPalmilha` | Código da cor específica da palmilha |

### MapeamentoCor

| Campo | Uso |
|---|---|
| `codigo` | Código de cor |
| `descricao` | Nome exibido junto da cor |
| `hex` | Usado em telas, não no template PDF da PALMILHA |

`interpretarItens()` pode auto-criar `MapeamentoCor` como `(codigo, codigo)`, mas somente para cores extraídas da SKU que estejam presentes como variante de um modelo encontrado.

---

## Diferenças em Relação à SOLA

| Aspecto | PALMILHA | SOLA |
|---|---|---|
| Componente | Palmilha interna | Sola externa |
| Template | `TemplatePalmilha` | `TemplateSola` |
| Layout base | `TemplateSimples` | `TemplateSimples` |
| Referência | `Modelo.palmilha` | `Modelo.sola` |
| Cor do componente | `ModeloVarianteCor.corPalmilha` | `ModeloVarianteCor.corSola` |
| Material | `Modelo.materialPalmilha` | `Modelo.materialSola` |
| Merge persistente atual | ref palmilha + cor palmilha + material palmilha | ref sola + cor sola |
| Cards por página | 5 | 5 |
| Imagem | Não | Não |

Observação: apesar de SOLA possuir `materialSola`, a chave real de merge atual em `mergeCardsPorSetor()` não inclui `materialSola`.

---

## Caminhos de Arquivo

Nos fluxos persistentes, o setor é salvo em minúsculo:

| Fluxo | Path real |
|---|---|
| Individual | `pedidos/{pedidoId}/palmilha.pdf` |
| Consolidado persistente | `consolidados/{consolidadoId}/palmilha.pdf` |

No consolidado V2 sem persistência, o navegador baixa:

```text
consolidado-palmilha.pdf
```

---

## Pontos de Atenção

1. **PALMILHA não bloqueia por referência vazia:** a ficha pode sair com `REF Palmilha: -`.

2. **Merge depende do fluxo:** o merge por palmilha só existe no serviço persistente. O consolidado V2 da tela mantém cards por pedido/modelo/cor.

3. **Zeros não são omitidos da estrutura:** no fluxo persistente, tamanhos sem quantidade podem aparecer como células em branco quando a grade do modelo define o intervalo completo.

4. **Sem imagem:** PALMILHA nunca baixa nem embute `imagemUrl`; isso é exclusivo do CABEDAL.

5. **FACHETA é a única condicional:** PALMILHA, SOLA e CABEDAL são setores padrão. FACHETA depende de `Modelo.facheta`.

6. **Cor de palmilha corrigida (2026-05-20):** o consolidado V2 agora popula `corPalmilhaDesc` a partir de `MapeamentoCor` antes de passar dados ao template. Antes disto, o fallback era `corPrincipal` (cor do produto), o que causava exibição de descrição incorreta quando a cor da palmilha diferia da cor principal.
