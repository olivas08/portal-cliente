import { prisma } from "@/lib/prisma";
import type { OrderVM, RequestVM } from "@/lib/types";
import type {
  Order,
  OrderItem,
  Request,
  RequestMessage,
  Company,
} from "@prisma/client";

const ymd = (d: Date) => d.toISOString().slice(0, 10);

type OrderWith = Order & { items: OrderItem[]; company: Company };
type RequestWith = Request & { messages: RequestMessage[]; company: Company };

function toOrderVM(o: OrderWith): OrderVM {
  return {
    id: o.id,
    reference: o.reference,
    companyId: o.companyId,
    clientCompany: o.company.name,
    status: o.status,
    priority: o.priority,
    createdDate: ymd(o.createdDate),
    expectedDate: ymd(o.expectedDate),
    shippedDate: o.shippedDate ? ymd(o.shippedDate) : undefined,
    deliveredDate: o.deliveredDate ? ymd(o.deliveredDate) : undefined,
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

function toRequestVM(r: RequestWith): RequestVM {
  return {
    id: r.id,
    companyId: r.companyId,
    clientCompany: r.company.name,
    type: r.type,
    subject: r.subject,
    status: r.status,
    createdDate: ymd(r.createdDate),
    messages: r.messages.map((m) => ({
      id: m.id,
      from: m.from,
      authorName: m.authorName,
      text: m.text,
      date: m.date.toISOString(),
    })),
  };
}

export async function getOrdersForCompany(companyId: string): Promise<OrderVM[]> {
  const orders = await prisma.order.findMany({
    where: { companyId },
    include: { items: true, company: true },
    orderBy: { createdDate: "desc" },
  });
  return orders.map(toOrderVM);
}

export async function getAllOrders(): Promise<OrderVM[]> {
  const orders = await prisma.order.findMany({
    include: { items: true, company: true },
    orderBy: { createdDate: "desc" },
  });
  return orders.map(toOrderVM);
}

export async function getOrderById(id: string): Promise<OrderVM | null> {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, company: true },
  });
  return order ? toOrderVM(order) : null;
}

export async function getRequestsForCompany(companyId: string): Promise<RequestVM[]> {
  const requests = await prisma.request.findMany({
    where: { companyId },
    include: { messages: { orderBy: { date: "asc" } }, company: true },
    orderBy: { createdDate: "desc" },
  });
  return requests.map(toRequestVM);
}

export async function getAllRequests(): Promise<RequestVM[]> {
  const requests = await prisma.request.findMany({
    include: { messages: { orderBy: { date: "asc" } }, company: true },
    orderBy: { createdDate: "desc" },
  });
  return requests.map(toRequestVM);
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
