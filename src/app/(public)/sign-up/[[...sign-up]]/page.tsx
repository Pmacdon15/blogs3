import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Sign up",
  robots: { index: false, follow: false },
};

/* Only the root is prerendered, so the page builds static (○). */
export function generateStaticParams() {
  return [{ "sign-up": [] }];
}

export default function SignUpPage() {
  return (
    <div className="container-page flex flex-col items-center gap-8 py-16 sm:py-24">
      <div className="text-center">
        <h1 className="font-semibold text-3xl text-ink tracking-tight">
          Create your account
        </h1>
        <p className="mt-2 text-muted">
          Set up the account that writes this blog.
        </p>
      </div>
      <div className="card flex w-full max-w-md justify-center p-2 sm:p-4">
        {/* Clerk renders only in the browser, so it gets its own hole. */}
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
          <SignUp />
        </Suspense>
      </div>
    </div>
  );
}
