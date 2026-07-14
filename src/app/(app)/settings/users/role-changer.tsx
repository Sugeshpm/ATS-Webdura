"use client";
import * as React from "react";

const ROLES = ["super_admin", "admin", "hiring_manager", "recruiter", "interviewer", "dept_head", "vendor"] as const;

/**
 * Small client wrapper around the role <select>. Auto-submits its parent form
 * on change. Isolated to a client component because `onChange` cannot be a
 * prop on a native element inside a React Server Component — that pattern
 * throws a serialization error at render time.
 */
export function RoleChanger({ userId, currentRole, action }: {
  userId: string;
  currentRole: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const formRef = React.useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={action} className="inline-flex">
      <input type="hidden" name="user_id" value={userId} />
      <select
        name="role"
        defaultValue={currentRole}
        onChange={() => formRef.current?.requestSubmit()}
        className="h-7 rounded-md border border-input bg-transparent px-2 text-xs"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
        ))}
      </select>
    </form>
  );
}
