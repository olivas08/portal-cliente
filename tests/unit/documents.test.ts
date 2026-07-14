import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  mockAuth,
  prismaMock,
  mockUploadDocumentFile,
  mockDeleteDocumentFile,
  mockGetDocumentDownloadUrl,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  prismaMock: {
    order: { findUnique: vi.fn() },
    orderDocument: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
  mockUploadDocumentFile: vi.fn(),
  mockDeleteDocumentFile: vi.fn(),
  mockGetDocumentDownloadUrl: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/storage", () => ({
  uploadDocumentFile: mockUploadDocumentFile,
  deleteDocumentFile: mockDeleteDocumentFile,
  getDocumentDownloadUrl: mockGetDocumentDownloadUrl,
}));

import {
  uploadOrderDocument,
  deleteOrderDocument,
  getOrderDocumentDownloadUrl,
} from "@/actions/documents";

const adminSession = { user: { id: "admin1", role: "ADMIN", name: "Admin" } };
const clientSession = {
  user: { id: "u2", role: "CLIENT", companyId: "c1", name: "Cliente Mota" },
};
const otherClientSession = {
  user: { id: "u3", role: "CLIENT", companyId: "c2", name: "Cliente Norte" },
};

const order = { id: "o1", companyId: "c1" };

function makeFile(
  name: string,
  type: string,
  sizeBytes: number
): File {
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type });
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.order.findUnique.mockResolvedValue(order);
  prismaMock.orderDocument.create.mockResolvedValue({});
  mockUploadDocumentFile.mockResolvedValue(undefined);
  mockDeleteDocumentFile.mockResolvedValue(undefined);
  mockGetDocumentDownloadUrl.mockResolvedValue("https://signed.example/file");
});

describe("uploadOrderDocument — authorization", () => {
  it("rejects an unauthenticated user", async () => {
    mockAuth.mockResolvedValue(null);
    const fd = new FormData();
    fd.set("file", makeFile("a.pdf", "application/pdf", 100));
    await expect(uploadOrderDocument("o1", fd)).rejects.toThrow(
      "Não autorizado."
    );
  });

  it("rejects a client from another company", async () => {
    mockAuth.mockResolvedValue(otherClientSession);
    const fd = new FormData();
    fd.set("file", makeFile("a.pdf", "application/pdf", 100));
    await expect(uploadOrderDocument("o1", fd)).rejects.toThrow(
      "Não autorizado."
    );
    expect(prismaMock.orderDocument.create).not.toHaveBeenCalled();
  });

  it("throws when the order does not exist", async () => {
    mockAuth.mockResolvedValue(adminSession);
    prismaMock.order.findUnique.mockResolvedValue(null);
    const fd = new FormData();
    fd.set("file", makeFile("a.pdf", "application/pdf", 100));
    await expect(uploadOrderDocument("missing", fd)).rejects.toThrow(
      "Encomenda não encontrada."
    );
  });
});

describe("uploadOrderDocument — validation", () => {
  it("rejects a missing file", async () => {
    mockAuth.mockResolvedValue(adminSession);
    const fd = new FormData();
    await expect(uploadOrderDocument("o1", fd)).rejects.toThrow(
      "Selecione um ficheiro"
    );
  });

  it("rejects an oversized file", async () => {
    mockAuth.mockResolvedValue(adminSession);
    const fd = new FormData();
    fd.set("file", makeFile("big.pdf", "application/pdf", 11 * 1024 * 1024));
    await expect(uploadOrderDocument("o1", fd)).rejects.toThrow(
      "excede o limite"
    );
    expect(mockUploadDocumentFile).not.toHaveBeenCalled();
  });

  it("rejects an unsupported mime type", async () => {
    mockAuth.mockResolvedValue(adminSession);
    const fd = new FormData();
    fd.set("file", makeFile("script.sh", "application/x-sh", 10));
    await expect(uploadOrderDocument("o1", fd)).rejects.toThrow(
      "não suportado"
    );
    expect(mockUploadDocumentFile).not.toHaveBeenCalled();
  });

  it("rejects a generic mime type when the extension isn't allowed either", async () => {
    mockAuth.mockResolvedValue(adminSession);
    const fd = new FormData();
    fd.set(
      "file",
      makeFile("relatorio.html", "application/octet-stream", 10)
    );
    await expect(uploadOrderDocument("o1", fd)).rejects.toThrow(
      "não suportado"
    );
    expect(mockUploadDocumentFile).not.toHaveBeenCalled();
  });

  it("falls back to the file extension when the browser reports no mime type", async () => {
    // Some browsers/OS combinations (cloud-synced folders, some Android
    // setups) report an empty file.type even for well-known formats.
    mockAuth.mockResolvedValue(adminSession);
    const fd = new FormData();
    fd.set("file", makeFile("desenho.pdf", "", 2048));

    await uploadOrderDocument("o1", fd);

    expect(mockUploadDocumentFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Buffer),
      "application/pdf"
    );
    expect(prismaMock.orderDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mimeType: "application/pdf" }),
      })
    );
  });

  it("accepts a csv file", async () => {
    mockAuth.mockResolvedValue(adminSession);
    const fd = new FormData();
    fd.set("file", makeFile("pecas.csv", "text/csv", 512));

    await uploadOrderDocument("o1", fd);

    expect(mockUploadDocumentFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Buffer),
      "text/csv"
    );
  });
});

describe("uploadOrderDocument — success", () => {
  it("allows the owning client and stores the document metadata", async () => {
    mockAuth.mockResolvedValue(clientSession);
    const fd = new FormData();
    fd.set("file", makeFile("desenho.pdf", "application/pdf", 2048));

    await uploadOrderDocument("o1", fd);

    expect(mockUploadDocumentFile).toHaveBeenCalledWith(
      expect.stringMatching(/^orders\/o1\/.+-desenho\.pdf$/),
      expect.any(Buffer),
      "application/pdf"
    );
    const data = prismaMock.orderDocument.create.mock.calls[0][0].data;
    expect(data.orderId).toBe("o1");
    expect(data.fileName).toBe("desenho.pdf");
    expect(data.sizeBytes).toBe(2048);
    expect(data.uploadedById).toBe("u2");
    expect(data.uploadedByName).toBe("Cliente Mota");
  });

  it("allows an admin regardless of company", async () => {
    mockAuth.mockResolvedValue(adminSession);
    const fd = new FormData();
    fd.set("file", makeFile("nota.pdf", "application/pdf", 512));
    await expect(uploadOrderDocument("o1", fd)).resolves.toBeUndefined();
    expect(prismaMock.orderDocument.create).toHaveBeenCalled();
  });
});

const existingDoc = {
  id: "d1",
  orderId: "o1",
  uploadedById: "u2",
  storageKey: "orders/o1/x-file.pdf",
  order: { companyId: "c1" },
};

describe("deleteOrderDocument", () => {
  beforeEach(() => {
    prismaMock.orderDocument.findUnique.mockResolvedValue(existingDoc);
  });

  it("rejects an unauthenticated user", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(deleteOrderDocument("d1")).rejects.toThrow("Não autorizado.");
  });

  it("throws when the document does not exist", async () => {
    mockAuth.mockResolvedValue(adminSession);
    prismaMock.orderDocument.findUnique.mockResolvedValue(null);
    await expect(deleteOrderDocument("missing")).rejects.toThrow(
      "Documento não encontrado."
    );
  });

  it("allows an admin to delete any document", async () => {
    mockAuth.mockResolvedValue(adminSession);
    await deleteOrderDocument("d1");
    expect(mockDeleteDocumentFile).toHaveBeenCalledWith(existingDoc.storageKey);
    expect(prismaMock.orderDocument.delete).toHaveBeenCalledWith({
      where: { id: "d1" },
    });
  });

  it("allows the uploader to delete their own document", async () => {
    mockAuth.mockResolvedValue(clientSession);
    await expect(deleteOrderDocument("d1")).resolves.toBeUndefined();
    expect(prismaMock.orderDocument.delete).toHaveBeenCalled();
  });

  it("rejects a client from another company even for their own upload id", async () => {
    mockAuth.mockResolvedValue(otherClientSession);
    await expect(deleteOrderDocument("d1")).rejects.toThrow("Não autorizado.");
    expect(prismaMock.orderDocument.delete).not.toHaveBeenCalled();
  });

  it("rejects a different client from the same... company boundary check", async () => {
    // A CLIENT user from the same company but who did not upload the file
    // is still allowed today only if companyId matches AND they are the
    // owner; a teammate without ownership should be rejected.
    mockAuth.mockResolvedValue({
      user: { id: "teammate", role: "CLIENT", companyId: "c1", name: "Colega" },
    });
    await expect(deleteOrderDocument("d1")).rejects.toThrow("Não autorizado.");
  });
});

describe("getOrderDocumentDownloadUrl", () => {
  beforeEach(() => {
    prismaMock.orderDocument.findUnique.mockResolvedValue(existingDoc);
  });

  it("rejects an unauthenticated user", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(getOrderDocumentDownloadUrl("d1")).rejects.toThrow(
      "Não autorizado."
    );
  });

  it("rejects a client from another company", async () => {
    mockAuth.mockResolvedValue(otherClientSession);
    await expect(getOrderDocumentDownloadUrl("d1")).rejects.toThrow(
      "Não autorizado."
    );
  });

  it("returns a signed url for the owning client", async () => {
    mockAuth.mockResolvedValue(clientSession);
    const url = await getOrderDocumentDownloadUrl("d1");
    expect(url).toBe("https://signed.example/file");
    expect(mockGetDocumentDownloadUrl).toHaveBeenCalledWith(
      existingDoc.storageKey
    );
  });

  it("returns a signed url for an admin", async () => {
    mockAuth.mockResolvedValue(adminSession);
    const url = await getOrderDocumentDownloadUrl("d1");
    expect(url).toBe("https://signed.example/file");
  });
});
