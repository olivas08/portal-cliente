export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getRequestById, getAllRequests } from "@/lib/data";
import { RequestDetail } from "@/components/RequestDetail";

export default async function AdminRequestDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const request = await getRequestById(id);
  if (!request) notFound();

  const allRequests = await getAllRequests();

  return <RequestDetail request={request} requests={allRequests} isAdmin />;
}
