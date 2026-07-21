import { prisma } from "@/lib/prisma";
import type {
  OrderVM,
  OrderSummaryVM,
  RequestVM,
  RequestSummaryVM,
  RequestMessageVM,
  ProductVM,
  CatalogProductVM,
} from "@/lib/types";
import { toIsoDate } from "@/lib/dates";
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
