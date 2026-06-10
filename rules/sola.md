# Ficha de Produção — SOLA

## O que é o setor SOLA

O setor de sola processa a sola externa do calçado — a parte inferior que entra em contato com o chão. O setor recebe, separa e prepara as solas para a montagem. A ficha de sola é mais simples que a de cabedal pois não carrega informações cruzadas com outros setores, focando apenas nos dados necessários para a seleção e separação das solas corretas.

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
| REF Sola | `Modelo.sola` | Referência do fornecedor para este modelo de sola |
| Cor Sola | `ModeloVarianteCor.corSola` | Código numérico da cor da sola |
| Descrição Cor Sola | `MapeamentoCor.descricao` (por corSola) | Nome da cor (ex: preto, bege) |
| Material Sola | `Modelo.materialSola` | Tipo/descrição do material da sola |

### Grade numérica

Tabela com os tamanhos da grade e as quantidades de pares para cada tamanho. Tamanhos com quantidade zero são omitidos. Quando o agrupamento está ativo, as quantidades de múltiplas grades são somadas tamanho a tamanho.

### Linha de observação

Campo em branco para preenchimento manual pelo operador.

---

## Layout do card

```
┌──────────────────────────────────────┐
│               SOLA                   │
├──────────────────┬───────────────────┤
│ Pedido: xxx      │ Data: xx/xx/xxxx   │
│ Fornecedor: xxx  │                    │
├──────────────────┴───────────────────┤
│ REF Sola:     __________________     │
│ Cor Sola:     __________________     │
│ Material:     __________________     │
├──────────────────────────────────────┤
│ Grade: 37   38   39   40   41   42   │
│ Qtde:  10   15   12    8   10    5   │
├──────────────────────────────────────┤
│ Obs: ________________________________│
└──────────────────────────────────────┘
```

---

## Regras de agrupamento

**Chave de agrupamento:** `modelo + corSola + materialSola`

Cards que compartilham a mesma chave são **fundidos em um único card**. As quantidades por tamanho são somadas.

### Exemplo prático

Dois pedidos distintos têm o mesmo modelo com a mesma cor de sola:

```
Pedido A: modelo 8054, corSola=298, tamanhos {37:5, 38:10}
Pedido B: modelo 8054, corSola=298, tamanhos {37:3, 38:8, 39:6}

Após merge → 1 card: {37:8, 38:18, 39:6}
```

### Impacto na identificação do pedido

Quando ocorre merge de múltiplos pedidos, o campo "Pedido" no card exibe os números de todos os pedidos agrupados (ex: "PED-001 / PED-002"). A data exibida é a do primeiro pedido da lista.

### Por que SOLA agrupa e CABEDAL não

O setor de cabedal precisa de instrução individual por par (modelo, cor, imagem), pois a produção é artesanal e individual. O setor de sola trabalha com estoque de solas prontas — saber que precisa de X pares de sola 298 no tamanho 37 é suficiente, independente de qual pedido gerou essa demanda.

---

## Critério de inclusão

O setor SOLA é incluído quando explicitamente selecionado pelo usuário no `DialogSetores`. Não há critério condicional — qualquer modelo pode ter uma ficha SOLA.

Se nenhum dos modelos tiver o campo `Modelo.sola` preenchido, os cards serão gerados com o campo REF Sola em branco, mas a ficha ainda é produzida.

---

## Configurações relevantes no banco

**Modelo:**
- `sola`: referência do fornecedor para o modelo de sola (ex: "SL-42B")
- `materialSola`: descrição do material (ex: borracha, EVA, PVC)

**ModeloVarianteCor:**
- `corSola`: código numérico da cor da sola para esta variante específica

**MapeamentoCor:**
- Mapeia o código numérico da cor da sola para seu nome descritivo
- Auto-criado com `(codigo, codigo)` se ausente (requer revisão manual)

---

## Comparação com os outros setores simples

| Aspecto | SOLA | PALMILHA | FACHETA |
|---|---|---|---|
| Agrupamento | modelo + corSola + materialSola | modelo + corPalmilha + materialPalmilha | modelo + corFacheta + corSola + materialFacheta |
| Imagem | Não | Não | Não |
| Cards por página | 5 | 5 | 6 |
| Condicional | Não | Não | Sim (precisa de `modelo.facheta` preenchido) |
| Referência cruzada | Não | Não | Mostra também REF Sola e Cor Sola |

---

## Caminho do arquivo gerado

- **Individual:** `pedidos/{pedidoId}/SOLA.pdf`
- **Consolidado:** `consolidados/{consolidadoId}/SOLA.pdf`
