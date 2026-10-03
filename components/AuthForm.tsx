"use client";

import { useActionState } from "react";
import { signInAction, signUpAction } from "@/app/signin/actions";

const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
const input = `mt-1 block w-full border border-blue-200 bg-white px-3 py-2 text-sm ${focus}`;

export default function AuthForm({ mode, callbackUrl, requireSignupCode = false }: { mode: "signin" | "signup"; callbackUrl: string; requireSignupCode?: boolean }) {
  const [state, action, pending] = useActionState(mode === "signin" ? signInAction : signUpAction, {});
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
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={signup ? "new-password" : "current-password"}
          required
          minLength={signup ? 8 : undefined}
          maxLength={128}
          aria-describedby={signup ? "password-hint" : undefined}
          className={input}
        />
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
        className={`w-full border border-blue-600 bg-blue-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-40 hover:bg-blue-700 ${focus}`}
      >
        {pending ? (signup ? "Creating account" : "Signing in") : signup ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}
