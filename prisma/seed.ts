import {
  PrismaClient,
  Perfil,
  Setor,
  StatusPedido,
  StatusItem,
  StatusConexao,
  EscopoEquivalencia,
  TipoCampo,
  CategoriaMaterial,
} from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed — thamy-shoes...\n')

  const now = new Date()

  // =========================================================================
  // USUÁRIOS
  // =========================================================================

  const senha = await bcrypt.hash('Thamy@2026', 12)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@thamyshoes.com.br' },
    update: {},
    create: {
      email: 'admin@thamyshoes.com.br',
      passwordHash: senha,
      nome: 'Administrador',
      perfil: Perfil.ADMIN,
      ativo: true,
    },
  })

  const pcp = await prisma.user.upsert({
    where: { email: 'pcp@thamyshoes.com.br' },
    update: {},
    create: {
      email: 'pcp@thamyshoes.com.br',
      passwordHash: senha,
      nome: 'Ana Beatriz',
      perfil: Perfil.PCP,
      ativo: true,
    },
  })

  await prisma.user.upsert({
    where: { email: 'cabedal@thamyshoes.com.br' },
    update: {},
    create: {
      email: 'cabedal@thamyshoes.com.br',
      passwordHash: senha,
      nome: 'Carlos Mendes',
      perfil: Perfil.PRODUCAO,
      setor: Setor.CABEDAL,
      ativo: true,
    },
  })

  await prisma.user.upsert({
    where: { email: 'palmilha@thamyshoes.com.br' },
    update: {},
    create: {
      email: 'palmilha@thamyshoes.com.br',
      passwordHash: senha,
      nome: 'Fernanda Lima',
      perfil: Perfil.PRODUCAO,
      setor: Setor.PALMILHA,
      ativo: true,
    },
  })

  await prisma.user.upsert({
    where: { email: 'sola@thamyshoes.com.br' },
    update: {},
    create: {
      email: 'sola@thamyshoes.com.br',
      passwordHash: senha,
      nome: 'Roberto Souza',
      perfil: Perfil.PRODUCAO,
      setor: Setor.SOLA,
      ativo: true,
    },
  })

  console.log('✅ User: 5 (ADMIN, PCP, PRODUCAO×3)')

  // =========================================================================
  // NÍVEL 0 — Entidades base
  // =========================================================================

  // --- MapeamentoCor (6 cores, com e sem hex) ---
  await Promise.all([
    prisma.mapeamentoCor.upsert({
      where: { codigo: '001' },
      update: {},
      create: { codigo: '001', descricao: 'Preto', hex: '#000000' },
    }),
    prisma.mapeamentoCor.upsert({
      where: { codigo: '002' },
      update: {},
      create: { codigo: '002', descricao: 'Branco', hex: '#FFFFFF' },
    }),
    prisma.mapeamentoCor.upsert({
      where: { codigo: '003' },
      update: {},
      create: { codigo: '003', descricao: 'Marrom', hex: '#8B4513' },
    }),
    prisma.mapeamentoCor.upsert({
      where: { codigo: '004' },
      update: {},
      create: { codigo: '004', descricao: 'Caramelo', hex: '#D2691E' },
    }),
    prisma.mapeamentoCor.upsert({
      where: { codigo: '005' },
      update: {},
      create: { codigo: '005', descricao: 'Azul Marinho', hex: '#001F5B' },
    }),
    prisma.mapeamentoCor.upsert({
      where: { codigo: '006' },
      update: {},
      create: { codigo: '006', descricao: 'Vermelho', hex: null }, // sem hex — cobre fallback do SwatchCor
    }),
  ])
  console.log('✅ MapeamentoCor: 6 (com e sem hex)')

  // --- Material (cover CABEDAL, SOLA, PALMILHA) ---
  await Promise.all([
    prisma.material.upsert({
      where: { nome_categoria: { nome: 'Couro Natural', categoria: CategoriaMaterial.CABEDAL } },
      update: {},
      create: { nome: 'Couro Natural', categoria: CategoriaMaterial.CABEDAL, ativo: true },
    }),
    prisma.material.upsert({
      where: { nome_categoria: { nome: 'Couro Sintético', categoria: CategoriaMaterial.CABEDAL } },
      update: {},
      create: { nome: 'Couro Sintético', categoria: CategoriaMaterial.CABEDAL, ativo: true },
    }),
    prisma.material.upsert({
      where: { nome_categoria: { nome: 'Borracha', categoria: CategoriaMaterial.SOLA } },
      update: {},
      create: { nome: 'Borracha', categoria: CategoriaMaterial.SOLA, ativo: true },
    }),
    prisma.material.upsert({
      where: { nome_categoria: { nome: 'EVA', categoria: CategoriaMaterial.SOLA } },
      update: {},
      create: { nome: 'EVA', categoria: CategoriaMaterial.SOLA, ativo: true },
    }),
    prisma.material.upsert({
      where: { nome_categoria: { nome: 'Espuma', categoria: CategoriaMaterial.PALMILHA } },
      update: {},
      create: { nome: 'Espuma', categoria: CategoriaMaterial.PALMILHA, ativo: true },
    }),
    prisma.material.upsert({
      where: { nome_categoria: { nome: 'Látex', categoria: CategoriaMaterial.PALMILHA } },
      update: {},
      create: { nome: 'Látex', categoria: CategoriaMaterial.PALMILHA, ativo: true },
    }),
  ])
  console.log('✅ Material: 6 (CABEDAL×2, SOLA×2, PALMILHA×2)')

  // --- GradeNumeracao (findFirst ou create) ---
  let gradeFeminino = await prisma.gradeNumeracao.findFirst({ where: { nome: 'Feminino Padrão' } })
  if (!gradeFeminino) {
    gradeFeminino = await prisma.gradeNumeracao.create({
      data: { nome: 'Feminino Padrão', tamanhoMin: 33, tamanhoMax: 37 },
    })
  }

  let gradeFemininoGG = await prisma.gradeNumeracao.findFirst({ where: { nome: 'Feminino GG' } })
  if (!gradeFemininoGG) {
    gradeFemininoGG = await prisma.gradeNumeracao.create({
      data: { nome: 'Feminino GG', tamanhoMin: 38, tamanhoMax: 42 },
    })
  }
  console.log('✅ GradeNumeracao: 2 (33-37, 38-42)')

  // --- RegraSkU (2: ativa true e false) ---
  const regraSKUCount = await prisma.regraSkU.count()
  if (regraSKUCount === 0) {
    await prisma.regraSkU.createMany({
      data: [
        {
          nome: 'Sufixo Padrão (Bling)',
          modo: 'SUFIXO',
          separador: '',
          ordem: ['modelo', 'cor', 'tamanho'],
          segmentos: {},
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
    })
  }
  console.log('✅ RegraSkU: 2 (ativa=true, ativa=false)')

  // --- RegraEquivalencia (REFERENCIA, GLOBAL) ---
  let regraRef = await prisma.regraEquivalencia.findFirst({ where: { escopo: EscopoEquivalencia.REFERENCIA } })
  if (!regraRef) {
    await prisma.regraEquivalencia.create({ data: { escopo: EscopoEquivalencia.REFERENCIA, valor: 'THS' } })
  }

  let regraGlobal = await prisma.regraEquivalencia.findFirst({ where: { escopo: EscopoEquivalencia.GLOBAL } })
  if (!regraGlobal) {
    await prisma.regraEquivalencia.create({ data: { escopo: EscopoEquivalencia.GLOBAL, valor: null } })
  }
  console.log('✅ RegraEquivalencia: 2 (REFERENCIA, GLOBAL)')

  // --- BlingConnection (DESCONECTADO, CONECTADO, EXPIRADO) ---
  const blingCount = await prisma.blingConnection.count()
  if (blingCount === 0) {
    await prisma.blingConnection.createMany({
      data: [
        {
          accessToken: 'active-access-token-001',
          refreshToken: 'active-refresh-token-001',
          expiresAt: new Date(now.getTime() + 3600 * 1000), // 1h a frente
          connectedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
          status: StatusConexao.CONECTADO,
        },
        {
          accessToken: 'expired-access-token-002',
          refreshToken: 'expired-refresh-token-002',
          expiresAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 dias atrás
          connectedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          status: StatusConexao.EXPIRADO,
        },
        {
          accessToken: '',
          refreshToken: '',
          expiresAt: now,
          connectedAt: now,
          status: StatusConexao.DESCONECTADO,
        },
      ],
    })
  }
  console.log('✅ BlingConnection: 3 (CONECTADO, EXPIRADO, DESCONECTADO)')

  // --- CampoExtra (todos Setores × TipoCampo, obrigatorio true/false, ativo true/false) ---
  const camposExtras = [
    { setor: Setor.CABEDAL,   nome: 'Tipo de Acabamento',    tipo: TipoCampo.SELECAO, obrigatorio: false, ativo: true,  ordem: 1 },
    { setor: Setor.CABEDAL,   nome: 'Quantidade de Ilhós',   tipo: TipoCampo.NUMERO,  obrigatorio: false, ativo: true,  ordem: 2 },
    { setor: Setor.PALMILHA,  nome: 'Espessura (mm)',         tipo: TipoCampo.NUMERO,  obrigatorio: true,  ativo: true,  ordem: 1 },
    { setor: Setor.PALMILHA,  nome: 'Observação de Palmilha', tipo: TipoCampo.TEXTO,   obrigatorio: false, ativo: true,  ordem: 2 },
    { setor: Setor.SOLA,      nome: 'Altura do Salto (cm)',   tipo: TipoCampo.NUMERO,  obrigatorio: true,  ativo: true,  ordem: 1 },
    { setor: Setor.SOLA,      nome: 'Tipo de Solado',         tipo: TipoCampo.SELECAO, obrigatorio: false, ativo: true,  ordem: 2 },
    { setor: Setor.FACHETA,   nome: 'Código da Facheta',      tipo: TipoCampo.TEXTO,   obrigatorio: true,  ativo: true,  ordem: 1 },
    { setor: Setor.FACHETA,   nome: 'Quantidade de Peças',    tipo: TipoCampo.NUMERO,  obrigatorio: false, ativo: false, ordem: 2 }, // ativo=false
  ]
  for (const campo of camposExtras) {
    await prisma.campoExtra.upsert({
      where: { setor_nome: { setor: campo.setor, nome: campo.nome } },
      update: {},
      create: campo,
    })
  }
  console.log('✅ CampoExtra: 8 (CABEDAL/PALMILHA/SOLA/FACHETA × TEXTO/NUMERO/SELECAO; ativo=false coberto)')

  // =========================================================================
  // NÍVEL 1 — Entidades com FK para Nível 0
  // =========================================================================

  // --- Produto (3: ativo=true ×2, ativo=false ×1) ---
  const prod1 = await prisma.produto.upsert({
    where: { idBling: BigInt('14500001') },
    update: {},
    create: {
      idBling: BigInt('14500001'),
      nome: 'Scarpin Clássico Bico Fino',
      codigo: 'THS-001',
      imagemUrl: 'https://picsum.photos/seed/ths001/400/400',
      ativo: true,
    },
  })

  const prod2 = await prisma.produto.upsert({
    where: { idBling: BigInt('14500002') },
    update: {},
    create: {
      idBling: BigInt('14500002'),
      nome: 'Sandália Tiras Entrelaçadas',
      codigo: 'THS-002',
      imagemUrl: 'https://picsum.photos/seed/ths002/400/400',
      ativo: true,
    },
  })

  const prod3 = await prisma.produto.upsert({
    where: { idBling: BigInt('14500003') },
    update: {},
    create: {
      idBling: BigInt('14500003'),
      nome: 'Mule Salto Bloco',
      codigo: 'THS-003',
      imagemUrl: null,
      ativo: false, // produto inativo — cobre boolean false
    },
  })
  console.log('✅ Produto: 3 (ativo=true ×2, ativo=false ×1)')

  // --- Modelo (3: com facheta ×2, sem facheta ×1; ativo true/false) ---
  const modelo1 = await prisma.modelo.upsert({
    where: { codigo: 'THS-001' },
    update: {},
    create: {
      codigo: 'THS-001',
      nome: 'Scarpin Clássico',
      cabedal: 'Cabedal em couro natural',
      sola: 'Sola de borracha vulcanizada',
      palmilha: 'Palmilha anatômica em espuma',
      facheta: 'FCH-001', // tem facheta
      materialCabedal: 'Couro Natural',
      materialSola: 'Borracha',
      materialPalmilha: 'Espuma',
      materialFacheta: 'Couro Natural',
      observacoes: 'Modelo principal da coleção inverno',
      ativo: true,
    },
  })

  const modelo2 = await prisma.modelo.upsert({
    where: { codigo: 'THS-002' },
    update: {},
    create: {
      codigo: 'THS-002',
      nome: 'Sandália Tiras',
      cabedal: 'Tiras em couro sintético',
      sola: 'Plataforma EVA',
      palmilha: 'Palmilha látex',
      facheta: null, // sem facheta — testa filtro "pular setor FACHETA" no PdfGeneratorService
      materialCabedal: 'Couro Sintético',
      materialSola: 'EVA',
      materialPalmilha: 'Látex',
      materialFacheta: null,
      observacoes: null,
      ativo: true,
    },
  })

  const modelo3 = await prisma.modelo.upsert({
    where: { codigo: 'THS-003' },
    update: {},
    create: {
      codigo: 'THS-003',
      nome: 'Mule Salto Bloco',
      cabedal: 'Bico quadrado em couro natural',
      sola: 'Salto bloco borracha 7cm',
      palmilha: 'Palmilha espuma fina',
      facheta: 'FCH-003', // tem facheta
      materialCabedal: 'Couro Natural',
      materialSola: 'Borracha',
      materialPalmilha: 'Espuma',
      materialFacheta: 'Borracha',
      observacoes: 'Linha descontinuada após coleção',
      ativo: false, // inativo — cobre boolean false
    },
  })
  console.log('✅ Modelo: 3 (facheta preenchida ×2, null ×1; ativo true/false)')

  // --- GradeModelo ---
  await prisma.gradeModelo.upsert({
    where: { gradeId_modelo: { gradeId: gradeFeminino.id, modelo: 'THS-001' } },
    update: {},
    create: { gradeId: gradeFeminino.id, modelo: 'THS-001' },
  })
  await prisma.gradeModelo.upsert({
    where: { gradeId_modelo: { gradeId: gradeFeminino.id, modelo: 'THS-002' } },
    update: {},
    create: { gradeId: gradeFeminino.id, modelo: 'THS-002' },
  })
  await prisma.gradeModelo.upsert({
    where: { gradeId_modelo: { gradeId: gradeFemininoGG.id, modelo: 'THS-003' } },
    update: {},
    create: { gradeId: gradeFemininoGG.id, modelo: 'THS-003' },
  })
  console.log('✅ GradeModelo: 3')

  // --- PedidoCompra (3 — cover todos os StatusPedido) ---
  const pedido1 = await prisma.pedidoCompra.upsert({
    where: { idBling: BigInt('88001') },
    update: {},
    create: {
      idBling: BigInt('88001'),
      numero: 'PC-2026-001',
      dataEmissao: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
      dataPrevista: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
      fornecedorNome: 'Couros Reunidos Ltda',
      fornecedorId: BigInt('5001'),
      observacoes: 'Pedido prioritário — lançamento de coleção inverno',
      status: StatusPedido.FICHAS_GERADAS,
      importadoPor: pcp.id,
    },
  })

  const pedido2 = await prisma.pedidoCompra.upsert({
    where: { idBling: BigInt('88002') },
    update: {},
    create: {
      idBling: BigInt('88002'),
      numero: 'PC-2026-002',
      dataEmissao: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      dataPrevista: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000),
      fornecedorNome: 'Solados Brilhantes ME',
      fornecedorId: BigInt('5002'),
      observacoes: null,
      status: StatusPedido.PENDENTE_AJUSTE,
      importadoPor: pcp.id,
    },
  })

  const pedido3 = await prisma.pedidoCompra.upsert({
    where: { idBling: BigInt('88003') },
    update: {},
    create: {
      idBling: BigInt('88003'),
      numero: 'PC-2026-003',
      dataEmissao: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      dataPrevista: null,
      fornecedorNome: 'Insumos do Sul Distribuidora',
      fornecedorId: null,
      observacoes: null,
      status: StatusPedido.IMPORTADO,
      importadoPor: admin.id,
    },
  })
  console.log('✅ PedidoCompra: 3 (IMPORTADO, PENDENTE_AJUSTE, FICHAS_GERADAS)')

  // =========================================================================
  // NÍVEL 2 — Entidades com FK para Nível 1
  // =========================================================================

  // --- ModeloVarianteCor (5: com/sem imagemUrl; cores por componente variadas) ---
  // Modelo 1: Preto (com imagem, cores cheias) e Marrom (sem imagem, corFacheta null)
  await prisma.modeloVarianteCor.upsert({
    where: { modeloId_corCodigo: { modeloId: modelo1.id, corCodigo: '001' } },
    update: {},
    create: {
      modeloId: modelo1.id,
      corCodigo: '001',
      corCabedal: '001',
      corSola: '001',
      corPalmilha: '001',
      corFacheta: '001',
      imagemUrl: 'https://picsum.photos/seed/ths001-preto/600/600',
    },
  })

  await prisma.modeloVarianteCor.upsert({
    where: { modeloId_corCodigo: { modeloId: modelo1.id, corCodigo: '003' } },
    update: {},
    create: {
      modeloId: modelo1.id,
      corCodigo: '003',
      corCabedal: '003',
      corSola: '001',
      corPalmilha: '004',
      corFacheta: null, // sem cor de facheta
      imagemUrl: null,  // sem imagem — testa fallback no PDF
    },
  })

  // Modelo 2: Caramelo (com imagem) e Branco (sem imagem, cores componente null)
  await prisma.modeloVarianteCor.upsert({
    where: { modeloId_corCodigo: { modeloId: modelo2.id, corCodigo: '004' } },
    update: {},
    create: {
      modeloId: modelo2.id,
      corCodigo: '004',
      corCabedal: '004',
      corSola: '002',
      corPalmilha: null,
      corFacheta: null,
      imagemUrl: 'https://picsum.photos/seed/ths002-caramelo/600/600',
    },
  })

  await prisma.modeloVarianteCor.upsert({
    where: { modeloId_corCodigo: { modeloId: modelo2.id, corCodigo: '002' } },
    update: {},
    create: {
      modeloId: modelo2.id,
      corCodigo: '002',
      corCabedal: '002',
      corSola: '002',
      corPalmilha: '002',
      corFacheta: null,
      imagemUrl: null,
    },
  })

  // Modelo 3: Azul Marinho (com imagem, todas cores preenchidas)
  await prisma.modeloVarianteCor.upsert({
    where: { modeloId_corCodigo: { modeloId: modelo3.id, corCodigo: '005' } },
    update: {},
    create: {
      modeloId: modelo3.id,
      corCodigo: '005',
      corCabedal: '005',
      corSola: '001',
      corPalmilha: '001',
      corFacheta: '001',
      imagemUrl: 'https://picsum.photos/seed/ths003-azul/600/600',
    },
  })
  console.log('✅ ModeloVarianteCor: 5 (com/sem imagemUrl; corFacheta null coberto)')

  // --- ItemPedido (5: PENDENTE×2, RESOLVIDO×3; SKU inválido coberto) ---
  const itemCount1 = await prisma.itemPedido.count({ where: { pedidoId: pedido1.id } })
  if (itemCount1 === 0) {
    await prisma.itemPedido.createMany({
      data: [
        {
          pedidoId: pedido1.id,
          produtoId: prod1.id,
          descricaoBruta: 'SCARPIN CLASSICO PRETO 35',
          skuBruto: 'THS-001-001-35',
          quantidade: 24,
          unidade: 'UN',
          modelo: 'THS-001',
          cor: '001',
          corDescricao: 'Preto',
          tamanho: 35,
          status: StatusItem.RESOLVIDO,
        },
        {
          pedidoId: pedido1.id,
          produtoId: prod1.id,
          descricaoBruta: 'SCARPIN CLASSICO MARROM 36',
          skuBruto: 'THS-001-003-36',
          quantidade: 12,
          unidade: 'UN',
          modelo: 'THS-001',
          cor: '003',
          corDescricao: 'Marrom',
          tamanho: 36,
          status: StatusItem.RESOLVIDO,
        },
      ],
    })
  }

  const itemCount2 = await prisma.itemPedido.count({ where: { pedidoId: pedido2.id } })
  if (itemCount2 === 0) {
    await prisma.itemPedido.createMany({
      data: [
        {
          pedidoId: pedido2.id,
          produtoId: prod2.id,
          descricaoBruta: 'SANDALIA TIRAS CARAMELO 37',
          skuBruto: 'THS-002-004-37',
          quantidade: 18,
          unidade: 'UN',
          modelo: 'THS-002',
          cor: '004',
          corDescricao: 'Caramelo',
          tamanho: 37,
          status: StatusItem.RESOLVIDO,
        },
        {
          pedidoId: pedido2.id,
          produtoId: null,
          descricaoBruta: 'REF DESCONHECIDA 38',
          skuBruto: 'SKU', // SKU inválido (<6 chars) — testa SkuReverseParser.error = SKU_TOO_SHORT
          quantidade: 6,
          unidade: 'UN',
          modelo: null,
          cor: null,
          corDescricao: null,
          tamanho: null,
          status: StatusItem.PENDENTE, // pendente porque SKU não parseável
        },
      ],
    })
  }

  const itemCount3 = await prisma.itemPedido.count({ where: { pedidoId: pedido3.id } })
  if (itemCount3 === 0) {
    await prisma.itemPedido.createMany({
      data: [
        {
          pedidoId: pedido3.id,
          produtoId: prod3.id,
          descricaoBruta: 'MULE SALTO BLOCO AZUL MARINHO 39',
          skuBruto: 'THS-003-005-39',
          quantidade: 30,
          unidade: 'UN',
          modelo: 'THS-003',
          cor: '005',
          corDescricao: 'Azul Marinho',
          tamanho: 39,
          status: StatusItem.PENDENTE, // pedido recém importado
        },
      ],
    })
  }
  console.log('✅ ItemPedido: 5 (RESOLVIDO×3, PENDENTE×2; SKU inválido coberto)')

  // --- Consolidado ---
  let consolidado = await prisma.consolidado.findFirst()
  if (!consolidado) {
    consolidado = await prisma.consolidado.create({ data: {} })
  }
  console.log('✅ Consolidado: 1')

  // =========================================================================
  // NÍVEL 3 — Entidades com FK para Nível 2
  // =========================================================================

  // --- ConsolidadoPedido (pedido1 + pedido2 no consolidado) ---
  await prisma.consolidadoPedido.upsert({
    where: { consolidadoId_pedidoId: { consolidadoId: consolidado.id, pedidoId: pedido1.id } },
    update: {},
    create: { consolidadoId: consolidado.id, pedidoId: pedido1.id },
  })
  await prisma.consolidadoPedido.upsert({
    where: { consolidadoId_pedidoId: { consolidadoId: consolidado.id, pedidoId: pedido2.id } },
    update: {},
    create: { consolidadoId: consolidado.id, pedidoId: pedido2.id },
  })
  console.log('✅ ConsolidadoPedido: 2 (pedido1 + pedido2)')

  // --- FichaProducao (cover todos os 4 Setores: CABEDAL, PALMILHA, SOLA, FACHETA) ---
  const fichaCount = await prisma.fichaProducao.count({ where: { pedidoId: pedido1.id } })
  if (fichaCount === 0) {
    await prisma.fichaProducao.createMany({
      data: [
        {
          pedidoId: pedido1.id,
          consolidadoId: consolidado.id,
          setor: Setor.CABEDAL,
          pdfUrl: 'https://example.com/fichas/pc-2026-001-cabedal.pdf',
          totalPares: 36,
          dadosJson: { pedido: 'PC-2026-001', setor: 'CABEDAL', cards: 2, modelos: ['THS-001'] },
        },
        {
          pedidoId: pedido1.id,
          consolidadoId: consolidado.id,
          setor: Setor.PALMILHA,
          pdfUrl: 'https://example.com/fichas/pc-2026-001-palmilha.pdf',
          totalPares: 36,
          dadosJson: { pedido: 'PC-2026-001', setor: 'PALMILHA', cards: 2, modelos: ['THS-001'] },
        },
        {
          pedidoId: pedido1.id,
          consolidadoId: consolidado.id,
          setor: Setor.SOLA,
          pdfUrl: 'https://example.com/fichas/pc-2026-001-sola.pdf',
          totalPares: 36,
          dadosJson: { pedido: 'PC-2026-001', setor: 'SOLA', cards: 2, modelos: ['THS-001'] },
        },
        {
          pedidoId: pedido1.id,
          consolidadoId: consolidado.id,
          setor: Setor.FACHETA,
          pdfUrl: 'https://example.com/fichas/pc-2026-001-facheta.pdf',
          totalPares: 24, // menor: THS-002 sem facheta foi filtrado
          dadosJson: { pedido: 'PC-2026-001', setor: 'FACHETA', cards: 1, modelos: ['THS-001'] },
        },
      ],
    })
  }
  console.log('✅ FichaProducao: 4 (CABEDAL, PALMILHA, SOLA, FACHETA)')

  // --- NotificacaoLog (2 tipos diferentes) ---
  const notifCount = await prisma.notificacaoLog.count()
  if (notifCount === 0) {
    await prisma.notificacaoLog.createMany({
      data: [
        {
          tipo: 'ficha_gerada',
          destinatario: 'cabedal@thamyshoes.com.br',
          conteudo: 'Ficha de CABEDAL gerada para pedido PC-2026-001 (36 pares, 2 cards)',
          enviadoEm: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        },
        {
          tipo: 'sku_parse_falha',
          destinatario: 'pcp@thamyshoes.com.br',
          conteudo: 'SKU "SKU" inválido no pedido PC-2026-002: erro SKU_TOO_SHORT',
          enviadoEm: new Date(now.getTime() - 6 * 60 * 60 * 1000),
        },
      ],
    })
  }
  console.log('✅ NotificacaoLog: 2 (ficha_gerada, sku_parse_falha)')

  // =========================================================================
  // RESUMO
  // =========================================================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🌱 Seed concluído com sucesso!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
  console.log('  Nível 0 (base):')
  console.log('    User              5   ADMIN, PCP, PRODUCAO (CABEDAL/PALMILHA/SOLA)')
  console.log('    MapeamentoCor     6   com hex (×5) e sem hex (×1)')
  console.log('    Material          6   CABEDAL×2, SOLA×2, PALMILHA×2')
  console.log('    GradeNumeracao    2   33-37, 38-42')
  console.log('    RegraSkU          2   ativa=true, ativa=false')
  console.log('    RegraEquivalencia 2   REFERENCIA, GLOBAL')
  console.log('    BlingConnection   3   CONECTADO, EXPIRADO, DESCONECTADO')
  console.log('    CampoExtra        8   todos os setores × tipos; ativo=false coberto')
  console.log('  Nível 1:')
  console.log('    Produto           3   ativo=true (×2), ativo=false (×1)')
  console.log('    Modelo            3   facheta preenchida (×2), null (×1); ativo false coberto')
  console.log('    GradeModelo       3')
  console.log('    PedidoCompra      3   IMPORTADO, PENDENTE_AJUSTE, FICHAS_GERADAS')
  console.log('  Nível 2:')
  console.log('    ModeloVarianteCor 5   imagemUrl presente (×3), null (×2)')
  console.log('    ItemPedido        5   RESOLVIDO (×3), PENDENTE (×2); SKU inválido (×1)')
  console.log('    Consolidado       1')
  console.log('  Nível 3:')
  console.log('    ConsolidadoPedido 2')
  console.log('    FichaProducao     4   CABEDAL, PALMILHA, SOLA, FACHETA')
  console.log('    NotificacaoLog    2')
  console.log('')
  console.log('  Credenciais de seed: Thamy@2026')
  console.log('  ⚠️  Altere as senhas em produção!')
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
