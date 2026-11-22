export type ShareNetwork = "x" | "bluesky" | "linkedin" | "facebook" | "email";

export type ShareLink = {
  network: ShareNetwork;
  label: string;
  href: string;
};

/** Ready-made share URLs for a page, one per network, in display order. */
export function shareLinks(url: string, title: string): ShareLink[] {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  return [
    {
      network: "x",
      label: "X",
      href: `https://x.com/intent/post?text=${t}&url=${u}`,
    },
    {
      network: "bluesky",
      label: "Bluesky",
      href: `https://bsky.app/intent/compose?text=${encodeURIComponent(`${title} ${url}`)}`,
    },
    {
      network: "linkedin",
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    },
    {
      network: "facebook",
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    },
    {
      network: "email",
      label: "Email",
      href: `mailto:?subject=${t}&body=${u}`,
    },
  ];
}
