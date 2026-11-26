import { ArrowUpRight, GraduationCap, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { AUTHOR } from "@/lib/about";
import { profilePageJsonLd } from "@/lib/seo";

const description = `${AUTHOR.name}: ${AUTHOR.headline.toLowerCase()} in ${AUTHOR.location}.`;

export const metadata: Metadata = {
  title: "About",
  description,
  alternates: { canonical: "/about" },
  openGraph: {
    type: "profile",
    title: `About ${AUTHOR.name}`,
    description,
    url: "/about",
  },
  twitter: { card: "summary", title: `About ${AUTHOR.name}`, description },
};

const initials = AUTHOR.name
  .split(" ")
  .map((part) => part[0])
  .join("");

/* Reads nothing from the request or the database: builds fully static (○). */
export default function AboutPage() {
  return (
    <>
      <JsonLd data={profilePageJsonLd()} />
      <div className="container-page flex max-w-4xl flex-col gap-14 py-14 sm:py-20">
        <section className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
          <div
            aria-hidden="true"
            className="flex size-24 shrink-0 items-center justify-center rounded-3xl bg-linear-to-br from-brand-500 to-brand-800 font-semibold text-3xl text-white shadow-lg shadow-brand-500/20"
          >
            {initials}
          </div>
          <div className="flex flex-col gap-3">
            <h1 className="text-balance font-semibold text-4xl text-ink tracking-tight sm:text-5xl">
              Hi, I&apos;m {AUTHOR.name.split(" ")[0]}
            </h1>
            <p className="text-lg text-muted">{AUTHOR.headline}</p>
            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-muted text-sm">
              <li className="flex items-center gap-1.5">
                <MapPin aria-hidden="true" className="size-4" />
                {AUTHOR.location}
              </li>
              <li className="flex items-center gap-1.5">
                <GraduationCap aria-hidden="true" className="size-4" />
                {AUTHOR.education}
              </li>
            </ul>
          </div>
        </section>

        <section aria-labelledby="bio-heading" className="flex flex-col gap-4">
          <h2
            className="font-semibold text-2xl text-ink tracking-tight"
            id="bio-heading"
          >
            About me
          </h2>
          {AUTHOR.bio.map((paragraph) => (
            <p className="text-ink/90 text-lg leading-relaxed" key={paragraph}>
              {paragraph}
            </p>
          ))}
          <ul className="flex flex-wrap gap-3 pt-2">
            {AUTHOR.links.map((link) => (
              <li key={link.href}>
                <a
                  className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2 font-medium text-ink text-sm transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                  href={link.href}
                  rel="me noopener"
                  target="_blank"
                >
                  {link.label}
                  <ArrowUpRight aria-hidden="true" className="size-4" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="skills-heading"
          className="flex flex-col gap-4"
        >
          <h2
            className="font-semibold text-2xl text-ink tracking-tight"
            id="skills-heading"
          >
            What I work with
          </h2>
          <ul className="flex flex-wrap gap-2">
            {AUTHOR.skills.map((skill) => (
              <li
                className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1 font-medium text-brand-700 text-sm"
                key={skill}
              >
                {skill}
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="projects-heading"
          className="flex flex-col gap-6"
        >
          <div className="flex flex-col gap-1">
            <h2
              className="font-semibold text-2xl text-ink tracking-tight"
              id="projects-heading"
            >
              Projects
            </h2>
            <p className="text-muted">A few things I&apos;ve built.</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {AUTHOR.projects.map((project) => (
              <li key={project.href}>
                <a
                  className="group flex h-full flex-col gap-2 rounded-2xl border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-brand-500/10 hover:shadow-lg"
                  href={project.href}
                  rel="noopener"
                  target="_blank"
                >
                  <span className="flex items-center justify-between gap-2 font-semibold text-ink group-hover:text-brand-700">
                    {project.name}
                    <ArrowUpRight aria-hidden="true" className="size-4" />
                  </span>
                  <span className="text-muted text-sm leading-relaxed">
                    {project.description}
                  </span>
                  <span className="mt-auto pt-2 font-medium text-brand-700 text-xs">
                    {project.stack}
                  </span>
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
