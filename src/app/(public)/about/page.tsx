import { ArrowUpRight, Globe, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { GitHubIcon, LinkedInIcon } from "@/components/blog/social-icons";
import { JsonLd } from "@/components/seo/json-ld";
import { AUTHOR, personJsonLd } from "@/lib/seo";

const DESCRIPTION = `${AUTHOR.name} is a software developer in ${AUTHOR.location} building for the web with Next.js, React, TypeScript and PostgreSQL.`;

export const metadata: Metadata = {
  title: "About",
  description: DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: {
    type: "profile",
    title: `About ${AUTHOR.name}`,
    description: DESCRIPTION,
    url: "/about",
  },
  twitter: {
    card: "summary",
    title: `About ${AUTHOR.name}`,
    description: DESCRIPTION,
  },
};

const LINKS = [
  {
    label: "Website",
    handle: "patmac.ca",
    href: AUTHOR.website,
    icon: Globe,
  },
  {
    label: "GitHub",
    handle: "@Pmacdon15",
    href: AUTHOR.github,
    icon: GitHubIcon,
  },
  {
    label: "LinkedIn",
    handle: "Patrick MacDonald",
    href: AUTHOR.linkedin,
    icon: LinkedInIcon,
  },
] as const;

const STACK = [
  "Next.js",
  "React",
  "TypeScript",
  "Tailwind CSS",
  "PostgreSQL",
  "Vercel",
  "C#",
  "Java / Android",
] as const;

/* Static content only: the whole page prerenders (○). */
export default function AboutPage() {
  return (
    <>
      <JsonLd data={personJsonLd()} />
      <div className="container-page py-16 sm:py-24">
        <article className="mx-auto flex max-w-3xl flex-col gap-10">
          <header className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <div
              aria-hidden="true"
              className="grid size-20 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-brand-400 via-brand-600 to-brand-800 font-semibold text-2xl text-white shadow-(--shadow-card)"
            >
              PM
            </div>
            <div className="flex flex-col gap-2">
              <p className="font-medium text-brand-700 text-sm">
                About the author
              </p>
              <h1 className="font-semibold text-4xl text-ink tracking-tight sm:text-5xl">
                {AUTHOR.name}
              </h1>
              <p className="inline-flex items-center gap-1.5 text-muted">
                <MapPin aria-hidden="true" className="size-4" />
                {AUTHOR.location}
              </p>
            </div>
          </header>

          <div className="flex flex-col gap-4 text-ink/90 text-lg leading-relaxed">
            <p>
              I&apos;m a software developer and a graduate of Bow Valley
              College&apos;s Software Development diploma. Most of what I build
              these days is for the web, with Next.js, React and TypeScript on
              the front and PostgreSQL behind it, shipped on Vercel.
            </p>
            <p>
              This blog is where I write up what I learn along the way: what
              worked, what didn&apos;t, and the code to prove it. You can find
              my other projects on my website and GitHub.
            </p>
          </div>

          <section
            aria-labelledby="stack-heading"
            className="flex flex-col gap-3"
          >
            <h2
              className="font-semibold text-ink text-xl tracking-tight"
              id="stack-heading"
            >
              What I work with
            </h2>
            <ul className="flex flex-wrap gap-2">
              {STACK.map((item) => (
                <li
                  className="rounded-full border border-line bg-surface px-3 py-1 text-muted text-sm"
                  key={item}
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section
            aria-labelledby="links-heading"
            className="flex flex-col gap-3"
          >
            <h2
              className="font-semibold text-ink text-xl tracking-tight"
              id="links-heading"
            >
              Find me elsewhere
            </h2>
            <ul className="grid gap-3 sm:grid-cols-3">
              {LINKS.map(({ label, handle, href, icon: Icon }) => (
                <li key={label}>
                  <a
                    className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-4 transition hover:border-brand-300 hover:shadow-(--shadow-card)"
                    href={href}
                    rel="me noopener noreferrer"
                    target="_blank"
                  >
                    <Icon className="size-5 shrink-0 text-ink" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium text-ink">{label}</span>
                      <span className="truncate text-muted text-sm">
                        {handle}
                      </span>
                    </span>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="size-4 text-muted transition group-hover:text-brand-700"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </article>
      </div>
    </>
  );
}
