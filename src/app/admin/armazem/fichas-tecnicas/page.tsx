export const dynamic = "force-dynamic";

import { getMaterials, getProductsWithBom } from "@/lib/data";
import { BomManager } from "@/components/BomManager";

export default async function AdminBomPage() {
  const [products, materials] = await Promise.all([
    getProductsWithBom(),
    getMaterials(),
  ]);
  return <BomManager products={products} materials={materials} />;
}
