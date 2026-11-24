import { redirect } from "next/navigation";

// "Crear con IA" now lives in the "Sitio web" screen (the third tab); old links land there.
export default async function CreateWebsitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/businesses/${id}/website?tab=ia`);
}
