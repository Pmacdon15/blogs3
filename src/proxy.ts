import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/*
 * Signed-out visitors to /admin go to sign-in. This runs before rendering, so
 * it doesn't affect prerendering; the DAL still checks the admin on every
 * read and write.
 */
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export const proxy = clerkMiddleware(async (auth, req) => {
  if (isAdminRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|pptx?)).*)",
    "/(api|trpc)(.*)",
  ],
};
