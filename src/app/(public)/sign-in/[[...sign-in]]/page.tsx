import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/* Only the root is prerendered, so the page builds static (○). */
export function generateStaticParams() {
  return [{ "sign-in": [] }];
}

export default function SignInPage() {
  return (
    <div className="container-page flex flex-col items-center gap-8 py-16 sm:py-24">
      <div className="text-center">
        <h1 className="font-semibold text-3xl text-ink tracking-tight">
          Welcome back
        </h1>
        <p className="mt-2 text-muted">Sign in to write and manage posts.</p>
      </div>
      <div className="card flex w-full max-w-md justify-center p-2 sm:p-4">
        {/* Clerk renders only in the browser, so it gets its own hole. */}
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
          <SignIn />
        </Suspense>
      </div>
    </div>
  );
}
