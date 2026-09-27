import Link from "next/link";

export default function DraftNotFound() {
  return (
    <div className="rounded-lg border border-dashed px-6 py-16 text-center">
      <p className="font-medium">
        This draft does not exist, or it belongs to a brand you do not review.
      </p>
      <Link href="/drafts" className="mt-3 inline-block text-sm underline">
        Back to the review queue
      </Link>
    </div>
  );
}
