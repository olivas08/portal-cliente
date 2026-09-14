export const dynamic = "force-dynamic";

import { requireSessionUser } from "@/lib/auth-guard";
import { getCatalogForCompany } from "@/lib/data";
import { CatalogView } from "@/components/CatalogView";

export default async function CatalogPage() {
  const user = await requireSessionUser();
  const products = user.companyId
    ? await getCatalogForCompany(user.companyId)
    : [];

  return <CatalogView products={products} />;
}
