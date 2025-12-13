
import Image from "next/image";
import Link from "next/link";
import { fetchAPI, getStrapiMedia, BlogPost } from "@/utils/strapi-client";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

async function getPosts() {
    const token = process.env.STRAPI_API_TOKEN;
    console.log("Token Status:", token ? "Token is Present" : "Token is MISSING");

    // Try fetching with preview state to see if it's a draft/publish issue
    const response = await fetchAPI("/blogs", {
        populate: "*",
        publicationState: "preview",
    });

    console.log("Strapi Debug (Preview Mode):", {
        url: "/blogs",
        responseStatus: response ? "Received" : "Null",
        dataLength: response?.data?.length,
        fullResponse: JSON.stringify(response, null, 2)
    });
    return response?.data || [];
}

export default async function BlogPage() {
    const posts: BlogPost[] = await getPosts();

    return (
        <div className="min-h-screen pt-24 pb-12 bg-gray-50/50">
            <div className="container mx-auto px-4">
                <div className="text-center mb-16 space-y-4">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900">
                        Our Blog
                    </h1>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                        Insights, updates, and stories from the Fiscal AI team.
                    </p>
                </div>

                {posts.length === 0 ? (
                    <div className="text-center py-20 text-gray-500">
                        <p>No posts found. Check back soon!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {posts.map((post) => {
                            // Handle Strapi v5 flat structure vs v4
                            const coverData = post.cover as any;
                            const imageUrl = getStrapiMedia(
                                coverData?.url ||
                                coverData?.data?.attributes?.url ||
                                coverData?.data?.url
                            );

                            return (
                                <Card key={post.id} className="flex flex-col h-full hover:shadow-lg transition-shadow duration-300 overflow-hidden border-gray-200">
                                    <div className="relative h-48 w-full overflow-hidden">
                                        {imageUrl ? (
                                            <Image
                                                src={imageUrl}
                                                alt={post.title}
                                                fill
                                                className="object-cover transition-transform duration-500 hover:scale-105"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400">
                                                No Image
                                            </div>
                                        )}
                                    </div>
                                    <CardHeader>
                                        <div className="text-sm text-[#4CAF50] font-medium mb-2">
                                            {new Date(post.publishedAt).toLocaleDateString("en-US", {
                                                month: "long",
                                                day: "numeric",
                                                year: "numeric",
                                            })}
                                        </div>
                                        <CardTitle className="line-clamp-2 text-xl">{post.title}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="flex-grow">
                                        <p className="text-gray-600 line-clamp-3">
                                            {post.description}
                                        </p>
                                    </CardContent>
                                    <CardFooter>
                                        <Link href={`/blog/${post.slug}`} className="w-full">
                                            <Button variant="outline" className="w-full border-[#4CAF50] text-[#4CAF50] hover:bg-[#4CAF50] hover:text-white">
                                                Read More
                                            </Button>
                                        </Link>
                                    </CardFooter>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
