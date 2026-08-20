import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { CACHE_TAGS } from "@/lib/cache-tags";
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
  ScheduleWorkstationVM,
  WorkstationOeeVM,
  ProductionKpisVM,
  ProductRoutingVM,
  NonConformityVM,
  OperatorVM,
  MachineVM,
  DiscrepancyVM,
  MaterialVM,
  MaterialBatchVM,
  OrderBatchConsumptionVM,
  RecallTraceVM,
  ProductBomVM,
  WorkOrderReadinessVM,
  StockMovementVM,
  QuoteVM,
  QuoteSummaryVM,
  QuoteLineVM,
  PricingSettingsVM,
  OperationTypeVM,
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
  computeWipValueByWorkstation,
  type WipWorkOrderInput,
} from "@/services/production-status";
import {
  computeProductionSchedule,
  type ScheduleStepInput,
} from "@/services/production-schedule";
import {
  getPricingSettings as getPricingSettingsService,
  getOperationTypes as getOperationTypesService,
} from "@/services/quotes.service";
import type {
  Order,
  OrderItem,
  OrderDocument,
  Request,
  RequestMessage,
  Company,
  Quote,
  QuoteLine,
  QuoteLineOperation,
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

function toQuoteLineVM(l: QuoteLine & { operations: QuoteLineOperation[] }): QuoteLineVM {
  return {
    id: l.id,
    sequence: l.sequence,
    description: l.description,
    quantity: l.quantity,
    unit: l.unit,
    materialWeightKg: l.materialWeightKg,
    operations: l.operations.map((o) => ({
      id: o.id,
      operationTypeId: o.operationTypeId,
      name: o.name,
      unit: o.unit,
      quantity: o.quantity,
      ratePerUnitEur: o.ratePerUnitEur,
      costEur: o.costEur,
    })),
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
    include: {
      company: true,
      lines: { include: { operations: true }, orderBy: { sequence: "asc" } },
    },
  });
  if (!quote) return null;
  return { ...toQuoteBase(quote), lines: quote.lines.map(toQuoteLineVM) };
}

export const getPricingSettingsVM = unstable_cache(
  async (): Promise<PricingSettingsVM> => {
    const s = await getPricingSettingsService();
    return {
      steelPriceEurKg: s.steelPriceEurKg,
      defaultMarginPercent: s.defaultMarginPercent,
    };
  },
  ["pricing-settings-vm"],
  { tags: [CACHE_TAGS.pricingSettings], revalidate: false },
);

export const getOperationTypesVM = unstable_cache(
  async (): Promise<OperationTypeVM[]> => {
    const types = await getOperationTypesService();
    return types.map((t) => ({
      id: t.id,
      key: t.key,
      name: t.name,
      unit: t.unit,
      ratePerUnitEur: t.ratePerUnitEur,
      active: t.active,
      sequence: t.sequence,
    }));
  },
  ["operation-types-vm"],
  { tags: [CACHE_TAGS.operationTypes], revalidate: false },
);

export const getCompanies = unstable_cache(
  async () => prisma.company.findMany({ orderBy: { name: "asc" } }),
  ["companies"],
  { tags: [CACHE_TAGS.companies], revalidate: false },
);


export const getProducts = unstable_cache(
  async (): Promise<ProductVM[]> => {
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
  },
  ["products"],
  { tags: [CACHE_TAGS.products], revalidate: false },
);

export const getCatalogForCompany = unstable_cache(
  async (companyId: string): Promise<CatalogProductVM[]> => {
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
  },
  ["catalog-for-company"],
  { tags: [CACHE_TAGS.products], revalidate: false },
);


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

export const getWorkOrders = unstable_cache(
  async (): Promise<WorkOrderVM[]> => {
  // Prisma resolves each nested `include` relation as its own round trip to
  // the DB, each wrapped in its own transaction (BEGIN/COMMIT) against the
  // remote Supabase pooler — this used to be ~11 sequential queries. Since
  // this function already returns *all* work orders (no filter), materials
  // and steps for *all* work orders are fetched unconditionally alongside
  // the work orders themselves, so all three top-level queries have no
  // interdependency and can run fully concurrently via Promise.all instead
  // of waiting on each other.
  const [workOrders, materials, steps] = await Promise.all([
    prisma.workOrder.findMany({
      include: {
        order: { include: { company: true } },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    }),
    prisma.workOrderMaterial.findMany({
      include: { material: true },
      orderBy: { materialRef: "asc" },
    }),
    prisma.workOrderStep.findMany({
      include: { workstation: true, operator: true },
      orderBy: { sequence: "asc" },
    }),
  ]);

  const materialsByWorkOrder = new Map<string, typeof materials>();
  for (const m of materials) {
    const list = materialsByWorkOrder.get(m.workOrderId);
    if (list) list.push(m);
    else materialsByWorkOrder.set(m.workOrderId, [m]);
  }

  const stepsByWorkOrder = new Map<string, typeof steps>();
  for (const s of steps) {
    const list = stepsByWorkOrder.get(s.workOrderId);
    if (list) list.push(s);
    else stepsByWorkOrder.set(s.workOrderId, [s]);
  }

  return workOrders.map((wo) => {
    const woMaterials = materialsByWorkOrder.get(wo.id) ?? [];
    const woSteps = stepsByWorkOrder.get(wo.id) ?? [];

    const shortfalls = woMaterials
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
      progress: workOrderProgress(woSteps),
      plannedEnd: wo.plannedEnd ? toIsoDate(wo.plannedEnd) : undefined,
      steps: woSteps.map((s) => toStepVM(s, woSteps)),
      materialStatus: {
        hasBom: woMaterials.length > 0,
        canRelease: shortfalls.length === 0,
        shortfalls,
      },
    };
  });
  },
  ["work-orders"],
  { tags: [CACHE_TAGS.workOrders], revalidate: false },
);

export const getActiveOperators = unstable_cache(
  async (): Promise<{ id: string; name: string }[]> => {
    return prisma.operator.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  },
  ["active-operators"],
  { tags: [CACHE_TAGS.operators], revalidate: false },
);

export const getWorkstationsWithQueue = unstable_cache(
  async (): Promise<WorkstationVM[]> => {
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
  },
  ["workstations-with-queue"],
  { tags: [CACHE_TAGS.workOrders], revalidate: false },
);

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
export const getOrderProduction = unstable_cache(
  async (orderId: string): Promise<OrderProductionVM | null> => {
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
  },
  ["order-production"],
  { tags: [CACHE_TAGS.workOrders], revalidate: false },
);

export const getWorkstationOptions = unstable_cache(
  async (): Promise<WorkstationOptionVM[]> => {
    const workstations = await prisma.workstation.findMany({
      where: { active: true },
      orderBy: { sequence: "asc" },
      select: { id: true, name: true, clientStageLabel: true },
    });
    return workstations;
  },
  ["workstation-options"],
  { tags: [CACHE_TAGS.workstations], revalidate: false },
);

export const getProductsWithRouting = unstable_cache(
  async (): Promise<ProductRoutingVM[]> => {
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
  },
  ["products-with-routing"],
  { tags: [CACHE_TAGS.routing, CACHE_TAGS.products], revalidate: false },
);


export const getWorkstationLoad = unstable_cache(
  async (): Promise<WorkstationLoadVM[]> => {
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
  },
  ["workstation-load"],
  { tags: [CACHE_TAGS.workOrders], revalidate: false },
);

/**
 * Production-schedule (Gantt) projection, grouped by workstation.
 *
 * Unlike the other queries in this file, this is intentionally NOT wrapped
 * in `unstable_cache`: the projection is computed relative to `now`, so a
 * tag-invalidated-only cache (`revalidate: false`) would keep showing bars
 * positioned against a stale "now" until an unrelated work-order mutation
 * happened to bust the tag. There is no finite-capacity time-slot scheduler
 * behind this — it's a best-effort estimate of how the existing
 * priority/FIFO queue would play out if each workstation worked back-to-back,
 * built on top of `plannedMinutes` and actual start/finish timestamps.
 */
export async function getProductionSchedule(
  horizonDays = 14,
): Promise<ScheduleWorkstationVM[]> {
  const now = new Date();
  const horizonEnd = new Date(now.getTime() + horizonDays * 24 * 60 * 60_000);

  const [workstations, steps] = await Promise.all([
    prisma.workstation.findMany({
      where: { active: true },
      orderBy: { sequence: "asc" },
      select: { id: true, name: true, clientStageLabel: true },
    }),
    prisma.workOrderStep.findMany({
      where: {
        status: { in: ["pending", "in_progress", "paused", "done"] },
        workOrder: { status: { in: ["planned", "released", "in_progress"] } },
      },
      include: {
        machine: { select: { name: true } },
        workOrder: {
          select: {
            id: true,
            reference: true,
            productRef: true,
            productName: true,
            priority: true,
            status: true,
            plannedEnd: true,
            createdAt: true,
            order: { select: { company: { select: { name: true } } } },
          },
        },
      },
      orderBy: { sequence: "asc" },
    }),
  ]);

  const scheduleInputs: ScheduleStepInput[] = steps.map((s) => ({
    workOrderId: s.workOrder.id,
    workOrderRef: s.workOrder.reference,
    productRef: s.workOrder.productRef,
    productName: s.workOrder.productName,
    companyName: s.workOrder.order.company.name,
    priority: s.workOrder.priority,
    workOrderStatus: s.workOrder.status,
    workOrderCreatedAt: s.workOrder.createdAt,
    workOrderPlannedEnd: s.workOrder.plannedEnd,
    stepId: s.id,
    sequence: s.sequence,
    name: s.name,
    workstationId: s.workstationId,
    machineId: s.machineId,
    machineName: s.machine?.name ?? null,
    status: s.status,
    plannedMinutes: s.plannedMinutes,
    startedAt: s.startedAt,
    finishedAt: s.finishedAt,
  }));

  const bars = computeProductionSchedule(scheduleInputs, now).filter(
    (bar) => bar.start < horizonEnd,
  );

  const barsByWorkstation = new Map<string, typeof bars>();
  for (const bar of bars) {
    const list = barsByWorkstation.get(bar.workstationId);
    if (list) list.push(bar);
    else barsByWorkstation.set(bar.workstationId, [bar]);
  }

  return workstations.map((ws) => ({
    id: ws.id,
    name: ws.name,
    clientStageLabel: ws.clientStageLabel,
    bars: (barsByWorkstation.get(ws.id) ?? []).map((bar) => ({
      workOrderId: bar.workOrderId,
      workOrderRef: bar.workOrderRef,
      productRef: bar.productRef,
      productName: bar.productName,
      companyName: bar.companyName,
      priority: bar.priority,
      workOrderStatus: bar.workOrderStatus,
      stepId: bar.stepId,
      stepName: bar.stepName,
      stepStatus: bar.stepStatus,
      machineName: bar.machineName,
      start: bar.start.toISOString(),
      end: bar.end.toISOString(),
      isEstimate: bar.isEstimate,
    })),
  }));
}

export const getOpenNonConformities = unstable_cache(
  async (): Promise<NonConformityVM[]> => {
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
  },
  ["open-non-conformities"],
  { tags: [CACHE_TAGS.nonConformities], revalidate: false },
);

export const getWorkstationOee = unstable_cache(
  async (): Promise<WorkstationOeeVM[]> => {
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
  },
  ["workstation-oee"],
  { tags: [CACHE_TAGS.workOrders], revalidate: false },
);

export const getFactoryOee = unstable_cache(
  async (): Promise<WorkstationOeeVM | null> => {
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
  },
  ["factory-oee"],
  { tags: [CACHE_TAGS.workOrders], revalidate: false },
);

/**
 * Factory-wide KPIs for the "Desempenho" dashboard: scrap rate (derived from
 * the same quality figure used by OEE), work orders stuck for lack of
 * material, and an estimate of WIP value sitting at each workstation.
 */
export const getProductionKpis = unstable_cache(
  async (): Promise<ProductionKpisVM> => {
  const [factoryOee, awaitingMaterials, products, workOrders] = await Promise.all([
    getFactoryOee(),
    getWorkOrdersAwaitingMaterials(),
    getProducts(),
    prisma.workOrder.findMany({
      where: { status: { in: ["released", "in_progress"] } },
      select: {
        quantityPlanned: true,
        quantityDone: true,
        productRef: true,
        steps: {
          select: {
            sequence: true,
            status: true,
            workstationId: true,
            workstation: { select: { name: true } },
          },
          orderBy: { sequence: "asc" },
        },
      },
    }),
  ]);

  const priceByRef = new Map(products.map((p) => [p.reference, p.unitPriceEur]));
  const wipInputs: WipWorkOrderInput[] = workOrders.map((wo) => ({
    quantityPlanned: wo.quantityPlanned,
    quantityDone: wo.quantityDone,
    unitPriceEur: priceByRef.get(wo.productRef) ?? 0,
    steps: wo.steps.map((s) => ({
      sequence: s.sequence,
      status: s.status,
      workstationId: s.workstationId,
      workstationName: s.workstation.name,
    })),
  }));

  const wipByWorkstation = computeWipValueByWorkstation(wipInputs);
  const materialBlockedCount = awaitingMaterials.filter(
    (wo) => wo.hasBom && !wo.canRelease,
  ).length;

  return {
    scrapRatePct: factoryOee ? (1 - factoryOee.quality) * 100 : null,
    materialBlockedCount,
    wipByWorkstation,
    totalWipValueEur: wipByWorkstation.reduce((sum, w) => sum + w.valueEur, 0),
  };
  },
  ["production-kpis"],
  { tags: [CACHE_TAGS.workOrders, CACHE_TAGS.materials, CACHE_TAGS.products], revalidate: false },
);

export const getOperatorsWithStats = unstable_cache(
  async (): Promise<OperatorVM[]> => {
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
  },
  ["operators-with-stats"],
  { tags: [CACHE_TAGS.operators, CACHE_TAGS.workOrders], revalidate: false },
);

export const getMachinesWithStatus = unstable_cache(
  async (): Promise<MachineVM[]> => {
  const now = new Date();
  const machines = await prisma.machine.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { workstation: { select: { id: true, name: true } } },
  });

  const workstationIds = machines
    .map((m) => m.workstationId)
    .filter((id): id is string => id !== null);

  // Single batched query instead of one findFirst per machine (avoids N+1).
  const inProgressSteps = workstationIds.length
    ? await prisma.workOrderStep.findMany({
        where: { workstationId: { in: workstationIds }, status: "in_progress" },
        orderBy: { startedAt: "asc" },
        select: {
          workstationId: true,
          quantityDone: true,
          scrapQty: true,
          workOrder: { select: { productName: true } },
        },
      })
    : [];

  // Keep the earliest in-progress step per workstation (matches the previous
  // findFirst + orderBy startedAt asc behaviour).
  const stepByWorkstation = new Map<string, (typeof inProgressSteps)[number]>();
  for (const step of inProgressSteps) {
    if (step.workstationId && !stepByWorkstation.has(step.workstationId)) {
      stepByWorkstation.set(step.workstationId, step);
    }
  }

  return machines.map((m) => {
    const step = m.workstationId ? stepByWorkstation.get(m.workstationId) : undefined;
    return {
      id: m.id,
      code: m.code,
      name: m.name,
      active: m.active,
      online: m.state !== "offline" && isMachineOnline(m.lastSeenAt, now),
      state: (m.state as MachineVM["state"]) ?? "offline",
      lastSeenAt: m.lastSeenAt ? m.lastSeenAt.toISOString() : null,
      stationName: m.workstation?.name ?? null,
      stationId: m.workstation?.id ?? null,
      currentProduct: step ? step.workOrder.productName : null,
      currentQty: step ? step.quantityDone : 0,
      currentScrap: step ? step.scrapQty : 0,
    };
  });
  },
  ["machines-with-status"],
  { tags: [CACHE_TAGS.machines], revalidate: false },
);

export const getRecentDiscrepancies = unstable_cache(
  async (limit = 20): Promise<DiscrepancyVM[]> => {
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
  },
  ["recent-discrepancies"],
  { tags: [CACHE_TAGS.machines, CACHE_TAGS.workOrders], revalidate: false },
);

// ── Armazém / Stock ──────────────────────────────────────────────────────────

export const getMaterials = unstable_cache(
  async (): Promise<MaterialVM[]> => {
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
    tracksBatches: m.tracksBatches,
  }));
  },
  ["materials"],
  { tags: [CACHE_TAGS.materials], revalidate: false },
);

/** Delivery history (heat/cast batches) for one `tracksBatches` material,
 * newest first, for the warehouse material-detail expansion. */
export const getMaterialBatches = unstable_cache(
  async (materialId: string): Promise<MaterialBatchVM[]> => {
  const material = await prisma.material.findUnique({
    where: { id: materialId },
    select: { unit: true },
  });
  if (!material) return [];

  const batches = await prisma.materialBatch.findMany({
    where: { materialId },
    orderBy: { receivedAt: "desc" },
  });
  return batches.map((b) => ({
    id: b.id,
    batchCode: b.batchCode,
    supplierName: b.supplierName,
    certificateRef: b.certificateRef,
    receivedQty: b.receivedQty,
    remainingQty: b.remainingQty,
    unit: material.unit,
    receivedAt: toIsoDate(b.receivedAt),
    note: b.note,
  }));
  },
  ["material-batches"],
  { tags: [CACHE_TAGS.materials], revalidate: false },
);

/** Forward traceability for an order: which raw-material batches (heat/cast
 * numbers) were consumed by the work orders producing its items. Only
 * `tracksBatches` materials show up here — the ledger (`WorkOrderMaterialBatch`)
 * only has rows for those. */
export const getOrderTraceability = unstable_cache(
  async (orderId: string): Promise<OrderBatchConsumptionVM[]> => {
  const workOrders = await prisma.workOrder.findMany({
    where: { orderId },
    include: {
      materials: {
        include: { batches: { include: { materialBatch: true } } },
      },
    },
  });

  const rows: OrderBatchConsumptionVM[] = [];
  for (const wo of workOrders) {
    for (const wm of wo.materials) {
      for (const c of wm.batches) {
        rows.push({
          workOrderRef: wo.reference,
          productRef: wo.productRef,
          productName: wo.productName,
          materialRef: wm.materialRef,
          materialName: wm.materialName,
          batchCode: c.materialBatch.batchCode,
          supplierName: c.materialBatch.supplierName,
          certificateRef: c.materialBatch.certificateRef,
          qty: c.qty,
          unit: wm.unit,
        });
      }
    }
  }
  return rows;
  },
  ["order-traceability"],
  { tags: [CACHE_TAGS.workOrders, CACHE_TAGS.materials], revalidate: false },
);

/** Backward (recall) traceability: given a batch/heat code, find every order
 * it fed into, across every client. Not cached — this is an ad-hoc admin
 * search over a potentially wide, rarely-run query, not a page render. */
export async function findBatchTrace(batchCode: string): Promise<RecallTraceVM[]> {
  const query = batchCode.trim();
  if (!query) return [];

  const batches = await prisma.materialBatch.findMany({
    where: { batchCode: { contains: query, mode: "insensitive" } },
    include: {
      material: { select: { reference: true, name: true, unit: true } },
      consumptions: {
        include: {
          workOrderMaterial: {
            include: {
              workOrder: { include: { order: { include: { company: true } } } },
            },
          },
        },
      },
    },
    orderBy: { receivedAt: "desc" },
    take: 20,
  });

  return batches.map((b) => ({
    batchId: b.id,
    batchCode: b.batchCode,
    materialRef: b.material.reference,
    materialName: b.material.name,
    supplierName: b.supplierName,
    certificateRef: b.certificateRef,
    receivedQty: b.receivedQty,
    remainingQty: b.remainingQty,
    unit: b.material.unit,
    receivedAt: toIsoDate(b.receivedAt),
    consumedIn: b.consumptions.map((c) => ({
      workOrderRef: c.workOrderMaterial.workOrder.reference,
      orderReference: c.workOrderMaterial.workOrder.order.reference,
      companyName: c.workOrderMaterial.workOrder.order.company.name,
      productRef: c.workOrderMaterial.workOrder.productRef,
      productName: c.workOrderMaterial.workOrder.productName,
      qty: c.qty,
    })),
  }));
}

export const getProductsWithBom = unstable_cache(
  async (): Promise<ProductBomVM[]> => {
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
  },
  ["products-with-bom"],
  { tags: [CACHE_TAGS.materials, CACHE_TAGS.products], revalidate: false },
);

/** Planned work orders with live material availability, for the release gate. */
export const getWorkOrdersAwaitingMaterials = unstable_cache(
  async (): Promise<WorkOrderReadinessVM[]> => {
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
  },
  ["work-orders-awaiting-materials"],
  { tags: [CACHE_TAGS.workOrders, CACHE_TAGS.materials], revalidate: false },
);

export const getRecentStockMovements = unstable_cache(
  async (limit = 30): Promise<StockMovementVM[]> => {
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
  },
  ["recent-stock-movements"],
  { tags: [CACHE_TAGS.materials], revalidate: false },
);

