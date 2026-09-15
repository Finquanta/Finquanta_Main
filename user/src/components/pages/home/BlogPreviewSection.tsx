"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { listBlogPosts, BlogPost } from "@/lib/api/blog";
import { useLanguage } from '@/hooks/context/LanguageContext';

export default function BlogPreviewSection() {
  const { t } = useLanguage();
  const [posts, setPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    listBlogPosts().then((p) => setPosts(p.slice(0, 3))).catch(() => {});
  }, []);

  // Don't render an empty section before any posts are published.
  if (posts.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-28">
      <div className="mb-10 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-medium tracking-[-0.03em] text-fq-ink sm:text-4xl">{t('pricing', 'pBlogTitle')}</h2>
          <p className="mt-2 text-fq-slate">{t('pricing', 'pBlogSub')}</p>
        </div>
        <Link href="/blog" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-fq-ink underline-offset-4 hover:underline">
          {t('pricing', 'pBlogAll')}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/blog/${post.slug}`}
            className="group flex flex-col overflow-hidden rounded-2xl border border-fq-ink/10 bg-white transition-shadow hover:shadow-[0_20px_50px_-25px_rgba(15,18,16,0.35)]"
          >
            <div className="h-44 overflow-hidden bg-fq-card-alt">
              {post.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.coverImageUrl} alt={post.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none" />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-semibold text-fq-slate/60">Finquanta</div>
              )}
            </div>
            <div className="p-5">
              <div className="mb-2 text-xs font-medium text-[#1E9E2A]">
                {new Date(post.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </div>
              <h3 className="line-clamp-2 font-semibold text-fq-ink">{post.title}</h3>
              <p className="mt-2 line-clamp-2 text-sm text-fq-slate">{post.excerpt}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
