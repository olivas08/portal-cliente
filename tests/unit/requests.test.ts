import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockAuth, prismaMock } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  prismaMock: {
    request: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    requestMessage: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  createRequest,
  addRequestMessage,
  updateRequestStatus,
} from "@/actions/requests";

const admin = { user: { role: "ADMIN", id: "a1", name: "Sofia Alves" } };
const mota = {
  user: { role: "CLIENT", id: "u1", companyId: "mota", name: "Jorge Mota" },
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.request.create.mockResolvedValue({ id: "req-new" });
  prismaMock.request.update.mockResolvedValue({});
  prismaMock.requestMessage.create.mockResolvedValue({});
  prismaMock.$transaction.mockResolvedValue([]);
});

describe("createRequest", () => {
  it("rejects an admin (only clients create requests)", async () => {
    mockAuth.mockResolvedValue(admin);
    await expect(
      createRequest({ type: "quote", subject: "x", text: "y" })
    ).rejects.toThrow("Não autorizado.");
  });

  it("rejects a client without companyId", async () => {
    mockAuth.mockResolvedValue({ user: { role: "CLIENT", id: "u" } });
    await expect(
      createRequest({ type: "quote", subject: "x", text: "y" })
    ).rejects.toThrow("Não autorizado.");
  });

  it("rejects an empty subject", async () => {
    mockAuth.mockResolvedValue(mota);
    await expect(
      createRequest({ type: "quote", subject: "   ", text: "olá" })
    ).rejects.toThrow();
    expect(prismaMock.request.create).not.toHaveBeenCalled();
  });

  it("creates the request scoped to the client's company with an initial message", async () => {
    mockAuth.mockResolvedValue(mota);
    const id = await createRequest({
      type: "quote",
      subject: "Orçamento M10",
      text: "Preciso de 2000 parafusos",
    });
    expect(id).toBe("req-new");
    const arg = prismaMock.request.create.mock.calls[0][0].data;
    expect(arg.companyId).toBe("mota");
    expect(arg.status).toBe("open");
    expect(arg.messages.create.from).toBe("client");
    expect(arg.messages.create.authorName).toBe("Jorge Mota");
  });
});

describe("addRequestMessage", () => {
  it("rejects an unauthenticated user", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(addRequestMessage("r1", "olá")).rejects.toThrow(
      "Não autorizado."
    );
  });

  it("rejects an empty message", async () => {
    mockAuth.mockResolvedValue(mota);
    await expect(addRequestMessage("r1", "  ")).rejects.toThrow();
  });

  it("throws when the request does not exist", async () => {
    mockAuth.mockResolvedValue(mota);
    prismaMock.request.findUnique.mockResolvedValue(null);
    await expect(addRequestMessage("r1", "olá")).rejects.toThrow(
      "Requerimento não encontrado."
    );
  });

  it("blocks a client from posting to another company's request", async () => {
    mockAuth.mockResolvedValue(mota);
    prismaMock.request.findUnique.mockResolvedValue({
      id: "r1",
      companyId: "santos",
      status: "open",
    });
    await expect(addRequestMessage("r1", "olá")).rejects.toThrow(
      "Não autorizado."
    );
  });

  it("blocks any message on a closed request", async () => {
    mockAuth.mockResolvedValue(admin);
    prismaMock.request.findUnique.mockResolvedValue({
      id: "r1",
      companyId: "mota",
      status: "closed",
    });
    await expect(addRequestMessage("r1", "olá")).rejects.toThrow(
      "Requerimento fechado."
    );
  });

  it("marks the request as responded when the admin replies", async () => {
    mockAuth.mockResolvedValue(admin);
    prismaMock.request.findUnique.mockResolvedValue({
      id: "r1",
      companyId: "mota",
      status: "open",
    });
    await addRequestMessage("r1", "Resposta da fábrica");
    expect(prismaMock.requestMessage.create.mock.calls[0][0].data.from).toBe(
      "admin"
    );
    expect(prismaMock.request.update.mock.calls[0][0].data.status).toBe(
      "responded"
    );
  });

  it("reopens a responded request when the client replies", async () => {
    mockAuth.mockResolvedValue(mota);
    prismaMock.request.findUnique.mockResolvedValue({
      id: "r1",
      companyId: "mota",
      status: "responded",
    });
    await addRequestMessage("r1", "Obrigado, aguardo");
    expect(prismaMock.request.update.mock.calls[0][0].data.status).toBe("open");
  });
});

describe("updateRequestStatus", () => {
  it("rejects a client", async () => {
    mockAuth.mockResolvedValue(mota);
    await expect(updateRequestStatus("r1", "closed")).rejects.toThrow(
      "Não autorizado."
    );
  });

  it("rejects an invalid status", async () => {
    mockAuth.mockResolvedValue(admin);
    await expect(updateRequestStatus("r1", "bogus")).rejects.toThrow();
    expect(prismaMock.request.update).not.toHaveBeenCalled();
  });

  it("updates the status for an admin", async () => {
    mockAuth.mockResolvedValue(admin);
    await updateRequestStatus("r1", "closed");
    expect(prismaMock.request.update.mock.calls[0][0].data.status).toBe(
      "closed"
    );
  });
});
