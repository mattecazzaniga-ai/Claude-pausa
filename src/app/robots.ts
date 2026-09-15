import type { MetadataRoute } from "next";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Everything behind login — crawling it wastes crawl budget on pages
      // that just redirect to /login for an anonymous visitor anyway.
      disallow: [
        "/dashboard",
        "/athletes",
        "/teams",
        "/calendar",
        "/exercises",
        "/payments",
        "/sessions",
        "/onboarding",
        "/api",
      ],
    },
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
