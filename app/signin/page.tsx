import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AuthForm from "@/components/AuthForm";
import SiteHeader from "@/components/SiteHeader";
import { safePath } from "@/lib/safePath";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; reason?: string }> }) {
  const params = await searchParams;
  const callbackUrl = safePath(params.callbackUrl);
  if ((await auth())?.user) redirect(callbackUrl);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-5 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to Course Craft</h1>
        {params.reason === "inactive" && <p role="status" className="mt-3 border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">You were signed out after 30 minutes of inactivity. Sign in to continue.</p>}
        <p className="mt-3 mb-8 text-sm text-zinc-500">Your courses and quiz results are private to your account.</p>
        <AuthForm mode="signin" callbackUrl={callbackUrl} />
        <p className="mt-8 text-sm">
          New here?{" "}
          <Link href={`/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="underline underline-offset-4">
            Create an account
          </Link>
        </p>
      </main>
    </>
  );
}
