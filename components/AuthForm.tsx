"use client";

import { useActionState, useState } from "react";
import { signInAction, signUpAction } from "@/app/signin/actions";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
const input = `mt-1 block w-full border border-blue-200 bg-white px-3 py-2 text-sm ${focus}`;

export default function AuthForm({ mode, callbackUrl, requireSignupCode = false }: { mode: "signin" | "signup"; callbackUrl: string; requireSignupCode?: boolean }) {
  const [state, action, pending] = useActionState(mode === "signin" ? signInAction : signUpAction, {});
  const [passwordVisible, setPasswordVisible] = useState(false);
  const signup = mode === "signup";

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      {signup && (
        <div>
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <input id="name" name="name" type="text" autoComplete="name" required maxLength={80} className={input} />
        </div>
      )}
      {signup && requireSignupCode && (
        <div>
          <label htmlFor="signupCode" className="text-sm font-medium">
            Signup code
          </label>
          <input id="signupCode" name="signupCode" type="text" autoComplete="off" required maxLength={32} className={input} />
        </div>
      )}
      <div>
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className={input} />
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={passwordVisible ? "text" : "password"}
            autoComplete={signup ? "new-password" : "current-password"}
            required
            minLength={signup ? 8 : undefined}
            maxLength={128}
            aria-describedby={signup ? "password-hint" : undefined}
            className={`${input} pr-12`}
          />
          <button
            type="button"
            aria-label={passwordVisible ? "Hide password" : "Show password"}
            aria-pressed={passwordVisible}
            onClick={() => setPasswordVisible((visible) => !visible)}
            className={`absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-slate-500 hover:text-blue-700 ${focus}`}
          >
            {passwordVisible ? (
              <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">
                <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.5 9.5 7-.4 1.1-1.2 2.3-2.3 3.4M6.2 6.2C3.9 7.7 2.8 9.9 2.5 12c1 2.5 4.5 7 9.5 7 1.3 0 2.5-.3 3.5-.8" />
              </svg>
            ) : (
              <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">
                <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                <circle cx="12" cy="12" r="2.5" />
              </svg>
            )}
          </button>
        </div>
        {signup && (
          <p id="password-hint" className="mt-1 text-xs text-zinc-500">
            At least 8 characters.
          </p>
        )}
      </div>

      {state.error && (
        <p role="alert" className="border-0 border-l border-blue-200 pl-3 text-sm text-blue-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className={`w-full border border-blue-600 bg-blue-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-40 hover:bg-blue-700 ${focus}`}
      >
        <span className="inline-flex items-center justify-center gap-2">
          {pending && <LoadingSpinner />}
          {pending ? (signup ? "Creating account" : "Signing in") : signup ? "Create account" : "Sign in"}
        </span>
      </button>
    </form>
  );
}
