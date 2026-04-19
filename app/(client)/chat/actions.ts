'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/rbac';
import { resolveActiveBrand, requireClientBrandAccess } from '@/lib/brand/context';
import { ensureThreadForBrand, markRead, postMessage } from '@/lib/chat/service';
import { rateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';

export type ChatErrorCode =
  | 'no_active_brand'
  | 'message_too_empty'
  | 'rate_limited'
  | 'send_failed';

export type ChatActionState =
  | { error: ChatErrorCode; seconds?: number }
  | { success: true }
  | undefined;

export async function sendChatMessageAction(
  _prev: ChatActionState,
  formData: FormData,
): Promise<ChatActionState> {
  const actor = await requireAuth();
  const { active } = await resolveActiveBrand(actor);
  if (!active) return { error: 'no_active_brand' };
  await requireClientBrandAccess(actor, active.id);

  const rl = rateLimit(actor.userId, 'chat:post', RATE_LIMITS.CHAT_POST);
  if (!rl.allowed) {
    return { error: 'rate_limited', seconds: Math.ceil(rl.retryAfterMs / 1000) };
  }

  const content = (formData.get('content') ?? '').toString();
  if (!content.trim()) return { error: 'message_too_empty' };

  const threadId = await ensureThreadForBrand(active.id);
  try {
    await postMessage({ threadId, userId: actor.userId, content });
    await markRead(threadId, actor.userId);
  } catch {
    return { error: 'send_failed' };
  }

  revalidatePath('/chat');
  return { success: true };
}
