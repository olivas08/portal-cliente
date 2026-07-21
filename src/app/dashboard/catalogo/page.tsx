export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { getCatalogForCompany } from "@/lib/data";
import { CatalogView } from "@/components/CatalogView";

export default async function CatalogPage() {
  const session = await auth();
  const user = session!.user;
  const products = user.companyId
    ? await getCatalogForCompany(user.companyId)
    : [];

  return <CatalogView products={products} />;
}
