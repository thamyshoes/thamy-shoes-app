# Ficha de Produção — FACHETA

## O que é o setor FACHETA

O setor de facheta processa o acabamento e fechamento do calçado — a etapa final de montagem que une os componentes e finaliza o produto. A facheta é um componente de acabamento que nem todos os modelos possuem: apenas modelos com o campo `facheta` preenchido no banco de dados geram fichas para este setor.

A ficha de facheta é a única que exibe informações cruzadas com a sola, pois o acabamento depende da combinação correta de facheta e sola.

---

## Dados exibidos na ficha

### Bloco de identificação

| Campo | Fonte | Observação |
|---|---|---|
| Pedido | `PedidoCompra.numeroPedido` | Número do pedido Bling |
| Data | `PedidoCompra.dataPedido` | Data de criação do pedido |
| Fornecedor | `PedidoCompra.fornecedor` | Nome do fornecedor Bling |

### Bloco de componentes

| Campo | Fonte no banco | Observação |
|---|---|---|
| REF Facheta | `Modelo.facheta` | Referência do fornecedor para este componente de facheta |
| Cor Facheta | `ModeloVarianteCor.corFacheta` | Código numérico da cor da facheta |
| Descrição Cor Facheta | `MapeamentoCor.descricao` (por corFacheta) | Nome da cor |
| Material Facheta | `Modelo.materialFacheta` | Tipo/descrição do material da facheta |
| REF Sola | `Modelo.sola` | Referência da sola (informativo, para correspondência) |
| Cor Sola | `ModeloVarianteCor.corSola` | Código da cor da sola correspondente |
| Descrição Cor Sola | `MapeamentoCor.descricao` (por corSola) | Nome da cor da sola |

### Grade numérica

Tabela com os tamanhos e quantidades de pares. Tamanhos com quantidade zero são omitidos. Quando o agrupamento estiver ativo, as quantidades são somadas.

### Linha de observação

Campo em branco para preenchimento manual pelo operador.

---

## Layout do card

```
┌─────────────────────────────────────────────────────┐
│                    FACHETA                          │
├──────────────────┬───────────────────┬─────────────┤
│ Pedido: xxx      │ REF Facheta: xxx  │ REF Sola:   │
│ Fornecedor: xxx  │ Cor Facheta: xxx  │ Cor Sola:   │
│ Data: xx/xx      │ Material: xxx     │             │
├──────────────────┴───────────────────┴─────────────┤
│ Grade: 37   38   39   40   41   42   43   44       │
│ Qtde:  10   15   12    8   10    5    3    2       │
├────────────────────────────────────────────────────┤
│ Obs: ______________________________________________│
└────────────────────────────────────────────────────┘
```

**Nota:** A facheta usa layout de 3 colunas (identificação + componentes facheta + componentes sola) sem imagem. Tem 6 cards por página, diferente dos demais setores que têm 5.

---

## Regras de agrupamento

**Chave de agrupamento:** `modelo + corFacheta + corSola + materialFacheta`

A chave inclui `corSola` porque a facheta precisa corresponder à sola correta — fachetas de cores diferentes usadas com solas diferentes são operações distintas, mesmo que a facheta em si seja a mesma.

Cards que compartilham a mesma chave são **fundidos em um único card**, com quantidades somadas por tamanho.

### Exemplo prático

```
Pedido A: modelo 8054, corFacheta=100, corSola=298, tamanhos {37:5, 38:10}
Pedido B: modelo 8054, corFacheta=100, corSola=298, tamanhos {38:5, 39:8}

Após merge → 1 card: {37:5, 38:15, 39:8}

Pedido C: modelo 8054, corFacheta=100, corSola=999 (sola diferente)
→ Card separado (corSola diferente na chave)
```

### Impacto na identificação do pedido

Quando ocorre merge, o campo "Pedido" exibe todos os números agrupados (ex: "PED-001 / PED-002").

---

## Critério de inclusão — Condicional

**A ficha FACHETA só é gerada se pelo menos um dos modelos tiver o campo `Modelo.facheta` preenchido.**

Esta é a única diferença estrutural entre a facheta e os demais setores. O comportamento é:

1. Antes do agrupamento, o sistema filtra todas as grades onde `modeloFacheta == null`
2. Se após o filtro não restar nenhuma grade, a ficha FACHETA **não é gerada** para este pedido/consolidado
3. Se restar pelo menos uma grade, a ficha é gerada contendo apenas os modelos com facheta

### Detecção automática

Quando o usuário seleciona os setores no `DialogSetores`:
- O checkbox de FACHETA fica desabilitado se `temFacheta=false` (nenhum modelo no pedido tem facheta)
- Se `temFacheta=true`, o checkbox fica habilitado e o usuário pode optar por incluir ou excluir

No fluxo consolidado, se qualquer um dos pedidos tiver modelos com facheta, o sistema **inclui automaticamente** o setor FACHETA na lista de setores a gerar, mesmo que não tenha sido explicitamente selecionado.

---

## Grades mistas (modelos com e sem facheta no mesmo consolidado)

Em um consolidado com múltiplos pedidos, é comum ter:

- Pedido A: modelos com facheta
- Pedido B: modelos sem facheta

O comportamento é:
- A ficha FACHETA é gerada (pois o Pedido A tem facheta)
- Os modelos do Pedido B que não têm facheta são **silenciosamente omitidos** da ficha FACHETA
- As fichas CABEDAL, SOLA e PALMILHA do Pedido B são geradas normalmente

---

## Por que a facheta inclui a REF e Cor Sola

O operador do setor de facheta precisa garantir que a facheta escolhida corresponda visualmente à sola do par. Como facheta e sola são componentes que se tocam na estrutura final do calçado, a combinação de cores precisa ser validada antes da montagem. A exibição cruzada elimina a necessidade de consultar a ficha de sola separadamente.

---

## Configurações relevantes no banco

**Modelo:**
- `facheta`: referência do fornecedor para o componente de facheta (ex: "FC-22A"). Se `null`, o modelo não gera ficha FACHETA
- `materialFacheta`: descrição do material da facheta

**ModeloVarianteCor:**
- `corFacheta`: código numérico da cor da facheta para esta variante
- `corSola`: código numérico da cor da sola (também usado na chave de agrupamento da facheta)

**MapeamentoCor:**
- Mapeia os códigos de `corFacheta` e `corSola` para seus nomes descritivos

---

## Diferenças em relação aos demais setores

| Aspecto | FACHETA | CABEDAL | SOLA | PALMILHA |
|---|---|---|---|---|
| Condicional | Sim (`Modelo.facheta != null`) | Não | Não | Não |
| Referência cruzada | Sim (mostra Sola) | Sim (mostra Sola e Palmilha) | Não | Não |
| Imagem | Não | Sim | Não | Não |
| Cards por página | **6** | 5 | 5 | 5 |
| Chave de merge | modelo + corFacheta + corSola + material | Sem merge | modelo + corSola + material | modelo + corPalmilha + material |
| Detecção automática | Sim (inclui setor se qualquer grade tiver facheta) | Não | Não | Não |

---

## Caminho do arquivo gerado

- **Individual:** `pedidos/{pedidoId}/FACHETA.pdf`
- **Consolidado:** `consolidados/{consolidadoId}/FACHETA.pdf`
