'use client';

import { useActionState, useRef, useEffect } from 'react';
import { sendChatMessageAction, type ChatActionState } from './actions';

const initial: ChatActionState = undefined;

export function ChatComposer() {
  const [state, formAction, pending] = useActionState(sendChatMessageAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && 'success' in state) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="mt-3 flex gap-2">
      <input
        name="content"
        maxLength={4000}
        placeholder="Message Asaulia…"
        className="border-fg-4/20 bg-bg-1 text-fg-1 flex-1 rounded-md border px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="bg-fg-1 text-bg-0 rounded-md px-4 py-2 text-sm disabled:opacity-60"
      >
        {pending ? 'Sending…' : 'Send'}
      </button>
      {state && 'error' in state && (
        <span className="text-asaulia-red self-center text-xs">{state.error}</span>
      )}
    </form>
  );
}
