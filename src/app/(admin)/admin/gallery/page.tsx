import type { Metadata } from "next";
import Image from "next/image";
import { PageHeader, Panel } from "@/components/admin/AdminUi";
import Icon from "@/components/Icon";
import { categoryLabel, galleryItems, reels } from "@/data/gallery";
import { requireSuperAdmin } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Gallery" };

/**
 * The published gallery, read-only. The photos are approved Sabor con Amor
 * media shipped with the site (src/data/gallery.ts → public/images). Uploading,
 * hiding or reordering from here needs file storage, which is not configured:
 * Firebase Storage is disabled (storage.rules deny every read and write) until
 * the business decides how admins should manage media.
 */
export default async function AdminGalleryPage() {
  // Authorization close to the data: a layout check alone doesn't stop this
  // segment rendering (Next.js partial rendering), so every admin page verifies.
  await requireSuperAdmin("/admin/gallery");
  const featured = galleryItems.filter((g) => g.featured).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Media"
        title="Gallery"
        subtitle={`${galleryItems.length} photos published on the website (${featured} featured on the home page) · ${reels.length} videos.`}
      />

      <section aria-labelledby="gallery-storage-title" className="rounded-lg border border-status-pending/25 bg-status-pending-bg p-5 text-sm text-status-pending sm:p-6">
        <h2 id="gallery-storage-title" className="flex items-center gap-2 font-semibold">
          <Icon name="alert" className="h-4 w-4" />
          Uploads are not available yet
        </h2>
        <p className="mt-2 leading-relaxed">
          Media storage is not configured, so photos can&rsquo;t be uploaded, hidden or reordered here. The gallery below is the
          approved set shipped with the website; changing it is a code change for now. Enabling uploads needs a decision on storage
          (Firebase Storage on the Sabor con Amor project, with rules allowing only Super Admin writes) and on moderation.
        </p>
      </section>

      <Panel title="Published photos">
        {galleryItems.length === 0 ? (
          <p className="text-sm text-ink-muted">No photos are published.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {galleryItems.map((g) => (
              <li key={g.id} className="overflow-hidden rounded-md border border-line bg-surface-low">
                <div className="relative aspect-[4/3] bg-surface-high">
                  <Image src={g.image} alt={g.caption} fill sizes="(min-width: 1280px) 220px, (min-width: 640px) 30vw, 45vw" className="object-cover" />
                  {g.featured && (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-imperial px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.06em] text-brass-light">
                      <Icon name="star" className="h-3 w-3" />
                      Home page
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-ink">{g.title}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{categoryLabel[g.category]} · {g.width}×{g.height}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-soft">{g.caption}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Videos">
        <p className="text-sm text-ink-soft">
          {reels.length === 0
            ? "No videos are published. The supplied clips include a presenter, burnt-in text and identifiable guests, so approved cuts are needed first."
            : `${reels.length} videos published.`}
        </p>
      </Panel>
    </div>
  );
}
