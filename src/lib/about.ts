/*
 * The author's profile for /about, from github.com/pmacdon15. Edit here; the
 * page and its JSON-LD read from this one place.
 */

export type ProfileLink = { label: string; href: string };

export type Project = {
  name: string;
  description: string;
  stack: string;
  href: string;
};

export const AUTHOR = {
  name: "Patrick MacDonald",
  handle: "Pmacdon15",
  location: "Calgary, Alberta",
  headline: "Software developer building for the web",
  education: "Diploma in Software Development, Bow Valley College",
  bio: [
    "I'm a software developer in Calgary and a graduate of Bow Valley College's Software Development diploma. I like building robust, scalable applications, and most of what I make these days is full-stack React and Next.js with TypeScript.",
    "This blog is where I write up what I learn along the way: what worked, what didn't, and the code to prove it.",
  ],
  skills: [
    "TypeScript",
    "React",
    "Next.js",
    "Tailwind CSS",
    "PostgreSQL",
    "SQL",
    "Vercel",
    "C#",
    "Java",
    "Android",
    "Python",
  ],
  links: [
    { label: "Portfolio", href: "https://www.patmac.ca" },
    { label: "GitHub", href: "https://github.com/pmacdon15" },
    {
      label: "LinkedIn",
      href: "https://www.linkedin.com/in/patrick-macdonald-231640285",
    },
  ] satisfies ProfileLink[],
  projects: [
    {
      name: "Landscape Friend",
      description: "A web app for running a landscaping business.",
      stack: "Next.js · TypeScript",
      href: "https://landscapefriend.com",
    },
    {
      name: "Clock Out",
      description: "Clock in, clock out and keep track of your hours.",
      stack: "Next.js · TypeScript",
      href: "https://clock-out.patmac.ca",
    },
    {
      name: "Pat's Pretrips",
      description: "Track vehicle pre-trip inspections.",
      stack: "TypeScript",
      href: "https://github.com/Pmacdon15/pats-pretrips",
    },
    {
      name: "Budget",
      description: "A personal budgeting app.",
      stack: "TypeScript",
      href: "https://github.com/Pmacdon15/Budget",
    },
    {
      name: "PatGPT",
      description: "A simple Android app that uses the ChatGPT API.",
      stack: "Java · Android",
      href: "https://github.com/Pmacdon15/PatGPT",
    },
    {
      name: "Guess the Celebrity",
      description: "An Android game: name the celebrity from their mugshot.",
      stack: "Java · Android",
      href: "https://github.com/Pmacdon15/Guess-The-Celebrity-Game",
    },
  ] satisfies Project[],
} as const;
