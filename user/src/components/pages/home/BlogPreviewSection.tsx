"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listBlogPosts, BlogPost } from "@/lib/api/blog";

export default function BlogPreviewSection() {
  const [posts, setPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    listBlogPosts().then((p) => setPosts(p.slice(0, 3))).catch(() => {});
  }, []);

  // Don't render an empty section before any posts are published.
  if (posts.length === 0) return null;

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">From the blog</h2>
            <p className="text-gray-600 mt-2">Insights and updates from the Finquanta AI team.</p>
          </div>
          <Link href="/blog" className="hidden sm:inline text-[#4CAF50] font-medium hover:underline">View all →</Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {posts.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`} className="flex flex-col rounded-xl overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="h-44 bg-gray-100 overflow-hidden">
                {post.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.coverImageUrl} alt={post.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 font-semibold">Finquanta</div>
                )}
              </div>
              <div className="p-5">
                <div className="text-xs text-[#4CAF50] font-medium mb-2">
                  {new Date(post.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </div>
                <h3 className="font-semibold text-gray-900 line-clamp-2">{post.title}</h3>
                <p className="text-gray-600 text-sm line-clamp-2 mt-2">{post.excerpt}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 sm:hidden text-center">
          <Link href="/blog" className="text-[#4CAF50] font-medium hover:underline">View all →</Link>
        </div>
      </div>
    </section>
  );
}
