export const dynamic = "force-dynamic";

import { getOpenNonConformities } from "@/lib/data";
import { QualityView } from "@/components/QualityView";

export default async function AdminQualityPage() {
  const nonConformities = await getOpenNonConformities();
  return <QualityView nonConformities={nonConformities} />;
}
