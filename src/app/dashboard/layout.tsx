import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PortalNav } from "@/components/PortalNav";
import { BreadcrumbProvider } from "@/components/BreadcrumbContext";
import {
  getCompanyName,
  getNotificationsForUser,
  getUnreadNotificationCount,
} from "@/lib/data";
import { isClientRole } from "@/lib/roles";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  if (!isClientRole(user.role)) redirect("/admin");

  let company = "";
  if (user.companyId) {
    company = await getCompanyName(user.companyId);
  }

  const [notifications, unreadCount] = await Promise.all([
    getNotificationsForUser(user.id),
    getUnreadNotificationCount(user.id),
  ]);

  return (
    <BreadcrumbProvider>
      <div className="min-h-screen bg-slate-50">
        <PortalNav
          name={user.name ?? ""}
          company={company}
          isAdmin={false}
          role={user.role}
          notifications={notifications}
          unreadCount={unreadCount}
        />
        <div className="md:pl-64">
          <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 md:pb-10">
            {children}
          </main>
        </div>
      </div>
    </BreadcrumbProvider>
  );
}
