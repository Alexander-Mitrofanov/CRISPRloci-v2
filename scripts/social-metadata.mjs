const defaultSiteUrl = "https://alexander-mitrofanov.github.io/CRISPRloci-v2/";
const imageAlt =
  "CRISPRloci symbol: two offset genomic arrows in rose and white, " +
  "with aligned notches on charcoal. No lettering.";

export function socialMetadata(value = defaultSiteUrl) {
  let site;
  try {
    site = new URL(value);
  } catch {
    throw new Error("VITE_SITE_URL must be an absolute HTTPS site URL.");
  }
  if (site.protocol !== "https:" || site.username || site.password || site.search || site.hash) {
    throw new Error("VITE_SITE_URL must use HTTPS without credentials, query, or fragment.");
  }
  site.pathname = `${site.pathname.replace(/\/+$/u, "")}/`;
  const image = new URL("brand/social-preview.png?v=4", site).href;
  return {
    name: "public-social-metadata",
    transformIndexHtml() {
      // Emit static tags so link crawlers do not need to execute the application.
      return [
        { tag: "meta", attrs: { property: "og:url", content: site.href } },
        { tag: "meta", attrs: { property: "og:image", content: image } },
        { tag: "meta", attrs: { property: "og:image:type", content: "image/png" } },
        { tag: "meta", attrs: { property: "og:image:width", content: "1200" } },
        { tag: "meta", attrs: { property: "og:image:height", content: "630" } },
        { tag: "meta", attrs: { property: "og:image:alt", content: imageAlt } },
        { tag: "meta", attrs: { name: "twitter:image", content: image } },
        { tag: "meta", attrs: { name: "twitter:image:alt", content: imageAlt } },
      ];
    },
  };
}
