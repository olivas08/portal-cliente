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
export type NotificationType = $Enums.NotificationType;
export type WorkOrderStatus = $Enums.WorkOrderStatus;
export type StepStatus = $Enums.StepStatus;
export type NcDisposition = $Enums.NcDisposition;
export type NcStatus = $Enums.NcStatus;
export type QuoteStatus = $Enums.QuoteStatus;
export type QuoteOperation = $Enums.QuoteOperation;

export interface NotificationVM {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string;
}

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

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Rascunho",
  sent: "Enviado",
  accepted: "Aceite",
  rejected: "Recusado",
};

export const QUOTE_OPERATION_LABELS: Record<QuoteOperation, string> = {
  corte_laser: "Corte a laser",
  quinagem: "Quinagem",
  soldadura: "Soldadura",
  acabamento: "Acabamento",
  outro: "Outro",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pendente",
  production: "Em Produção",
  quality: "Controlo Qualidade",
  shipped: "Expedido",
  delivered: "Entregue",
  cancelled: "Cancelada",
};

/** Compact variants for tight UI (e.g. the admin status filter cards). */
export const ORDER_STATUS_SHORT_LABELS: Record<OrderStatus, string> = {
  pending: "Pendente",
  production: "Em Produção",
  quality: "Controlo Q.",
  shipped: "Expedido",
  delivered: "Entregue",
  cancelled: "Cancelada",
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
  cancelledDate?: string;
  cancelReason?: string;
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

/** The global costing assumptions behind every quote line calculation. */
export interface PricingSettingsVM {
  steelPriceEurKg: number;
  laserEurPerMinute: number;
  bendEurPerBend: number;
  weldingEurPerMinute: number;
  finishingEurPerM2: number;
  defaultMarginPercent: number;
}

/** One priced line of a quote (see `QuoteVM`). */
export interface QuoteLineVM {
  id: string;
  sequence: number;
  description: string;
  operation: QuoteOperation;
  quantity: number;
  unit: string;
  materialWeightKg: number;
  laserMinutes: number;
  bendCount: number;
  weldingMinutes: number;
  finishingM2: number;
  unitCostEur: number;
  lineTotalEur: number;
}

interface QuoteBaseVM {
  id: string;
  reference: string;
  companyId: string;
  clientCompany: string;
  subject: string;
  notes: string | null;
  status: QuoteStatus;
  marginPercent: number;
  totalEur: number;
  validUntil: string | null;
  orderId: string | null;
  createdDate: string;
  sentAt: string | null;
  decidedAt: string | null;
}

/** Summary view of a quote for list screens (no line items). */
export interface QuoteSummaryVM extends QuoteBaseVM {
  lineCount: number;
}

/** Full quote, including all priced lines, for the detail/PDF views. */
export interface QuoteVM extends QuoteBaseVM {
  lines: QuoteLineVM[];
}

/** A per-company negotiated price override for a product. */
export interface ProductPriceVM {
  companyId: string;
  companyName: string;
  unitPriceEur: number;
}

/**
 * Admin-facing product view: the factory's base price plus any per-company
 * negotiated overrides. Managed on `/admin/produtos`.
 */
export interface ProductVM {
  id: string;
  reference: string;
  name: string;
  description: string;
  unit: string;
  unitPriceEur: number;
  category: string | null;
  imageUrl: string | null;
  active: boolean;
  companyPrices: ProductPriceVM[];
}

/**
 * Client-facing catalog item: only active products, already resolved to the
 * *effective* price for the viewing company (per-company override falling back
 * to the base price). Never exposes other companies' prices.
 */
export interface CatalogProductVM {
  id: string;
  reference: string;
  name: string;
  description: string;
  unit: string;
  unitPriceEur: number;
  category: string | null;
  imageUrl: string | null;
}

// ── Produção (Ordens de Fabrico) ────────────────────────────────────────────

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  planned: "Planeada",
  released: "Lançada",
  in_progress: "Em Curso",
  done: "Concluída",
  cancelled: "Cancelada",
};

export const STEP_STATUS_LABELS: Record<StepStatus, string> = {
  pending: "Por iniciar",
  in_progress: "Em curso",
  paused: "Em pausa",
  done: "Concluída",
};

export const NC_DISPOSITION_LABELS: Record<NcDisposition, string> = {
  rework: "Reprocessar",
  scrap: "Sucata",
};

/** A shop-floor operator with private performance metrics (admin-only). */
export interface OperatorVM {
  id: string;
  name: string;
  active: boolean;
  completedSteps: number;
  output: number;
  efficiency: number;
  quality: number;
  avgMinutes: number;
}

/** A machine (edge device) with live connection + production status. */
export interface MachineVM {
  id: string;
  code: string;
  name: string;
  active: boolean;
  online: boolean;
  state: "run" | "idle" | "down" | "offline";
  lastSeenAt: string | null;
  stationName: string | null;
  stationId: string | null;
  currentProduct: string | null;
  currentQty: number;
  currentScrap: number;
}

export const MACHINE_STATE_LABELS: Record<MachineVM["state"], string> = {
  run: "Em produção",
  idle: "Parada",
  down: "Avaria",
  offline: "Offline",
};

/** A machine-verified step comparing operator-declared vs machine-counted qty. */
export interface DiscrepancyVM {
  stepId: string;
  productName: string;
  orderReference: string;
  stationName: string;
  operatorName: string | null;
  machineName: string | null;
  declaredQty: number;
  machineQty: number;
  delta: number;
  flagged: boolean;
  finishedAt: string | null;
}

/** An open quality non-conformity, as shown on the admin quality view. */
export interface NonConformityVM {
  id: string;
  workOrderRef: string;
  productName: string;
  orderId: string;
  stepId: string | null;
  stepName: string | null;
  quantity: number;
  reason: string;
  disposition: NcDisposition;
  canRework: boolean;
  operatorName: string | null;
  createdAt: string;
}

/** A single routing step of a work order, as shown on the admin board. */
export interface WorkOrderStepVM {
  id: string;
  sequence: number;
  name: string;
  workstationId: string;
  workstationName: string;
  clientStageLabel: string;
  status: StepStatus;
  plannedMinutes: number;
  actualMinutes: number;
  quantityDone: number;
  scrapQty: number;
  operatorName: string | null;
  ready: boolean;
}

/** Admin-facing work order with its steps and progress. */
export interface WorkOrderVM {
  id: string;
  reference: string;
  orderId: string;
  orderReference: string;
  clientCompany: string;
  productRef: string;
  productName: string;
  quantityPlanned: number;
  quantityDone: number;
  status: WorkOrderStatus;
  priority: Priority;
  progress: number;
  plannedEnd?: string;
  steps: WorkOrderStepVM[];
  /** Live material readiness, used by the release gate on the board. */
  materialStatus: WorkOrderMaterialStatus;
}

/** Compact material readiness for a work order, driving the release button. */
export interface WorkOrderMaterialStatus {
  hasBom: boolean;
  canRelease: boolean;
  shortfalls: {
    reference: string;
    name: string;
    unit: string;
    missingQty: number;
  }[];
}

/** A step queued at a workstation, for the shop-floor terminal. */
export interface TerminalStepVM {
  stepId: string;
  workOrderId: string;
  workOrderReference: string;
  orderReference: string;
  productName: string;
  sequence: number;
  stepName: string;
  status: StepStatus;
  quantityPlanned: number;
  quantityDone: number;
  plannedMinutes: number;
  priority: Priority;
  machineName: string | null;
  machineVerified: boolean;
}

/** A workstation option for the terminal station picker. */
export interface WorkstationVM {
  id: string;
  code: string;
  name: string;
  clientStageLabel: string;
  active: boolean;
  queueCount: number;
}

/** Client-facing production stage in the abstracted stepper. */
export interface ClientStageVM {
  label: string;
  state: "done" | "current" | "upcoming";
}

/** Client-facing production summary for an order (no machine/operator names). */
export interface OrderProductionVM {
  progress: number;
  stages: ClientStageVM[];
  estimatedCompletion?: string;
}

/** A workstation option for admin selectors (routing editor, etc.). */
export interface WorkstationOptionVM {
  id: string;
  name: string;
  clientStageLabel: string;
}

/** Aggregated backlog/load for one workstation (capacity view). */
export interface WorkstationLoadVM {
  id: string;
  name: string;
  clientStageLabel: string;
  activeMinutes: number;
  waitingMinutes: number;
  totalMinutes: number;
  stepCount: number;
  workOrderCount: number;
  readyCount: number;
}

/** OEE (Availability × Performance × Quality) for one workstation. */
export interface WorkstationOeeVM {
  id: string;
  name: string;
  clientStageLabel: string;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  completedSteps: number;
  runtimeMinutes: number;
  downtimeMinutes: number;
}

/** One operation in a product's routing. */
export interface RoutingOperationVM {
  name: string;
  workstationId: string;
  plannedMinutes: number;
}

/** A product together with its current routing, for the routing editor. */
export interface ProductRoutingVM {
  id: string;
  reference: string;
  name: string;
  operations: RoutingOperationVM[];
}

// ── Armazém / Stock ──────────────────────────────────────────────────────────

/** A material in the warehouse with its current stock position. */
export interface MaterialVM {
  id: string;
  reference: string;
  name: string;
  unit: string;
  stockQty: number;
  minStockQty: number;
  active: boolean;
  belowMin: boolean;
}

/** One material line of a product's bill of materials, for the BOM editor. */
export interface BomLineVM {
  materialId: string;
  qtyPerUnit: number;
}

/** A product together with its current bill of materials. */
export interface ProductBomVM {
  id: string;
  reference: string;
  name: string;
  items: BomLineVM[];
}

/** One material requirement of a work order with live availability. */
export interface WorkOrderMaterialVM {
  materialId: string;
  reference: string;
  name: string;
  unit: string;
  requiredQty: number;
  issuedQty: number;
  availableQty: number;
  enough: boolean;
  missingQty: number;
}

/** A planned work order with its material readiness, for the release gate. */
export interface WorkOrderReadinessVM {
  id: string;
  reference: string;
  productRef: string;
  productName: string;
  quantityPlanned: number;
  orderReference: string;
  companyName: string;
  materials: WorkOrderMaterialVM[];
  hasBom: boolean;
  canRelease: boolean;
}

/** A recent stock movement, for the warehouse audit trail. */
export interface StockMovementVM {
  id: string;
  materialRef: string;
  materialName: string;
  unit: string;
  delta: number;
  reason: string;
  reasonLabel: string;
  workOrderRef: string | null;
  note: string | null;
  createdAt: string;
}

export const STOCK_REASON_LABELS: Record<string, string> = {
  receipt: "Entrada",
  issue: "Consumo",
  return: "Devolução",
  adjustment: "Acerto",
};
