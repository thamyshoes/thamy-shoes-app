# Ficha de Produção — CABEDAL

## O que é o setor CABEDAL

O setor de cabedal processa a parte superior do sapato: corte, costura e montagem dos materiais que formam o corpo visível do calçado. É o setor mais complexo do processo produtivo pois cada variante de cor gera uma ficha distinta e a ficha inclui informações de referência cruzada com os demais setores (sola e palmilha).

---

## Dados exibidos na ficha

A ficha CABEDAL é a mais completa do sistema. Ela exibe informações de todos os componentes do sapato, não apenas do cabedal.

### Bloco de identificação

| Campo | Fonte | Observação |
|---|---|---|
| Pedido | `PedidoCompra.numeroPedido` | Número do pedido Bling |
| Data | `PedidoCompra.dataPedido` | Data de criação do pedido |
| Fornecedor | `PedidoCompra.fornecedor` | Nome do fornecedor Bling |
| SKU | `ItemPedido.skuBruto` | SKU original importado do Bling |

### Bloco de componentes

| Campo | Fonte no banco | Observação |
|---|---|---|
| REF Cabedal | `Modelo.cabedal` | Referência do material do cabedal |
| Cor Cabedal | `ModeloVarianteCor.corCabedal` | Código da cor do cabedal |
| Descrição Cor Cabedal | `MapeamentoCor.descricao` (por corCabedal) | Nome da cor (ex: branco) |
| Material Cabedal | `Modelo.materialCabedal` | Tipo/descrição do material |
| REF Palmilha | `Modelo.palmilha` | Referência da palmilha (informativo) |
| Cor Palmilha | `ModeloVarianteCor.corPalmilha` | Código da cor da palmilha |
| Descrição Cor Palmilha | `MapeamentoCor.descricao` (por corPalmilha) | Nome da cor |
| REF Sola | `Modelo.sola` | Referência da sola (informativo) |
| Cor Sola | `ModeloVarianteCor.corSola` | Código da cor da sola |
| Descrição Cor Sola | `MapeamentoCor.descricao` (por corSola) | Nome da cor |

### Bloco de imagem

| Campo | Fonte | Observação |
|---|---|---|
| Imagem da variante | `ModeloVarianteCor.imagemUrl` | Convertida para base64 em runtime |

A imagem é exibida em um box de 46×46pt no canto superior direito do card. Se a variante não tiver imagem cadastrada, o box fica em branco e um aviso (`avisos[]`) é incluído no retorno da API. A geração não é bloqueada.

### Grade numérica

Tabela com todos os tamanhos da grade do modelo e as quantidades de pares para cada tamanho. Os tamanhos são definidos pela `GradeNumeracao` associada ao modelo. Tamanhos com quantidade zero são omitidos.

### Linha de observação

Campo em branco para preenchimento manual pelo operador do setor.

---

## Layout do card

```
┌─────────────────────────────────────────────────────────────┐
│                         CABEDAL                             │
├─────────────────┬──────────────────┬────────────┬──────────┤
│ Pedido: xxx     │ Mat. Cabedal: xx  │ REF Sola:  │          │
│ Data: xx/xx     │ REF Palmilha: xx  │ Cor Sola:  │ [Imagem] │
│ SKU: xxxxx      │ Cor Palmilha: xx  │            │ 46x46pt  │
│ Fornecedor: xxx │                   │            │          │
│ REF Cabedal: xx │                   │            │          │
│ Cor Cabedal: xx │                   │            │          │
├─────────────────┴──────────────────┴────────────┴──────────┤
│  Grade:  37    38    39    40    41    42    43    44        │
│  Qtde:   10    15    12     8    10     5     3     2        │
├────────────────────────────────────────────────────────────┤
│  Obs: ___________________________________________________   │
└────────────────────────────────────────────────────────────┘
```

---

## Regras de agrupamento

**CABEDAL não utiliza agrupamento (merge).** Cada combinação única de `modelo + cor` gera um card distinto. Se o mesmo modelo aparecer em dois pedidos com a mesma cor, os dois pedidos geram cards separados — as quantidades nunca são somadas entre pedidos diferentes.

No contexto de um único pedido, se o mesmo `modelo + cor` aparecer em múltiplos itens (ex: tamanhos separados), eles são agrupados na mesma grade (somando quantidades por tamanho), mas o card em si permanece único por modelo+cor.

---

## Processo de geração de imagens

1. Para cada grade do setor CABEDAL, o sistema verifica se `imagemUrl` está preenchido
2. Faz download de todas as URLs em paralelo (`Promise.all`)
3. Converte cada imagem para base64 (formato `data:image/{ext};base64,...`)
4. Injeta o base64 no template antes da renderização
5. Se o download falhar ou a URL estiver ausente, `base64Imagem = null`

A conversão para base64 é necessária porque o react-pdf não aceita URLs externas diretamente.

---

## Critério de inclusão

O setor CABEDAL é sempre incluído se explicitamente selecionado pelo usuário no `DialogSetores`. Diferente do setor FACHETA, não há critério condicional — qualquer modelo pode ter uma ficha CABEDAL.

---

## Configurações relevantes no banco

**Modelo:**
- `cabedal`: referência do fornecedor para o material de cabedal
- `materialCabedal`: descrição do tipo de material (ex: couro, sintético)

**ModeloVarianteCor:**
- `corCabedal`: código numérico da cor do cabedal para esta variante
- `imagemUrl`: URL da imagem da variante (Supabase Storage ou URL externa)

**MapeamentoCor:**
- Mapeia código numérico → nome descritivo da cor
- Auto-criado se ausente (precisa revisão manual)

---

## Diferenças em relação às fichas de SOLA e PALMILHA

| Aspecto | CABEDAL | SOLA / PALMILHA |
|---|---|---|
| Agrupamento de cards | Não agrupa | Agrupa por cor+ref |
| Imagem | Sim (base64) | Não |
| Informações cruzadas | Mostra refs de sola e palmilha | Mostra apenas seu próprio setor |
| Cards por página | 5 | 5 |
| Complexidade | Alta | Baixa |
| Tempo de geração | Maior (download imagens) | Menor |

---

## Caminho do arquivo gerado

- **Individual:** `pedidos/{pedidoId}/CABEDAL.pdf`
- **Consolidado:** `consolidados/{consolidadoId}/CABEDAL.pdf`
