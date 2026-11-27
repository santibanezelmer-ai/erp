import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/c/"],
        disallow: ["/api/", "/auth/", "/login", "/registro", "/onboarding", "/unirse", "/invitacion"],
      },
    ],
    sitemap: "https://operixerp.cloud/sitemap.xml",
  };
}
