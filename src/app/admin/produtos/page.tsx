export const dynamic = "force-dynamic";

import { getProducts, getCompanies } from "@/lib/data";
import { AdminProductsView } from "@/components/AdminProductsView";

export default async function AdminProductsPage() {
  const [products, companies] = await Promise.all([
    getProducts(),
    getCompanies(),
  ]);

  return (
    <AdminProductsView
      products={products}
      companies={companies.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
