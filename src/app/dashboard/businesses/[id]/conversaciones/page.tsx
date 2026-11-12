import { CrmView } from "../crm/CrmView";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; conv?: string; pipeline?: string }>;
}) {
  const { id } = await params;
  return <CrmView id={id} section="conversaciones" query={await searchParams} />;
}
