import { PageSkeleton } from "@/components/PageSkeleton";

// Shown at once when navigating here, so a tap never looks like it did nothing.
export default function Loading() {
  return <PageSkeleton />;
}
