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
} from "@/lib/types";
import { toIsoDate } from "@/lib/dates";
import {
  isStepReady,
  workOrderProgress,
  buildClientStages,
  computeOee,
} from "@/services/production-status";
import type {
  Order,
  OrderItem,
  OrderDocument,
  Request,
  RequestMessage,
  Company,
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
      steps: {
        include: { workstation: true, operator: true },
        orderBy: { sequence: "asc" },
      },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  return workOrders.map((wo) => ({
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
  }));
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

export async function getWorkstationLoad(): Promise<WorkstationLoadVM[]> {
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
