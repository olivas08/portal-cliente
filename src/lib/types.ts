export type OrderStatus = "pending" | "production" | "quality" | "shipped" | "delivered";
export type Priority = "normal" | "urgent";
export type RequestType = "quote" | "complaint" | "info" | "other";
export type RequestStatus = "open" | "in_review" | "responded" | "closed";
export type MessageFrom = "client" | "admin";

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

export interface OrderItemVM {
  id: string;
  reference: string;
  description: string;
  quantity: number;
  unit: string;
  unitPriceEur: number;
}

export interface OrderVM {
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
  batchNumber: string;
  observations?: string;
}

export interface RequestMessageVM {
  id: string;
  from: MessageFrom;
  authorName: string;
  text: string;
  date: string;
}

export interface RequestVM {
  id: string;
  companyId: string;
  clientCompany: string;
  type: RequestType;
  subject: string;
  status: RequestStatus;
  createdDate: string;
  messages: RequestMessageVM[];
}
