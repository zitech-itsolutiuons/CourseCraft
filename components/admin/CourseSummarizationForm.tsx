"use client";

import { useActionState } from "react";
import { saveCourseSummarizationAction, type SignupCodeActionState } from "@/app/admin/actions";
import PendingSubmitButton from "@/components/ui/PendingSubmitButton";

const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";

export default function CourseSummarizationForm({ enabled }: { enabled: boolean }) {
  const [state, action] = useActionState<SignupCodeActionState, FormData>(saveCourseSummarizationAction, {});

  return (
    <form action={action} className="space-y-5 border-y border-slate-200 bg-white py-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <label htmlFor="courseSummarizationEnabled" className="flex items-start gap-3 text-sm text-slate-800">
          <input
            id="courseSummarizationEnabled"
            name="courseSummarizationEnabled"
            type="checkbox"
            defaultChecked={enabled}
            className={`mt-0.5 h-4 w-4 accent-blue-700 ${focus}`}
          />
          <span>
            <span className="block font-medium">Allow students to summarize courses</span>
            <span className="mt-1 block max-w-2xl leading-6 text-slate-600">
              Enables an on-demand AI-generated course overview on course detail pages. Generation uses DeepSeek and is limited to 10 requests per student per hour.
            </span>
          </span>
        </label>
        <PendingSubmitButton
          pendingLabel="Saving..."
          className={`shrink-0 border border-blue-700 bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-50 ${focus}`}
        >
          Save setting
        </PendingSubmitButton>
      </div>
      {state.success && <p role="status" className="text-sm text-emerald-700">{state.success}</p>}
      {state.error && <p role="alert" className="text-sm text-rose-700">{state.error}</p>}
    </form>
  );
}
