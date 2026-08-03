import { prisma } from "@/lib/prisma";
import type {
  OrderVM,
  OrderSummaryVM,
  RequestVM,
  RequestSummaryVM,
  RequestMessageVM,
  ProductVM,
  CatalogProductVM,
  WorkOrderVM,
  WorkOrderStepVM,
  WorkstationVM,
  TerminalStepVM,
  OrderProductionVM,
  WorkstationOptionVM,
  WorkstationLoadVM,
  WorkstationOeeVM,
  ProductRoutingVM,
  NonConformityVM,
  OperatorVM,
  MachineVM,
  DiscrepancyVM,
  MaterialVM,
  ProductBomVM,
  WorkOrderReadinessVM,
  StockMovementVM,
  QuoteVM,
  QuoteSummaryVM,
  QuoteLineVM,
  PricingSettingsVM,
} from "@/lib/types";
import { STOCK_REASON_LABELS } from "@/lib/types";
import { toIsoDate } from "@/lib/dates";
import {
  isStepReady,
  workOrderProgress,
  buildClientStages,
  computeOee,
  computeDiscrepancy,
  isMachineOnline,
} from "@/services/production-status";
import { getPricingSettings as getPricingSettingsService } from "@/services/quotes.service";
import type {
  Order,
  OrderItem,
  OrderDocument,
  Request,
  RequestMessage,
  Company,
  Quote,
  QuoteLine,
} from "@prisma/client";

type OrderSummaryWith = Order & { items: OrderItem[]; company: Company };
type OrderWith = OrderSummaryWith & { documents: OrderDocument[] };
type RequestWith = Request & { messages: RequestMessage[]; company: Company };
type RequestSummaryWith = Request & {
  messages: RequestMessage[];
  company: Company;
  _count: { messages: number };
};

function toOrderSummaryVM(o: OrderSummaryWith): OrderSummaryVM {
  return {
    id: o.id,
    reference: o.reference,
    companyId: o.companyId,
    clientCompany: o.company.name,
    status: o.status,
    priority: o.priority,
    createdDate: toIsoDate(o.createdDate),
    expectedDate: toIsoDate(o.expectedDate),
    shippedDate: o.shippedDate ? toIsoDate(o.shippedDate) : undefined,
    deliveredDate: o.deliveredDate ? toIsoDate(o.deliveredDate) : undefined,
    cancelledDate: o.cancelledDate ? toIsoDate(o.cancelledDate) : undefined,
    cancelReason: o.cancelReason ?? undefined,
    qualityNotes: o.qualityNotes ?? undefined,
    observations: o.observations ?? undefined,
    batchNumber: o.batchNumber,
    items: o.items.map((i) => ({
      id: i.id,
      reference: i.reference,
      description: i.description,
      quantity: i.quantity,
      unit: i.unit,
      unitPriceEur: i.unitPriceEur,
    })),
  };
}

function toOrderVM(o: OrderWith): OrderVM {
  return {
    ...toOrderSummaryVM(o),
    attachments: o.documents
      .map((d) => ({
        id: d.id,
        fileName: d.fileName,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        uploadedById: d.uploadedById,
        uploadedByName: d.uploadedByName,
        createdAt: d.createdAt.toISOString(),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

function toMessageVM(m: RequestMessage): RequestMessageVM {
  return {
    id: m.id,
    from: m.from,
    authorName: m.authorName,
    text: m.text,
    date: m.date.toISOString(),
  };
}

function toRequestVM(r: RequestWith): RequestVM {
  return {
    id: r.id,
    reference: r.reference,
    companyId: r.companyId,
    clientCompany: r.company.name,
    type: r.type,
    subject: r.subject,
    status: r.status,
    createdDate: toIsoDate(r.createdDate),
    messages: r.messages.map(toMessageVM),
  };
}

function toRequestSummaryVM(r: RequestSummaryWith): RequestSummaryVM {
  return {
    id: r.id,
    reference: r.reference,
    companyId: r.companyId,
    clientCompany: r.company.name,
    type: r.type,
    subject: r.subject,
    status: r.status,
    createdDate: toIsoDate(r.createdDate),
    // Fetched with `orderBy: date desc, take: 1`, so [0] is the latest message.
    lastMessage: r.messages[0] ? toMessageVM(r.messages[0]) : null,
    messageCount: r._count.messages,
  };
}

export async function getOrdersForCompany(
  companyId: string,
): Promise<OrderSummaryVM[]> {
  const orders = await prisma.order.findMany({
    where: { companyId },
    include: { items: true, company: true },
    orderBy: { createdDate: "desc" },
  });
  return orders.map(toOrderSummaryVM);
}

export async function getAllOrders(): Promise<OrderSummaryVM[]> {
  const orders = await prisma.order.findMany({
    include: { items: true, company: true },
    orderBy: { createdDate: "desc" },
  });
  return orders.map(toOrderSummaryVM);
}

export async function getOrderById(id: string): Promise<OrderVM | null> {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, documents: true, company: true },
  });
  return order ? toOrderVM(order) : null;
}

export async function getRequestsForCompany(
  companyId: string,
): Promise<RequestSummaryVM[]> {
  const requests = await prisma.request.findMany({
    where: { companyId },
    include: {
      company: true,
      messages: { orderBy: { date: "desc" }, take: 1 },
      _count: { select: { messages: true } },
    },
    orderBy: { createdDate: "desc" },
  });
  return requests.map(toRequestSummaryVM);
}

export async function getAllRequests(): Promise<RequestSummaryVM[]> {
  const requests = await prisma.request.findMany({
    include: {
      company: true,
      messages: { orderBy: { date: "desc" }, take: 1 },
      _count: { select: { messages: true } },
    },
    orderBy: { createdDate: "desc" },
  });
  return requests.map(toRequestSummaryVM);
}

export async function getRequestById(id: string): Promise<RequestVM | null> {
  const request = await prisma.request.findUnique({
    where: { id },
    include: { messages: { orderBy: { date: "asc" } }, company: true },
  });
  return request ? toRequestVM(request) : null;
}

function toQuoteLineVM(l: QuoteLine): QuoteLineVM {
  return {
    id: l.id,
    sequence: l.sequence,
    description: l.description,
    operation: l.operation,
    quantity: l.quantity,
    unit: l.unit,
    materialWeightKg: l.materialWeightKg,
    laserMinutes: l.laserMinutes,
    bendCount: l.bendCount,
    weldingMinutes: l.weldingMinutes,
    finishingM2: l.finishingM2,
    unitCostEur: l.unitCostEur,
    lineTotalEur: l.lineTotalEur,
  };
}

function toQuoteBase(q: Quote & { company: Company }) {
  return {
    id: q.id,
    reference: q.reference,
    companyId: q.companyId,
    clientCompany: q.company.name,
    subject: q.subject,
    notes: q.notes,
    status: q.status,
    marginPercent: q.marginPercent,
    totalEur: q.totalEur,
    validUntil: q.validUntil ? toIsoDate(q.validUntil) : null,
    orderId: q.orderId,
    createdDate: toIsoDate(q.createdDate),
    sentAt: q.sentAt ? q.sentAt.toISOString() : null,
    decidedAt: q.decidedAt ? q.decidedAt.toISOString() : null,
  };
}

export async function getQuotesForCompany(companyId: string): Promise<QuoteSummaryVM[]> {
  const quotes = await prisma.quote.findMany({
    where: { companyId, status: { not: "draft" } },
    include: { company: true, _count: { select: { lines: true } } },
    orderBy: { createdDate: "desc" },
  });
  return quotes.map((q) => ({ ...toQuoteBase(q), lineCount: q._count.lines }));
}

export async function getAllQuotes(): Promise<QuoteSummaryVM[]> {
  const quotes = await prisma.quote.findMany({
    include: { company: true, _count: { select: { lines: true } } },
    orderBy: { createdDate: "desc" },
  });
  return quotes.map((q) => ({ ...toQuoteBase(q), lineCount: q._count.lines }));
}

export async function getQuoteById(id: string): Promise<QuoteVM | null> {
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { company: true, lines: { orderBy: { sequence: "asc" } } },
  });
  if (!quote) return null;
  return { ...toQuoteBase(quote), lines: quote.lines.map(toQuoteLineVM) };
}

export async function getPricingSettingsVM(): Promise<PricingSettingsVM> {
  const s = await getPricingSettingsService();
  return {
    steelPriceEurKg: s.steelPriceEurKg,
    laserEurPerMinute: s.laserEurPerMinute,
    bendEurPerBend: s.bendEurPerBend,
    weldingEurPerMinute: s.weldingEurPerMinute,
    finishingEurPerM2: s.finishingEurPerM2,
    defaultMarginPercent: s.defaultMarginPercent,
  };
}

export async function getCompanies() {
  return prisma.company.findMany({ orderBy: { name: "asc" } });
}


export async function getProducts(): Promise<ProductVM[]> {
  const products = await prisma.product.findMany({
    include: { prices: { include: { company: true } } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return products.map((p) => ({
    id: p.id,
    reference: p.reference,
    name: p.name,
    description: p.description,
    unit: p.unit,
    unitPriceEur: p.unitPriceEur,
    category: p.category,
    imageUrl: p.imageUrl,
    active: p.active,
    companyPrices: p.prices.map((pr) => ({
      companyId: pr.companyId,
      companyName: pr.company.name,
      unitPriceEur: pr.unitPriceEur,
    })),
  }));
}

export async function getCatalogForCompany(
  companyId: string,
): Promise<CatalogProductVM[]> {
  const products = await prisma.product.findMany({
    where: { active: true },
    include: { prices: { where: { companyId } } },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return products.map((p) => ({
    id: p.id,
    reference: p.reference,
    name: p.name,
    description: p.description,
    unit: p.unit,
    unitPriceEur: p.prices[0]?.unitPriceEur ?? p.unitPriceEur,
    category: p.category,
    imageUrl: p.imageUrl,
  }));
}

// ── Produção (Ordens de Fabrico) ────────────────────────────────────────────

type StepWith = {
  id: string;
  sequence: number;
  name: string;
  workstationId: string;
  status: import("@prisma/client").StepStatus;
  plannedMinutes: number;
  actualMinutes: number;
  quantityDone: number;
  scrapQty: number;
  workstation: { name: string; clientStageLabel: string; sequence: number };
  operator: { name: string } | null;
};

function toStepVM(step: StepWith, allSteps: StepWith[]): WorkOrderStepVM {
  return {
    id: step.id,
    sequence: step.sequence,
    name: step.name,
    workstationId: step.workstationId,
    workstationName: step.workstation.name,
    clientStageLabel: step.workstation.clientStageLabel,
    status: step.status,
    plannedMinutes: step.plannedMinutes,
    actualMinutes: Math.round(step.actualMinutes),
    quantityDone: step.quantityDone,
    scrapQty: step.scrapQty,
    operatorName: step.operator?.name ?? null,
    ready: isStepReady(step, allSteps),
  };
}

export async function getWorkOrders(): Promise<WorkOrderVM[]> {
  const workOrders = await prisma.workOrder.findMany({
    include: {
      order: { include: { company: true } },
      materials: { include: { material: true }, orderBy: { materialRef: "asc" } },
      steps: {
        include: { workstation: true, operator: true },
        orderBy: { sequence: "asc" },
      },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  return workOrders.map((wo) => {
    const shortfalls = wo.materials
      .filter((m) => m.material.stockQty < m.requiredQty)
      .map((m) => ({
        reference: m.materialRef,
        name: m.materialName,
        unit: m.unit,
        missingQty:
          Math.round((m.requiredQty - m.material.stockQty) * 1000) / 1000,
      }));

    return {
      id: wo.id,
      reference: wo.reference,
      orderId: wo.orderId,
      orderReference: wo.order.reference,
      clientCompany: wo.order.company.name,
      productRef: wo.productRef,
      productName: wo.productName,
      quantityPlanned: wo.quantityPlanned,
      quantityDone: wo.quantityDone,
      status: wo.status,
      priority: wo.priority,
      progress: workOrderProgress(wo.steps),
      plannedEnd: wo.plannedEnd ? toIsoDate(wo.plannedEnd) : undefined,
      steps: wo.steps.map((s) => toStepVM(s, wo.steps)),
      materialStatus: {
        hasBom: wo.materials.length > 0,
        canRelease: shortfalls.length === 0,
        shortfalls,
      },
    };
  });
}

export async function getActiveOperators(): Promise<
  { id: string; name: string }[]
> {
  return prisma.operator.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getWorkstationsWithQueue(): Promise<WorkstationVM[]> {
  const workstations = await prisma.workstation.findMany({
    where: { active: true },
    orderBy: { sequence: "asc" },
    include: {
      steps: {
        where: {
          status: { in: ["pending", "in_progress", "paused"] },
          workOrder: { status: { in: ["released", "in_progress"] } },
        },
        include: {
          workOrder: { include: { steps: { select: { sequence: true, status: true } } } },
        },
      },
    },
  });

  return workstations.map((ws) => {
    const queueCount = ws.steps.filter((s) =>
      isStepReady(s, s.workOrder.steps),
    ).length;
    return {
      id: ws.id,
      code: ws.code,
      name: ws.name,
      clientStageLabel: ws.clientStageLabel,
      active: ws.active,
      queueCount,
    };
  });
}

export async function getTerminalQueue(
  workstationId: string,
): Promise<TerminalStepVM[]> {
  const steps = await prisma.workOrderStep.findMany({
    where: {
      workstationId,
      status: { in: ["pending", "in_progress", "paused"] },
      workOrder: { status: { in: ["released", "in_progress"] } },
    },
    include: {
      machine: { select: { name: true } },
      workstation: { select: { machines: { select: { name: true }, take: 1 } } },
      workOrder: {
        include: {
          order: { select: { reference: true } },
          steps: { select: { sequence: true, status: true } },
        },
      },
    },
  });

  return steps
    .filter((s) => isStepReady(s, s.workOrder.steps))
    .map((s) => ({
      stepId: s.id,
      workOrderId: s.workOrderId,
      workOrderReference: s.workOrder.reference,
      orderReference: s.workOrder.order.reference,
      productName: s.workOrder.productName,
      sequence: s.sequence,
      stepName: s.name,
      status: s.status,
      quantityPlanned: s.workOrder.quantityPlanned,
      quantityDone: s.quantityDone,
      plannedMinutes: s.plannedMinutes,
      priority: s.workOrder.priority,
      machineName: s.machine?.name ?? s.workstation.machines[0]?.name ?? null,
      machineVerified: s.machineVerified,
    }))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority === "urgent" ? -1 : 1;
      return a.orderReference.localeCompare(b.orderReference);
    });
}

export async function getOrdersWithoutProduction(): Promise<
  { id: string; reference: string; clientCompany: string; itemCount: number }[]
> {
  const orders = await prisma.order.findMany({
    where: {
      status: { in: ["pending", "production"] },
      items: { some: { workOrders: { none: {} } } },
    },
    include: { company: true, _count: { select: { items: true } } },
    orderBy: { createdDate: "desc" },
  });
  return orders.map((o) => ({
    id: o.id,
    reference: o.reference,
    clientCompany: o.company.name,
    itemCount: o._count.items,
  }));
}

/**
 * Client-facing production summary for an order: abstracted stage stepper and
 * overall progress, with no machine or operator names. Returns null when the
 * order has no production planned yet.
 */
export async function getOrderProduction(
  orderId: string,
): Promise<OrderProductionVM | null> {
  const workOrders = await prisma.workOrder.findMany({
    where: { orderId, status: { notIn: ["planned", "cancelled"] } },
    include: {
      steps: {
        include: { workstation: { select: { clientStageLabel: true, sequence: true } } },
      },
    },
  });
  if (workOrders.length === 0) return null;

  const allSteps = workOrders.flatMap((wo) => wo.steps);
  if (allSteps.length === 0) return null;

  const stages = buildClientStages(
    allSteps.map((s) => ({
      clientStageLabel: s.workstation.clientStageLabel,
      stationSequence: s.workstation.sequence,
      stepStatus: s.status,
    })),
  );

  const plannedEnds = workOrders
    .map((wo) => wo.plannedEnd)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime());

  return {
    progress: workOrderProgress(allSteps),
    stages,
    estimatedCompletion: plannedEnds[0] ? toIsoDate(plannedEnds[0]) : undefined,
  };
}

export async function getWorkstationOptions(): Promise<WorkstationOptionVM[]> {
  const workstations = await prisma.workstation.findMany({
    where: { active: true },
    orderBy: { sequence: "asc" },
    select: { id: true, name: true, clientStageLabel: true },
  });
  return workstations;
}

export async function getProductsWithRouting(): Promise<ProductRoutingVM[]> {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: { routing: { orderBy: { sequence: "asc" } } },
  });
  return products.map((p) => ({
    id: p.id,
    reference: p.reference,
    name: p.name,
    operations: p.routing.map((op) => ({
      name: op.name,
      workstationId: op.workstationId,
      plannedMinutes: op.plannedMinutes,
    })),
  }));
}

export async function getWorkstationLoad(): Promise<WorkstationLoadVM[]> {  const workstations = await prisma.workstation.findMany({
    where: { active: true },
    orderBy: { sequence: "asc" },
    include: {
      steps: {
        where: {
          status: { in: ["pending", "in_progress", "paused"] },
          workOrder: { status: { in: ["released", "in_progress"] } },
        },
        include: {
          workOrder: {
            select: {
              id: true,
              steps: { select: { sequence: true, status: true } },
            },
          },
        },
      },
    },
  });

  return workstations.map((ws) => {
    let activeMinutes = 0;
    let waitingMinutes = 0;
    let readyCount = 0;
    const workOrderIds = new Set<string>();

    for (const step of ws.steps) {
      const minutes = step.plannedMinutes ?? 0;
      if (step.status === "in_progress") activeMinutes += minutes;
      else waitingMinutes += minutes;
      if (isStepReady(step, step.workOrder.steps)) readyCount += 1;
      workOrderIds.add(step.workOrder.id);
    }

    return {
      id: ws.id,
      name: ws.name,
      clientStageLabel: ws.clientStageLabel,
      activeMinutes,
      waitingMinutes,
      totalMinutes: activeMinutes + waitingMinutes,
      stepCount: ws.steps.length,
      workOrderCount: workOrderIds.size,
      readyCount,
    };
  });
}

export async function getOpenNonConformities(): Promise<NonConformityVM[]> {
  const ncs = await prisma.nonConformity.findMany({
    where: { status: "open" },
    orderBy: { createdAt: "desc" },
    include: {
      workOrder: { select: { reference: true, orderId: true, productName: true } },
      step: { select: { name: true, status: true } },
      operator: { select: { name: true } },
    },
  });

  return ncs.map((nc) => ({
    id: nc.id,
    workOrderRef: nc.workOrder.reference,
    productName: nc.workOrder.productName,
    orderId: nc.workOrder.orderId,
    stepId: nc.stepId,
    stepName: nc.step?.name ?? null,
    quantity: nc.quantity,
    reason: nc.reason,
    disposition: nc.disposition,
    canRework:
      nc.disposition === "rework" &&
      nc.stepId !== null &&
      nc.step?.status === "done",
    operatorName: nc.operator?.name ?? null,
    createdAt: nc.createdAt.toISOString(),
  }));
}

export async function getWorkstationOee(): Promise<WorkstationOeeVM[]> {
  const workstations = await prisma.workstation.findMany({
    where: { active: true },
    orderBy: { sequence: "asc" },
    include: {
      steps: {
        where: { status: "done" },
        select: {
          plannedMinutes: true,
          actualMinutes: true,
          downtimeMinutes: true,
          quantityDone: true,
          scrapQty: true,
        },
      },
    },
  });

  return workstations.map((ws) => {
    const oee = computeOee(ws.steps);
    return {
      id: ws.id,
      name: ws.name,
      clientStageLabel: ws.clientStageLabel,
      availability: oee.availability,
      performance: oee.performance,
      quality: oee.quality,
      oee: oee.oee,
      completedSteps: ws.steps.length,
      runtimeMinutes: oee.runtimeMinutes,
      downtimeMinutes: oee.downtimeMinutes,
    };
  });
}

export async function getFactoryOee(): Promise<WorkstationOeeVM | null> {
  const steps = await prisma.workOrderStep.findMany({
    where: { status: "done", workstation: { active: true } },
    select: {
      plannedMinutes: true,
      actualMinutes: true,
      downtimeMinutes: true,
      quantityDone: true,
      scrapQty: true,
    },
  });
  if (steps.length === 0) return null;
  const oee = computeOee(steps);
  return {
    id: "factory",
    name: "Fábrica",
    clientStageLabel: "",
    availability: oee.availability,
    performance: oee.performance,
    quality: oee.quality,
    oee: oee.oee,
    completedSteps: steps.length,
    runtimeMinutes: oee.runtimeMinutes,
    downtimeMinutes: oee.downtimeMinutes,
  };
}

export async function getOperatorsWithStats(): Promise<OperatorVM[]> {
  const operators = await prisma.operator.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      steps: {
        where: { status: "done" },
        select: {
          plannedMinutes: true,
          actualMinutes: true,
          downtimeMinutes: true,
          quantityDone: true,
          scrapQty: true,
        },
      },
    },
  });

  return operators.map((op) => {
    const oee = computeOee(op.steps);
    const output = op.steps.reduce((sum, s) => sum + s.quantityDone, 0);
    return {
      id: op.id,
      name: op.name,
      active: op.active,
      completedSteps: op.steps.length,
      output,
      efficiency: oee.performance,
      quality: oee.quality,
      avgMinutes:
        op.steps.length > 0 ? oee.runtimeMinutes / op.steps.length : 0,
    };
  });
}

export async function getMachinesWithStatus(): Promise<MachineVM[]> {
  const now = new Date();
  const machines = await prisma.machine.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { workstation: { select: { id: true, name: true } } },
  });

  const result: MachineVM[] = [];
  for (const m of machines) {
    let currentProduct: string | null = null;
    let currentQty = 0;
    let currentScrap = 0;
    if (m.workstationId) {
      const step = await prisma.workOrderStep.findFirst({
        where: { workstationId: m.workstationId, status: "in_progress" },
        orderBy: { startedAt: "asc" },
        select: {
          quantityDone: true,
          scrapQty: true,
          workOrder: { select: { productName: true } },
        },
      });
      if (step) {
        currentProduct = step.workOrder.productName;
        currentQty = step.quantityDone;
        currentScrap = step.scrapQty;
      }
    }
    result.push({
      id: m.id,
      code: m.code,
      name: m.name,
      active: m.active,
      online: m.state !== "offline" && isMachineOnline(m.lastSeenAt, now),
      state: (m.state as MachineVM["state"]) ?? "offline",
      lastSeenAt: m.lastSeenAt ? m.lastSeenAt.toISOString() : null,
      stationName: m.workstation?.name ?? null,
      stationId: m.workstation?.id ?? null,
      currentProduct,
      currentQty,
      currentScrap,
    });
  }
  return result;
}

export async function getRecentDiscrepancies(
  limit = 20,
): Promise<DiscrepancyVM[]> {
  const steps = await prisma.workOrderStep.findMany({
    where: { machineVerified: true, status: "done" },
    orderBy: { finishedAt: "desc" },
    take: limit,
    include: {
      workstation: { select: { name: true } },
      operator: { select: { name: true } },
      machine: { select: { name: true } },
      workOrder: {
        select: {
          productName: true,
          order: { select: { reference: true } },
        },
      },
    },
  });

  return steps.map((s) => {
    const d = computeDiscrepancy(s.declaredQty, s.quantityDone);
    return {
      stepId: s.id,
      productName: s.workOrder.productName,
      orderReference: s.workOrder.order.reference,
      stationName: s.workstation.name,
      operatorName: s.operator?.name ?? null,
      machineName: s.machine?.name ?? null,
      declaredQty: s.declaredQty,
      machineQty: s.quantityDone,
      delta: d.delta,
      flagged: d.flagged,
      finishedAt: s.finishedAt ? s.finishedAt.toISOString() : null,
    };
  });
}

// ── Armazém / Stock ──────────────────────────────────────────────────────────

export async function getMaterials(): Promise<MaterialVM[]> {
  const materials = await prisma.material.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return materials.map((m) => ({
    id: m.id,
    reference: m.reference,
    name: m.name,
    unit: m.unit,
    stockQty: m.stockQty,
    minStockQty: m.minStockQty,
    active: m.active,
    belowMin: m.active && m.stockQty < m.minStockQty,
  }));
}

export async function getProductsWithBom(): Promise<ProductBomVM[]> {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: { bom: true },
  });
  return products.map((p) => ({
    id: p.id,
    reference: p.reference,
    name: p.name,
    items: p.bom.map((b) => ({
      materialId: b.materialId,
      qtyPerUnit: b.qtyPerUnit,
    })),
  }));
}

/** Planned work orders with live material availability, for the release gate. */
export async function getWorkOrdersAwaitingMaterials(): Promise<
  WorkOrderReadinessVM[]
> {
  const workOrders = await prisma.workOrder.findMany({
    where: { status: "planned" },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    include: {
      materials: { include: { material: true }, orderBy: { materialRef: "asc" } },
      order: { include: { company: true } },
    },
  });

  return workOrders.map((wo) => {
    const materials = wo.materials.map((m) => {
      const availableQty = m.material.stockQty;
      const enough = availableQty >= m.requiredQty;
      return {
        materialId: m.materialId,
        reference: m.materialRef,
        name: m.materialName,
        unit: m.unit,
        requiredQty: m.requiredQty,
        issuedQty: m.issuedQty,
        availableQty,
        enough,
        missingQty: enough ? 0 : Math.round((m.requiredQty - availableQty) * 1000) / 1000,
      };
    });
    return {
      id: wo.id,
      reference: wo.reference,
      productRef: wo.productRef,
      productName: wo.productName,
      quantityPlanned: wo.quantityPlanned,
      orderReference: wo.order.reference,
      companyName: wo.order.company.name,
      materials,
      hasBom: materials.length > 0,
      canRelease: materials.every((m) => m.enough),
    };
  });
}

export async function getRecentStockMovements(
  limit = 30,
): Promise<StockMovementVM[]> {
  const movements = await prisma.stockMovement.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { material: true },
  });
  const woIds = Array.from(
    new Set(movements.map((m) => m.workOrderId).filter((id): id is string => !!id)),
  );
  const workOrders = woIds.length
    ? await prisma.workOrder.findMany({
        where: { id: { in: woIds } },
        select: { id: true, reference: true },
      })
    : [];
  const woRefById = new Map(workOrders.map((w) => [w.id, w.reference]));

  return movements.map((m) => ({
    id: m.id,
    materialRef: m.material.reference,
    materialName: m.material.name,
    unit: m.material.unit,
    delta: m.delta,
    reason: m.reason,
    reasonLabel: STOCK_REASON_LABELS[m.reason] ?? m.reason,
    workOrderRef: m.workOrderId ? woRefById.get(m.workOrderId) ?? null : null,
    note: m.note,
    createdAt: toIsoDate(m.createdAt),
  }));
}
