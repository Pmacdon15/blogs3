"use client";

import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/*
 * The user menu, entirely on the client: reading the session here instead of
 * in a server layout keeps every page's static shell (the public pages build
 * as fully static ○ routes).
 */
export function AuthButtons({
  showAdminLink = true,
}: {
  showAdminLink?: boolean;
}) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return <Skeleton className="h-9 w-24 rounded-xl" />;

  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <button className={buttonClasses("secondary", "sm")} type="button">
          Sign in
        </button>
      </SignInButton>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {showAdminLink ? (
        <Link className={buttonClasses("ghost", "sm")} href="/admin">
          Write
        </Link>
      ) : null}
      <UserButton />
    </div>
  );
}
