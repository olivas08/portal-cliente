export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRequestById, getRequestsForCompany } from "@/lib/data";
import { RequestDetail } from "@/components/RequestDetail";

export default async function ClientRequestDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const user = session!.user;

  const request = await getRequestById(id);
  if (!request) notFound();
  if (request.companyId !== user.companyId) redirect("/dashboard/requerimentos");

  const allRequests = user.companyId
    ? await getRequestsForCompany(user.companyId)
    : [];

  return (
    <RequestDetail request={request} requests={allRequests} isAdmin={false} />
  );
}
