export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth-guard";
import { getRequestById, getRequestsForCompany } from "@/lib/data";
import { RequestDetail } from "@/components/RequestDetail";

export default async function ClientRequestDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireSessionUser();
  if (!user.companyId) redirect("/dashboard/requerimentos");

  const request = await getRequestById(id, user.companyId);
  if (!request) notFound();

  const allRequests = user.companyId
    ? await getRequestsForCompany(user.companyId)
    : [];

  return (
    <RequestDetail request={request} requests={allRequests} isAdmin={false} />
  );
}
