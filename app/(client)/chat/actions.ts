'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/rbac';
import { resolveActiveBrand, requireClientBrandAccess } from '@/lib/brand/context';
import { ensureThreadForBrand, markRead, postMessage } from '@/lib/chat/service';
import { rateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';

export type ChatActionState =
  | { error: string }
  | { success: true }
  | undefined;

export async function sendChatMessageAction(
  _prev: ChatActionState,
  formData: FormData,
): Promise<ChatActionState> {
  const actor = await requireAuth();
  const { active } = await resolveActiveBrand(actor);
  if (!active) return { error: 'No active brand' };
  await requireClientBrandAccess(actor, active.id);

  const rl = rateLimit(actor.userId, 'chat:post', RATE_LIMITS.CHAT_POST);
  if (!rl.allowed) {
    return { error: `Too many messages. Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s.` };
  }

  const content = (formData.get('content') ?? '').toString();
  if (!content.trim()) return { error: 'Message is empty' };

  const threadId = await ensureThreadForBrand(active.id);
  try {
    await postMessage({ threadId, userId: actor.userId, content });
    await markRead(threadId, actor.userId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'send failed' };
  }

  revalidatePath('/chat');
  return { success: true };
}
