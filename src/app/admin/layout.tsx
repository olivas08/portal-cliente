import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PortalNav } from "@/components/PortalNav";
import { BreadcrumbProvider } from "@/components/BreadcrumbContext";

const FACTORY_NAME = "Jolucor - Fabricação e Manutenção Industrial, Lda.";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  return (
    <BreadcrumbProvider>
      <div className="min-h-screen bg-slate-50">
        <PortalNav name={user.name ?? ""} company={FACTORY_NAME} isAdmin />
        <div className="md:pl-64">
          <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 md:pb-10">
            {children}
          </main>
        </div>
      </div>
    </BreadcrumbProvider>
  );
}
