import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/*
 * Signed-out visitors to /admin go to sign-in. This runs before rendering, so
 * it doesn't affect prerendering; the DAL still checks the admin on every
 * read and write. /admin/mcp is the public MCP connection guide (named in
 * /.well-known/oauth-protected-resource as resource_documentation) and reads
 * no private data.
 */
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isPublicAdminRoute = createRouteMatcher(["/admin/mcp"]);

export const proxy = clerkMiddleware(async (auth, req) => {
  if (isAdminRoute(req) && !isPublicAdminRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|pptx?)).*)",
    "/(api|trpc)(.*)",
  ],
};
