"use client";

import { useActionState } from "react";
import { useEffect, useState } from "react";
import { saveReconstructionPriceAction, type SignupCodeActionState } from "@/app/admin/actions";
import PendingSubmitButton from "@/components/ui/PendingSubmitButton";

const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";
const formatNgn = (amount: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);

export default function ReconstructionPriceForm({ priceNgn }: { priceNgn: number }) {
  const [state, action] = useActionState<SignupCodeActionState, FormData>(saveReconstructionPriceAction, {});
  const [priceInput, setPriceInput] = useState(String(priceNgn));
  const savedPrice = state.savedPriceNgn ?? priceNgn;

  useEffect(() => {
    setPriceInput(String(savedPrice));
  }, [savedPrice]);

  return (
    <form action={action} className="overflow-hidden border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,0.8fr)] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Current access price</p>
            <span className={`inline-flex items-center gap-1.5 border px-2 py-1 text-xs font-medium ${
              savedPrice > 0
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
            }`}>
              <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${savedPrice > 0 ? "bg-emerald-600" : "bg-amber-600"}`} />
              {savedPrice > 0 ? "Checkout enabled" : "Checkout disabled"}
            </span>
          </div>
          <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-slate-950 dark:text-white" aria-live="polite">
            {formatNgn(savedPrice)}
          </p>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-400">
            One-time payment for reconstruction access. Access includes up to three started reconstructions each week, resetting Monday in Nigeria time.
          </p>
        </div>

        <div className="space-y-3 border-t border-slate-200 pt-5 dark:border-slate-800 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <label htmlFor="reconstructionPriceNgn" className="block text-sm font-medium text-slate-800 dark:text-slate-200">
            Set a new price <span className="font-normal text-slate-500 dark:text-slate-400">(whole NGN)</span>
            <div className="mt-2 flex min-h-12 items-center border border-slate-300 bg-white focus-within:outline focus-within:outline-2 focus-within:outline-blue-700 dark:border-slate-700 dark:bg-slate-950">
              <span aria-hidden="true" className="pl-3 text-sm font-medium text-slate-500 dark:text-slate-400">₦</span>
              <input
                id="reconstructionPriceNgn"
                name="reconstructionPriceNgn"
                type="number"
                min="0"
                step="1"
                required
                value={priceInput}
                onChange={(event) => setPriceInput(event.target.value)}
                aria-describedby="reconstruction-price-hint"
                className={`min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm tabular-nums text-slate-900 dark:text-white ${focus}`}
              />
            </div>
          </label>
          <p id="reconstruction-price-hint" className="text-xs leading-5 text-slate-600 dark:text-slate-400">
            Set to ₦0 to turn off new purchases. Existing access is not affected.
          </p>
          <PendingSubmitButton
            pendingLabel="Saving price..."
            className={`min-h-11 w-full border border-blue-700 bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60 ${focus}`}
          >
            Save access price
          </PendingSubmitButton>
        </div>
      </div>
      {(state.success || state.error) && (
        <div className={`border-t px-5 py-3 text-sm sm:px-6 ${
          state.success
            ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
            : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
        }`}>
          {state.success && <p role="status">{state.success}</p>}
          {state.error && <p role="alert">{state.error}</p>}
        </div>
      )}
    </form>
  );
}
