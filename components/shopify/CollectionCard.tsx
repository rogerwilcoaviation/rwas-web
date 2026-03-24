import { ShopifyCollectionSummary } from '@/lib/shopify';
import Image from 'next/image';
import Link from 'next/link';

export default function CollectionCard({ collection }: { collection: ShopifyCollectionSummary }) {
  return (
    <Link
      href={`/collections/${collection.handle}`}
      className="group overflow-hidden rounded-[1.75rem] border border-black/10 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] bg-[#f5f3ef]">
        {collection.image ? (
          <Image
            src={collection.image.url}
            alt={collection.image.altText || collection.title}
            fill
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center text-sm uppercase tracking-[0.28em] text-black/40">
            RWAS Collection
          </div>
        )}
      </div>
      <div className="space-y-3 p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary-700">
          Collection
        </p>
        <h3 className="text-2xl font-bold leading-tight text-[#111111]">
          {collection.title}
        </h3>
        <p className="line-clamp-3 text-sm leading-7 text-black/65">
          {collection.description || 'Browse this RWAS collection.'}
        </p>
      </div>
    </Link>
  );
}
