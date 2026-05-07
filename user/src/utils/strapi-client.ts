export const STRAPI_API_URL = process.env.NEXT_PUBLIC_STRAPI_API_URL || "http://localhost:1337";

export interface BlogPost {
    id: number;
    documentId: string;
    title: string;
    slug: string;
    description: string;
    content: any; // Rich text or blocks
    publishedAt: string;
    cover: {
        data: {
            attributes: {
                url: string;
            };
        } | null;
        // Strapi v5 might also flatten media, we'll check, but often media is still structured or just an object
        url?: string;
    } | null;
}

export interface Meta {
    pagination: {
        page: number;
        pageSize: number;
        pageCount: number;
        total: number;
    };
}

export interface StrapiResponse<T> {
    data: T;
    meta: Meta;
}

// Mock data to use if API fails or is not configured
const MOCK_POSTS: BlogPost[] = [
    {
        id: 1,
        documentId: "mock1",
        title: "Getting Started with Finquanta AI",
        slug: "getting-started-with-Finquanta-ai",
        description: "Learn how to optimize your financial workflows with our latest tools.",
        content: "This is a detailed guide on how to get started...",
        publishedAt: new Date().toISOString(),
        cover: {
            data: {
                attributes: {
                    url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2426&auto=format&fit=crop",
                },
            },
        },
    },
    {
        id: 2,
        documentId: "mock2",
        title: "The Future of Finance",
        slug: "the-future-of-finance",
        description: "Trends to watch in the coming year for fintech and personal finance.",
        content: "The landscape of finance is changing rapidly...",
        publishedAt: new Date(Date.now() - 86400000).toISOString(),
        cover: {
            data: {
                attributes: {
                    url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2670&auto=format&fit=crop",
                },
            },
        },
    },
    {
        id: 3,
        documentId: "mock3",
        title: "Tax Season Tips 2024",
        slug: "tax-season-tips-2024",
        description: "Maximize your returns with these essential tax filing tips.",
        content: "Don't leave money on the table this tax season...",
        publishedAt: new Date(Date.now() - 172800000).toISOString(),
        cover: {
            data: {
                attributes: {
                    url: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=2626&auto=format&fit=crop",
                },
            },
        },
    },
];

// Helper to serialize nested objects for Strapi (which expects qs format)
function serializeParams(params: any, prefix = ""): string {
    const query: string[] = [];
    for (const key in params) {
        if (Object.prototype.hasOwnProperty.call(params, key)) {
            const value = params[key];
            const newKey = prefix ? `${prefix}[${key}]` : key;
            if (value !== null && typeof value === "object") {
                query.push(serializeParams(value, newKey));
            } else {
                query.push(`${newKey}=${encodeURIComponent(String(value))}`);
            }
        }
    }
    return query.join("&");
}

export async function fetchAPI(path: string, urlParamsObject = {}, options = {}) {
    try {
        // Merge default and user options
        const mergedOptions = {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}`,
            },
            ...options,
        };

        // Build request URL
        // Use custom serializer because URLSearchParams doesn't handle nested objects (e.g. filters)
        const queryString = serializeParams(urlParamsObject);
        const requestUrl = `${STRAPI_API_URL}/api${path}${queryString ? `?${queryString}` : ""}`;

        // Trigger API call
        const response = await fetch(requestUrl, mergedOptions);
        const data = await response.json();
        return data;
    } catch (error) {
        console.warn("Strapi API fetch failed, falling back to mock data.", error);
        // Return mock data for specific paths (simplified)
        if (path.includes("/blogs") || path.includes("blogs")) {
            return { data: MOCK_POSTS, meta: { pagination: { page: 1, pageSize: 10, pageCount: 1, total: 3 } } };
        }
        return null;
    }
}

export function getStrapiMedia(url: string | null) {
    if (url == null) {
        return null;
    }

    // Return the full URL if the media is hosted on an external provider
    if (url.startsWith("http") || url.startsWith("//")) {
        return url;
    }

    // Otherwise prepend the Strapi URL
    return `${STRAPI_API_URL}${url}`;
}
