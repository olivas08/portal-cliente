import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { OrderVM } from "@/lib/types";
import { formatDatePt } from "@/lib/dates";

const CO = {
  name: "Jolucor - Fabricação e Manutenção Industrial, Lda.",
  address: "Zona Industrial de Vale de Cambra, Lote 12",
  city: "3730-100 Vale de Cambra · Portugal",
  nif: "NIF: PT 500 123 456",
  contact: "Tel: +351 256 850 200 | geral@jolucor.pt",
};

function lastY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
    .finalY;
}

function addHeader(doc: jsPDF, title: string, docRef: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 30, 30);
  doc.text(CO.name, 20, 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  doc.text(title, 190, 22, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  doc.text(CO.address, 20, 30);
  doc.text(CO.city, 20, 35);
  doc.text(CO.nif, 20, 40);
  doc.text(CO.contact, 20, 45);
  doc.text(docRef, 190, 32, { align: "right" });

  doc.setDrawColor(210, 210, 210);
  doc.setLineWidth(0.4);
  doc.line(20, 50, 190, 50);
}

function addOrderInfo(doc: jsPDF, order: OrderVM, y: number) {
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);

  doc.setFont("helvetica", "bold");
  doc.text("Encomenda:", 20, y);
  doc.setFont("helvetica", "normal");
  doc.text(order.reference, 55, y);

  doc.setFont("helvetica", "bold");
  doc.text("Data:", 120, y);
  doc.setFont("helvetica", "normal");
  doc.text(formatDatePt(order.createdDate), 140, y);

  doc.setFont("helvetica", "bold");
  doc.text("Cliente:", 20, y + 7);
  doc.setFont("helvetica", "normal");
  doc.text(order.clientCompany, 55, y + 7);

  doc.setFont("helvetica", "bold");
  doc.text("Lote:", 120, y + 7);
  doc.setFont("helvetica", "normal");
  doc.text(order.batchNumber, 140, y + 7);

  if (order.expectedDate) {
    doc.setFont("helvetica", "bold");
    doc.text("Prazo acordado:", 20, y + 14);
    doc.setFont("helvetica", "normal");
    doc.text(formatDatePt(order.expectedDate), 65, y + 14);
  }
}

function addFooter(doc: jsPDF) {
  doc.setFontSize(7);
  doc.setTextColor(170, 170, 170);
  doc.text(
    `Documento gerado em ${new Date().toLocaleDateString("pt-PT")}`,
    105,
    290,
    { align: "center" }
  );
}

export function generateDeliveryNote(order: OrderVM) {
  const doc = new jsPDF();
  addHeader(doc, "GUIA DE REMESSA", `Nº GR-${order.reference.split("-").pop()}`);
  addOrderInfo(doc, order, 58);

  if (order.shippedDate) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text("Data de expedição:", 20, 79);
    doc.setFont("helvetica", "normal");
    doc.text(formatDatePt(order.shippedDate), 65, 79);
  }

  autoTable(doc, {
    startY: 88,
    head: [["Referência", "Descrição", "Qtd.", "Unid."]],
    body: order.items.map((i) => [
      i.reference,
      i.description,
      String(i.quantity),
      i.unit,
    ]),
    headStyles: { fillColor: [35, 35, 35], fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 38 },
      2: { cellWidth: 18, halign: "center" },
      3: { cellWidth: 18, halign: "center" },
    },
    margin: { left: 20, right: 20 },
  });

  const fy = lastY(doc) + 18;
  doc.setDrawColor(180, 180, 180);
  doc.rect(20, fy, 75, 22);
  doc.rect(115, fy, 75, 22);
  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  doc.text("Assinatura (Expedição)", 57.5, fy + 28, { align: "center" });
  doc.text("Assinatura (Receção)", 152.5, fy + 28, { align: "center" });

  addFooter(doc);
  doc.save(`guia-remessa-${order.reference}.pdf`);
}

export function generateQualityCert(order: OrderVM) {
  const doc = new jsPDF();
  addHeader(doc, "CERTIFICADO DE CONFORMIDADE", `Nº CERT-${order.batchNumber}`);
  addOrderInfo(doc, order, 58);

  autoTable(doc, {
    startY: 88,
    head: [["Referência", "Descrição", "Qtd.", "Unid.", "Resultado"]],
    body: order.items.map((i) => [
      i.reference,
      i.description,
      String(i.quantity),
      i.unit,
      "APROVADO",
    ]),
    headStyles: { fillColor: [35, 35, 35], fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 32 },
      2: { cellWidth: 15, halign: "center" },
      3: { cellWidth: 15, halign: "center" },
      4: {
        cellWidth: 28,
        halign: "center",
        textColor: [0, 120, 0],
        fontStyle: "bold",
      },
    },
    margin: { left: 20, right: 20 },
  });

  let fy = lastY(doc) + 10;

  if (order.qualityNotes) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text("Observações de qualidade:", 20, fy);
    doc.setFont("helvetica", "normal");
    fy += 6;
    const lines = doc.splitTextToSize(order.qualityNotes, 170) as string[];
    doc.text(lines, 20, fy);
    fy += lines.length * 5 + 8;
  }

  const decl =
    "Certificamos que os produtos acima referenciados foram produzidos em conformidade com as especificações técnicas acordadas, cumprem os requisitos de qualidade aplicáveis e foram sujeitos aos controlos definidos no nosso plano de qualidade.";
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  const declLines = doc.splitTextToSize(decl, 170) as string[];
  doc.text(declLines, 20, fy + 5);

  const sigY = fy + declLines.length * 5 + 18;
  doc.setDrawColor(180, 180, 180);
  doc.rect(60, sigY, 90, 22);
  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  doc.text("Responsável de Qualidade", 105, sigY + 28, { align: "center" });

  addFooter(doc);
  doc.save(`certificado-${order.batchNumber}.pdf`);
}

export function generateProformaInvoice(order: OrderVM) {
  const doc = new jsPDF();
  const invoiceNum = `PF-2026-${order.reference.split("-").pop()}`;
  addHeader(doc, "FATURA PRO-FORMA", invoiceNum);
  addOrderInfo(doc, order, 58);

  const subtotal = order.items.reduce(
    (s, i) => s + i.quantity * i.unitPriceEur,
    0
  );
  const iva = subtotal * 0.23;
  const total = subtotal + iva;

  autoTable(doc, {
    startY: 88,
    head: [["Ref.", "Descrição", "Qtd.", "Un.", "P. Unit. (€)", "Total (€)"]],
    body: order.items.map((i) => [
      i.reference,
      i.description,
      String(i.quantity),
      i.unit,
      i.unitPriceEur.toFixed(2),
      (i.quantity * i.unitPriceEur).toFixed(2),
    ]),
    headStyles: { fillColor: [35, 35, 35], fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 28 },
      2: { cellWidth: 14, halign: "center" },
      3: { cellWidth: 12, halign: "center" },
      4: { cellWidth: 28, halign: "right" },
      5: { cellWidth: 28, halign: "right" },
    },
    margin: { left: 20, right: 20 },
  });

  const fy = lastY(doc) + 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text("Subtotal:", 148, fy + 7, { align: "right" });
  doc.text(`${subtotal.toFixed(2)} €`, 190, fy + 7, { align: "right" });
  doc.text("IVA (23%):", 148, fy + 14, { align: "right" });
  doc.text(`${iva.toFixed(2)} €`, 190, fy + 14, { align: "right" });

  doc.setDrawColor(200, 200, 200);
  doc.line(130, fy + 17, 190, fy + 17);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text("TOTAL:", 148, fy + 25, { align: "right" });
  doc.text(`${total.toFixed(2)} €`, 190, fy + 25, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  doc.text(
    "Condições de pagamento: 30 dias após receção da fatura definitiva.",
    20,
    fy + 35
  );
  doc.text("IBAN: PT50 0035 0000 0000 0123 4567 8", 20, fy + 41);

  doc.setFontSize(7);
  doc.text(
    "Documento sem valor fiscal. Sujeito a confirmação de encomenda.",
    105,
    290,
    { align: "center" }
  );

  doc.save(`fatura-proforma-${invoiceNum}.pdf`);
}
