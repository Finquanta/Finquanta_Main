"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listBlogPosts, BlogPost } from "@/lib/api/blog";

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listBlogPosts().then(setPosts).catch(() => setPosts([])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen pt-24 pb-12 bg-gray-50/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900">Our Blog</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Insights, updates, and stories from the Finquanta AI team.
          </p>
        </div>

        {loading ? (
          <p className="text-center py-20 text-gray-500">Loading…</p>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p>No posts yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="flex flex-col h-full rounded-xl overflow-hidden border border-gray-200 bg-white hover:shadow-lg transition-shadow duration-300"
              >
                <div className="relative h-48 w-full overflow-hidden bg-gray-100">
                  {post.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.coverImageUrl} alt={post.title} className="object-cover w-full h-full" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 font-semibold">
                      Finquanta
                    </div>
                  )}
                </div>
                <div className="p-5 flex flex-col flex-grow">
                  <div className="text-sm text-[#4CAF50] font-medium mb-2">
                    {new Date(post.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </div>
                  <h2 className="text-xl font-semibold line-clamp-2 text-gray-900">{post.title}</h2>
                  <p className="text-gray-600 line-clamp-3 mt-2 flex-grow">{post.excerpt}</p>
                  <span className="mt-4 text-[#4CAF50] font-medium text-sm">Read more →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
