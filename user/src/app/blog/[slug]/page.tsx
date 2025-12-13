
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchAPI, getStrapiMedia, BlogPost } from "@/utils/strapi-client";
import { Button } from "@/components/ui/button";

async function getPost(slug: string) {
    console.log("Fetching post for slug:", slug);
    const response = await fetchAPI("/blogs", {
        filters: {
            slug: {
                $eq: slug,
            },
        },
        populate: "*",
        publicationState: "preview",
    });

    console.log("Blog Post Response:", {
        slug,
        found: response?.data?.length > 0,
        data: response?.data?.[0] ? "Data exists" : "No data"
    });

    if (!response?.data || response.data.length === 0) {
        return null;
    }

    return response.data[0];
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
    const post: BlogPost | null = await getPost(params.slug);

    if (!post) {
        notFound();
    }

    const coverData = post.cover as any;
    const imageUrl = getStrapiMedia(
        coverData?.url ||
        coverData?.data?.attributes?.url ||
        coverData?.data?.url
    );

    // Helper to render content if it's rich text (blocks) or just string
    const renderContent = (content: any) => {
        if (typeof content === 'string') {
            return content;
        }
        // Simple block renderer for Strapi v5 Blocks
        if (Array.isArray(content)) {
            return content.map((block: any, index: number) => {
                if (block.type === 'paragraph') {
                    return (
                        <p key={index} className="mb-4">
                            {block.children.map((child: any) => child.text).join('')}
                        </p>
                    );
                }
                if (block.type === 'heading') {
                    const Tag = `h${block.level}` as keyof JSX.IntrinsicElements;
                    return (
                        <Tag key={index} className="font-bold my-4">
                            {block.children.map((child: any) => child.text).join('')}
                        </Tag>
                    );
                }
                if (block.type === 'list') {
                    const Tag = block.format === 'ordered' ? 'ol' : 'ul';
                    return (
                        <Tag key={index} className="list-disc pl-5 my-4">
                            {block.children.map((item: any, i: number) => (
                                <li key={i}>{item.children.map((child: any) => child.text).join('')}</li>
                            ))}
                        </Tag>
                    );
                }
                return null;
            });
        }
        return JSON.stringify(content);
    };

    return (
        <article className="min-h-screen pt-24 pb-12 bg-white">
            <div className="container mx-auto px-4 max-w-4xl">
                <Link href="/blog" className="inline-block mb-8">
                    <Button variant="ghost" className="pl-0 hover:pl-2 transition-all text-gray-600 hover:text-[#4CAF50]">
                        ← Back to Blog
                    </Button>
                </Link>

                <header className="mb-8 text-center space-y-4">
                    <div className="text-sm font-medium text-[#4CAF50]">
                        {new Date(post.publishedAt).toLocaleDateString("en-US", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                        })}
                    </div>
                    <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-gray-900 leading-tight">
                        {post.title}
                    </h1>
                </header>

                {imageUrl && (
                    <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-lg mb-10">
                        <Image
                            src={imageUrl}
                            alt={post.title}
                            fill
                            className="object-cover"
                            priority
                        />
                    </div>
                )}

                <div className="prose prose-lg prose-green mx-auto text-gray-700 whitespace-pre-wrap">
                    {renderContent(post.content)}
                </div>
            </div>
        </article>
    );
}
