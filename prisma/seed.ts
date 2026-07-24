import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 A limpar dados existentes...");
  await prisma.workOrderStep.deleteMany();
  await prisma.nonConformity.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.routingOperation.deleteMany();
  await prisma.operator.deleteMany();
  await prisma.workstation.deleteMany();
  await prisma.requestMessage.deleteMany();
  await prisma.request.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.productPrice.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  console.log("🏭 A criar empresas...");
  const mota = await prisma.company.create({
    data: { name: "Auto Peças Mota, Lda." },
  });
  const santos = await prisma.company.create({
    data: { name: "Metalúrgica Santos, S.A." },
  });
  const norte = await prisma.company.create({
    data: { name: "Plásticos do Norte, Lda." },
  });

  console.log("👤 A criar utilizadores...");
  const hash = (pw: string) => bcrypt.hashSync(pw, 10);

  await prisma.user.create({
    data: {
      name: "Sofia Alves",
      email: "admin@jolucor.pt",
      passwordHash: hash("admin2026"),
      role: "ADMIN",
    },
  });
  await prisma.user.create({
    data: {
      name: "Jorge Mota",
      email: "compras@motapecas.pt",
      passwordHash: hash("mota2026"),
      role: "CLIENT",
      companyId: mota.id,
    },
  });
  await prisma.user.create({
    data: {
      name: "Ana Santos",
      email: "geral@metalsantos.pt",
      passwordHash: hash("santos2026"),
      role: "CLIENT",
      companyId: santos.id,
    },
  });
  await prisma.user.create({
    data: {
      name: "Rui Ferreira",
      email: "encomendas@plasticosnorte.pt",
      passwordHash: hash("pn2026"),
      role: "CLIENT",
      companyId: norte.id,
    },
  });

  console.log("🏭 A criar postos de trabalho e operadores...");
  const stationDefs = [
    { code: "CORTE", name: "Corte a Laser", clientStageLabel: "Corte", sequence: 1 },
    { code: "CNC", name: "Maquinação CNC", clientStageLabel: "Maquinação", sequence: 2 },
    { code: "SOLD", name: "Soldadura", clientStageLabel: "Montagem", sequence: 3 },
    { code: "ACAB", name: "Acabamento", clientStageLabel: "Acabamento", sequence: 4 },
    { code: "INSP", name: "Inspeção Final", clientStageLabel: "Controlo de Qualidade", sequence: 5 },
  ];
  const stations: Record<string, string> = {};
  for (const def of stationDefs) {
    const ws = await prisma.workstation.create({ data: def });
    stations[def.code] = ws.id;
  }

  const operatorDefs = [
    { name: "João Ferreira", pin: "1234" },
    { name: "Miguel Costa", pin: "2345" },
    { name: "Carla Sousa", pin: "3456" },
  ];
  const operators: Record<string, string> = {};
  for (const def of operatorDefs) {
    const op = await prisma.operator.create({
      data: { name: def.name, pinHash: hash(def.pin) },
    });
    operators[def.name] = op.id;
  }

  console.log("🛒 A criar catálogo de produtos...");
  await prisma.product.create({
    data: {
      reference: "PAR-M8-20-IX",
      name: "Parafuso M8×20 Inox A2",
      description:
        "Parafuso de cabeça sextavada M8×20 em aço inox A2, roscagem métrica.",
      unit: "un",
      unitPriceEur: 0.35,
      category: "Fixação",
      active: true,
      prices: { create: [{ companyId: mota.id, unitPriceEur: 0.31 }] },
    },
  });
  await prisma.product.create({
    data: {
      reference: "POR-M8-IX",
      name: "Porca Sextavada M8 Inox A2",
      description: "Porca sextavada M8 em aço inox A2, conforme DIN 934.",
      unit: "un",
      unitPriceEur: 0.18,
      category: "Fixação",
      active: true,
    },
  });
  await prisma.product.create({
    data: {
      reference: "ANI-M8-IX",
      name: "Anilha Plana M8 Inox",
      description: "Anilha plana M8 em aço inox, DIN 125.",
      unit: "un",
      unitPriceEur: 0.06,
      category: "Fixação",
      active: true,
    },
  });
  const chpProduct = await prisma.product.create({
    data: {
      reference: "CHP-2MM-AISI304",
      name: "Chapa Inox AISI 304 2mm",
      description:
        "Chapa de aço inoxidável AISI 304, espessura 2mm, acabamento 2B. Preço por m².",
      unit: "m²",
      unitPriceEur: 48.5,
      category: "Chapa",
      active: true,
      prices: {
        create: [
          { companyId: santos.id, unitPriceEur: 44.0 },
          { companyId: mota.id, unitPriceEur: 46.75 },
        ],
      },
    },
  });
  const perfProduct = await prisma.product.create({
    data: {
      reference: "PERF-L40-INOX",
      name: "Perfil L 40×40×4 Inox",
      description: "Cantoneira em L de aço inox 40×40×4mm. Preço por metro.",
      unit: "m",
      unitPriceEur: 12.9,
      category: "Perfis",
      active: true,
    },
  });
  await prisma.product.create({
    data: {
      reference: "TUB-INOX-30",
      name: "Tubo Inox Ø30 1.5mm",
      description: "Tubo redondo em aço inox Ø30mm, parede 1.5mm. Preço por metro.",
      unit: "m",
      unitPriceEur: 9.4,
      category: "Perfis",
      active: false,
    },
  });

  console.log("🧭 A criar roteiros de produção...");
  await prisma.routingOperation.createMany({
    data: [
      { productId: chpProduct.id, sequence: 1, name: "Corte a Laser", workstationId: stations.CORTE, plannedMinutes: 25 },
      { productId: chpProduct.id, sequence: 2, name: "Quinagem", workstationId: stations.CNC, plannedMinutes: 40 },
      { productId: chpProduct.id, sequence: 3, name: "Acabamento", workstationId: stations.ACAB, plannedMinutes: 20 },
      { productId: chpProduct.id, sequence: 4, name: "Inspeção Final", workstationId: stations.INSP, plannedMinutes: 15 },
      { productId: perfProduct.id, sequence: 1, name: "Corte", workstationId: stations.CORTE, plannedMinutes: 15 },
      { productId: perfProduct.id, sequence: 2, name: "Soldadura", workstationId: stations.SOLD, plannedMinutes: 35 },
      { productId: perfProduct.id, sequence: 3, name: "Inspeção Final", workstationId: stations.INSP, plannedMinutes: 10 },
    ],
  });

  console.log("📦 A criar encomendas...");
  const ord041 = await prisma.order.create({
    data: {
      reference: "ENC-2026-041",
      companyId: mota.id,
      status: "delivered",
      priority: "normal",
      batchNumber: "LT-2026-041",
      createdDate: new Date("2026-05-10"),
      expectedDate: new Date("2026-05-28"),
      shippedDate: new Date("2026-05-26"),
      deliveredDate: new Date("2026-05-27"),
      qualityNotes:
        "Todos os parâmetros dentro das tolerâncias definidas. Certificado ISO 9001 aplicável.",
      items: {
        create: [
          { reference: "PAR-M8-20-IX", description: "Parafuso M8×20 Inox A2", quantity: 500, unit: "un", unitPriceEur: 0.35 },
          { reference: "POR-M8-IX", description: "Porca Sextavada M8 Inox A2", quantity: 500, unit: "un", unitPriceEur: 0.18 },
          { reference: "ANI-M8-IX", description: "Anilha Plana M8 Inox", quantity: 1000, unit: "un", unitPriceEur: 0.06 },
        ],
      },
    },
    include: { items: true },
  });
  const ord058 = await prisma.order.create({
    data: {
      reference: "ENC-2026-058",
      companyId: mota.id,
      status: "production",
      priority: "urgent",
      batchNumber: "LT-2026-058",
      createdDate: new Date("2026-06-12"),
      expectedDate: new Date("2026-07-05"),
      observations: "Material certificado EN ISO 4014 obrigatório.",
      items: {
        create: [
          { reference: "CHU-6205-ZZ", description: "Chumaceira Rolamento SKF 6205-ZZ", quantity: 50, unit: "un", unitPriceEur: 4.8 },
          { reference: "RET-35-55-8", description: "Retentor 35×55×8 NBR", quantity: 100, unit: "un", unitPriceEur: 1.2 },
        ],
      },
    },
    include: { items: true },
  });
  await prisma.order.create({
    data: {
      reference: "ENC-2026-052",
      companyId: santos.id,
      status: "shipped",
      priority: "normal",
      batchNumber: "LT-2026-052",
      createdDate: new Date("2026-05-28"),
      expectedDate: new Date("2026-06-20"),
      shippedDate: new Date("2026-06-18"),
      qualityNotes:
        "Chapas inspecionadas por amostragem (10%). Planicidade e dimensões conformes.",
      items: {
        create: [
          { reference: "CHP-S235-200", description: "Chapa Aço S235 200×200×5mm", quantity: 50, unit: "un", unitPriceEur: 18.5 },
          { reference: "CHP-S235-400", description: "Chapa Aço S235 400×200×5mm", quantity: 20, unit: "un", unitPriceEur: 32.0 },
        ],
      },
    },
  });
  await prisma.order.create({
    data: {
      reference: "ENC-2026-061",
      companyId: santos.id,
      status: "quality",
      priority: "normal",
      batchNumber: "LT-2026-061",
      createdDate: new Date("2026-06-15"),
      expectedDate: new Date("2026-07-10"),
      items: {
        create: [
          { reference: "PER-U-40-3", description: "Perfil em U 40×40×3mm St52", quantity: 30, unit: "m", unitPriceEur: 8.2 },
          { reference: "PER-L-50-4", description: "Cantoneira L 50×50×4mm St52", quantity: 20, unit: "m", unitPriceEur: 6.4 },
        ],
      },
    },
  });
  await prisma.order.create({
    data: {
      reference: "ENC-2026-044",
      companyId: norte.id,
      status: "delivered",
      priority: "normal",
      batchNumber: "LT-2026-044",
      createdDate: new Date("2026-05-05"),
      expectedDate: new Date("2026-05-25"),
      shippedDate: new Date("2026-05-22"),
      deliveredDate: new Date("2026-05-23"),
      qualityNotes:
        "Componentes sem rebarbas, cor e dimensional conforme ficha técnica aprovada.",
      items: {
        create: [
          { reference: "INJ-PP-A100", description: "Injetado PP Tampa Ref. A100", quantity: 200, unit: "un", unitPriceEur: 3.2 },
          { reference: "INJ-PP-B200", description: "Injetado PP Base Ref. B200", quantity: 200, unit: "un", unitPriceEur: 4.1 },
        ],
      },
    },
  });
  await prisma.order.create({
    data: {
      reference: "ENC-2026-067",
      companyId: norte.id,
      status: "pending",
      priority: "normal",
      batchNumber: "LT-2026-067",
      createdDate: new Date("2026-06-28"),
      expectedDate: new Date("2026-07-20"),
      observations: "Utilizar matéria-prima ABS Flame Retardant V0.",
      items: {
        create: [
          { reference: "INJ-ABS-C300", description: "Injetado ABS Suporte Ref. C300", quantity: 100, unit: "un", unitPriceEur: 4.8 },
          { reference: "INJ-ABS-D400", description: "Injetado ABS Clip Ref. D400", quantity: 300, unit: "un", unitPriceEur: 1.9 },
        ],
      },
    },
  });

  console.log("🏭 A criar ordens de fabrico...");
  const now = new Date();
  const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000);

  // ENC-2026-058 (urgente, em produção) — 1ª OF a meio, 2ª lançada.
  const wo001 = await prisma.workOrder.create({
    data: {
      reference: "OF-2026-001",
      orderId: ord058.id,
      orderItemId: ord058.items[0].id,
      productRef: ord058.items[0].reference,
      productName: ord058.items[0].description,
      quantityPlanned: ord058.items[0].quantity,
      status: "in_progress",
      priority: "urgent",
      startedAt: minsAgo(180),
      steps: {
        create: [
          { sequence: 1, name: "Corte a Laser", workstationId: stations.CORTE, status: "done", plannedMinutes: 30, actualMinutes: 28, quantityDone: 50, finishedAt: minsAgo(150), startedAt: null, operatorId: operators["João Ferreira"] },
          { sequence: 2, name: "Maquinação CNC", workstationId: stations.CNC, status: "in_progress", plannedMinutes: 45, startedAt: minsAgo(25), operatorId: operators["Miguel Costa"] },
          { sequence: 3, name: "Acabamento", workstationId: stations.ACAB, status: "pending", plannedMinutes: 20 },
          { sequence: 4, name: "Inspeção Final", workstationId: stations.INSP, status: "pending", plannedMinutes: 15 },
        ],
      },
    },
    include: { steps: true },
  });

  const wo001Corte = wo001.steps.find((s) => s.sequence === 1);
  if (wo001Corte) {
    await prisma.nonConformity.create({
      data: {
        workOrderId: wo001.id,
        stepId: wo001Corte.id,
        quantity: 3,
        reason: "Rebarba excessiva no bordo cortado",
        disposition: "rework",
        operatorId: operators["João Ferreira"],
      },
    });
  }
  await prisma.workOrder.create({
    data: {
      reference: "OF-2026-002",
      orderId: ord058.id,
      orderItemId: ord058.items[1].id,
      productRef: ord058.items[1].reference,
      productName: ord058.items[1].description,
      quantityPlanned: ord058.items[1].quantity,
      status: "released",
      priority: "urgent",
      steps: {
        create: [
          { sequence: 1, name: "Corte a Laser", workstationId: stations.CORTE, status: "pending", plannedMinutes: 25 },
          { sequence: 2, name: "Acabamento", workstationId: stations.ACAB, status: "pending", plannedMinutes: 20 },
          { sequence: 3, name: "Inspeção Final", workstationId: stations.INSP, status: "pending", plannedMinutes: 15 },
        ],
      },
    },
  });

  // ENC-2026-041 (entregue) — OF concluída, para a coluna "Concluída".
  await prisma.workOrder.create({
    data: {
      reference: "OF-2026-003",
      orderId: ord041.id,
      orderItemId: ord041.items[0].id,
      productRef: ord041.items[0].reference,
      productName: ord041.items[0].description,
      quantityPlanned: ord041.items[0].quantity,
      quantityDone: ord041.items[0].quantity,
      status: "done",
      startedAt: new Date("2026-05-20T08:00:00"),
      finishedAt: new Date("2026-05-22T16:00:00"),
      steps: {
        create: [
          { sequence: 1, name: "Corte a Laser", workstationId: stations.CORTE, status: "done", plannedMinutes: 30, actualMinutes: 32, quantityDone: 500, operatorId: operators["João Ferreira"] },
          { sequence: 2, name: "Acabamento", workstationId: stations.ACAB, status: "done", plannedMinutes: 20, actualMinutes: 18, quantityDone: 500, operatorId: operators["Carla Sousa"] },
          { sequence: 3, name: "Inspeção Final", workstationId: stations.INSP, status: "done", plannedMinutes: 15, actualMinutes: 14, quantityDone: 500, operatorId: operators["Carla Sousa"] },
        ],
      },
    },
  });

  console.log("✉️  A criar requerimentos...");
  await prisma.request.create({
    data: {
      reference: "REQ-2026-001",
      companyId: mota.id,
      type: "quote",
      subject: "Orçamento para parafusos M10 grau 10.9",
      status: "responded",
      createdDate: new Date("2026-06-20"),
      messages: {
        create: [
          {
            from: "client",
            authorName: "Jorge Mota",
            text: "Bom dia,\n\nNecessitamos de um orçamento para 2000 parafusos M10×50 grau 10.9, zincados. Prazo de entrega pretendido: até 15 de Julho.\n\nObrigado,\nJorge Mota",
            date: new Date("2026-06-20T09:15:00"),
          },
          {
            from: "admin",
            authorName: "Sofia Alves",
            text: "Bom dia Jorge,\n\nAgradecemos o vosso pedido. Temos disponibilidade para fornecer os parafusos M10×50 grau 10.9 zincados ao preço de 0,48€/un (quantidade ≥ 2000). Prazo de entrega: 10 dias úteis.\n\nEnvio proposta formal em anexo brevemente.\n\nCom os melhores cumprimentos,\nSofia Alves",
            date: new Date("2026-06-20T14:32:00"),
          },
        ],
      },
    },
  });
  await prisma.request.create({
    data: {
      reference: "REQ-2026-002",
      companyId: santos.id,
      type: "info",
      subject: "Previsão de entrega da encomenda ENC-2026-061",
      status: "in_review",
      createdDate: new Date("2026-06-28"),
      messages: {
        create: [
          {
            from: "client",
            authorName: "Ana Santos",
            text: "Boa tarde,\n\nVim informar que a encomenda ENC-2026-061 (Perfis em U e Cantoneiras) está em fase de controlo de qualidade. Necessitamos de uma previsão mais concreta da data de expedição, pois temos obra marcada para o dia 14 de Julho.\n\nObrigada,\nAna Santos",
            date: new Date("2026-06-28T16:05:00"),
          },
        ],
      },
    },
  });
  await prisma.request.create({
    data: {
      reference: "REQ-2026-003",
      companyId: norte.id,
      type: "complaint",
      subject: "Não conformidade na encomenda ENC-2026-044",
      status: "responded",
      createdDate: new Date("2026-06-02"),
      messages: {
        create: [
          {
            from: "client",
            authorName: "Rui Ferreira",
            text: "Exmo. Sr./Sra.,\n\nDetectámos que 15 unidades da encomenda ENC-2026-044 (Tampa Ref. A100) apresentam rebarbas visíveis na zona de injeção, não conformes com a ficha técnica aprovada. Solicito análise e resolução.\n\nRui Ferreira",
            date: new Date("2026-06-02T10:20:00"),
          },
          {
            from: "admin",
            authorName: "Sofia Alves",
            text: "Exmo. Sr. Ferreira,\n\nAgradecemos a comunicação. Confirmaremos a não conformidade junto do responsável de qualidade e daremos resposta em 48h. As peças não conformes serão substituídas sem custo adicional.\n\nPedimos desculpa pelo inconveniente.\n\nCom os melhores cumprimentos,\nSofia Alves",
            date: new Date("2026-06-02T15:45:00"),
          },
          {
            from: "client",
            authorName: "Rui Ferreira",
            text: "Bom dia Sofia,\n\nObrigado pela resposta rápida. Aguardamos a recolha e substituição das peças.\n\nRui Ferreira",
            date: new Date("2026-06-03T09:10:00"),
          },
        ],
      },
    },
  });

  console.log("✅ Seed concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
