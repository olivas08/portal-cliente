import type { $Enums } from "@prisma/client";

/**
 * Domain enums are the single source of truth in `prisma/schema.prisma`.
 * We derive the TypeScript unions from the generated Prisma types (via a
 * type-only import, so nothing from the client leaks into client bundles)
 * instead of re-declaring them by hand and risking drift.
 */
export type OrderStatus = $Enums.OrderStatus;
export type Priority = $Enums.Priority;
export type RequestType = $Enums.RequestType;
export type RequestStatus = $Enums.RequestStatus;
export type MessageFrom = $Enums.MessageFrom;

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  quote: "Pedido de Orçamento",
  complaint: "Reclamação",
  info: "Pedido de Informação",
  other: "Outro",
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  open: "Aberto",
  in_review: "Em Análise",
  responded: "Respondido",
  closed: "Fechado",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pendente",
  production: "Em Produção",
  quality: "Controlo Qualidade",
  shipped: "Expedido",
  delivered: "Entregue",
};

/** Compact variants for tight UI (e.g. the admin status filter cards). */
export const ORDER_STATUS_SHORT_LABELS: Record<OrderStatus, string> = {
  pending: "Pendente",
  production: "Em Produção",
  quality: "Controlo Q.",
  shipped: "Expedido",
  delivered: "Entregue",
};

export interface OrderItemVM {
  id: string;
  reference: string;
  description: string;
  quantity: number;
  unit: string;
  unitPriceEur: number;
}

export interface OrderAttachmentVM {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string;
  uploadedByName: string;
  createdAt: string;
}

/**
 * Summary view of an order for list/KPI screens. It deliberately omits
 * `attachments` because those screens never render them — only the order
 * detail page does. Keeping them out lets the list queries skip the join to
 * `OrderDocument` entirely (see `data.ts`).
 */
export interface OrderSummaryVM {
  id: string;
  reference: string;
  companyId: string;
  clientCompany: string;
  status: OrderStatus;
  priority: Priority;
  createdDate: string;
  expectedDate: string;
  shippedDate?: string;
  deliveredDate?: string;
  items: OrderItemVM[];
  qualityNotes?: string;
  batchNumber: string | null;
  observations?: string;
}

/** Full order, including attachments, for the order detail page. */
export interface OrderVM extends OrderSummaryVM {
  attachments: OrderAttachmentVM[];
}

export interface RequestMessageVM {
  id: string;
  from: MessageFrom;
  authorName: string;
  text: string;
  date: string;
}

interface RequestBaseVM {
  id: string;
  reference: string;
  companyId: string;
  clientCompany: string;
  type: RequestType;
  subject: string;
  status: RequestStatus;
  createdDate: string;
}

/**
 * Summary view of a request for list screens. List cards only need the last
 * message (for the "aguarda resposta"/"nova resposta" hint) and the total
 * message count, so we avoid loading the entire thread for every row.
 */
export interface RequestSummaryVM extends RequestBaseVM {
  lastMessage: RequestMessageVM | null;
  messageCount: number;
}

/** Full request, including the whole message thread, for the detail page. */
export interface RequestVM extends RequestBaseVM {
  messages: RequestMessageVM[];
}
