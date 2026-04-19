'use client';

import { useActionState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { sendChatMessageAction, type ChatActionState, type ChatErrorCode } from './actions';

const initial: ChatActionState = undefined;

const ERROR_KEYS: Record<ChatErrorCode, 'noActiveBrand' | 'messageTooEmpty' | 'rateLimited' | 'sendFailed'> = {
  no_active_brand: 'noActiveBrand',
  message_too_empty: 'messageTooEmpty',
  rate_limited: 'rateLimited',
  send_failed: 'sendFailed',
};

export function ChatComposer() {
  const [state, formAction, pending] = useActionState(sendChatMessageAction, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const t = useTranslations('client.chat');
  const tErr = useTranslations('moduleErrors.client.chat');

  useEffect(() => {
    if (state && 'success' in state) formRef.current?.reset();
  }, [state]);

  const errorMessage =
    state && 'error' in state
      ? state.error === 'rate_limited'
        ? tErr('rateLimited', { seconds: state.seconds ?? 0 })
        : tErr(ERROR_KEYS[state.error])
      : null;

  return (
    <form ref={formRef} action={formAction} className="mt-3 flex gap-2">
      <input
        name="content"
        maxLength={4000}
        placeholder={t('messagePlaceholder')}
        className="border-fg-4/20 bg-bg-1 text-fg-1 flex-1 rounded-md border px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="bg-fg-1 text-bg-0 rounded-md px-4 py-2 text-sm disabled:opacity-60"
      >
        {pending ? t('sending') : t('send')}
      </button>
      {errorMessage && (
        <span className="text-asaulia-red self-center text-xs">{errorMessage}</span>
      )}
    </form>
  );
}
