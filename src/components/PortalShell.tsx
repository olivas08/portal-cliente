import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PortalNav } from "@/components/PortalNav";

const FACTORY_NAME = "Metalofabril, Lda.";

export async function PortalShell({
  children,
  breadcrumb,
  requiredRole,
}: {
  children: React.ReactNode;
  breadcrumb?: string;
  requiredRole?: "ADMIN" | "CLIENT";
}) {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");

  if (requiredRole && user.role !== requiredRole) {
    redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");
  }

  const isAdmin = user.role === "ADMIN";
  let company = FACTORY_NAME;
  if (!isAdmin && user.companyId) {
    const c = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { name: true },
    });
    company = c?.name ?? "";
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PortalNav
        name={user.name ?? ""}
        company={company}
        isAdmin={isAdmin}
        breadcrumb={breadcrumb}
      />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
