import { redirect } from "next/navigation";
import { CrmView } from "./CrmView";

export default async function CrmPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; conv?: string; pipeline?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;

  // Conversaciones and Difusiones used to be tabs of the CRM. Old links
  // (?tab=chat, ?tab=broadcasts, notifications, bookmarks) land on the new pages.
  if (query.tab === "chat" || query.tab === "broadcasts") {
    const rest = new URLSearchParams();
    if (query.tab === "chat" && query.conv) rest.set("conv", query.conv);
    if (query.pipeline) rest.set("pipeline", query.pipeline);
    const suffix = rest.toString();
    redirect(`/dashboard/businesses/${id}/${query.tab === "chat" ? "conversaciones" : "difusiones"}${suffix ? `?${suffix}` : ""}`);
  }

  return <CrmView id={id} section="crm" query={query} />;
}
