"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getBlogPost, BlogPost } from "@/lib/api/blog";

export default function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [post, setPost] = useState<BlogPost | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound">("loading");

  useEffect(() => {
    getBlogPost(slug)
      .then((p) => { setPost(p); setStatus("ready"); })
      .catch(() => setStatus("notfound"));
  }, [slug]);

  if (status === "loading") {
    return <div className="min-h-screen pt-24 text-center text-gray-500">Loading…</div>;
  }

  if (status === "notfound" || !post) {
    return (
      <div className="min-h-screen pt-24 pb-12 text-center">
        <p className="text-gray-600 mb-6">This post doesn&apos;t exist or hasn&apos;t been published.</p>
        <Link href="/blog" className="text-[#4CAF50] font-medium hover:underline">← Back to Blog</Link>
      </div>
    );
  }

  return (
    <article className="min-h-screen pt-24 pb-12 bg-white">
      <div className="container mx-auto px-4 max-w-4xl">
        <Link href="/blog" className="inline-block mb-8 text-gray-600 hover:text-[#4CAF50] transition-colors">
          ← Back to Blog
        </Link>

        <header className="mb-8 text-center space-y-4">
          <div className="text-sm font-medium text-[#4CAF50]">
            {new Date(post.createdAt).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            {post.authorName ? ` · ${post.authorName}` : ""}
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-gray-900 leading-tight">{post.title}</h1>
        </header>

        {post.coverImageUrl && (
          <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-lg mb-10 bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.coverImageUrl} alt={post.title} className="object-cover w-full h-full" />
          </div>
        )}

        <div className="prose prose-lg mx-auto text-gray-700 whitespace-pre-wrap leading-relaxed">
          {post.content}
        </div>
      </div>
    </article>
  );
}
