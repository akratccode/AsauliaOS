import { describe, expect, it } from 'vitest';
import {
  allowedNextStatuses,
  canActorTransition,
  isValidTransition,
} from '@/lib/deliverables/transitions';
import {
  MAX_SINGLE_SHARE_BPS,
  TOTAL_ALLOCATION_BPS,
  summarizeAllocation,
  validateSingleShareBps,
} from '@/lib/deliverables/allocation';
import {
  isAllowedMime,
  validateAttachmentInput,
  MAX_ATTACHMENT_BYTES,
  buildAttachmentPath,
} from '@/lib/deliverables/attachments';
import { extractMentions } from '@/lib/deliverables/mentions';
import { monthStringToPeriod, currentUtcPeriod } from '@/lib/billing/period';
import type { DeliverableStatus } from '@/lib/deliverables/types';

describe('deliverable transitions', () => {
  it('accepts the documented forward transitions', () => {
    expect(isValidTransition('todo', 'in_progress')).toBe(true);
    expect(isValidTransition('in_progress', 'in_review')).toBe(true);
    expect(isValidTransition('in_review', 'done')).toBe(true);
    expect(isValidTransition('in_review', 'rejected')).toBe(true);
    expect(isValidTransition('rejected', 'in_progress')).toBe(true);
    expect(isValidTransition('done', 'in_review')).toBe(true);
  });

  it('rejects arbitrary transitions', () => {
    expect(isValidTransition('todo', 'done')).toBe(false);
    expect(isValidTransition('todo', 'in_review')).toBe(false);
    expect(isValidTransition('done', 'todo')).toBe(false);
    expect(isValidTransition('in_progress', 'done')).toBe(false);
    expect(isValidTransition('rejected', 'done')).toBe(false);
  });

  it('honors the actor permissions matrix', () => {
    // Assignee can start work
    expect(canActorTransition('assignee', 'todo', 'in_progress')).toBe(true);
    expect(canActorTransition('client_owner', 'todo', 'in_progress')).toBe(false);
    // Only admin/operator/owner approve
    expect(canActorTransition('assignee', 'in_review', 'done')).toBe(false);
    expect(canActorTransition('client_owner', 'in_review', 'done')).toBe(true);
    expect(canActorTransition('admin', 'in_review', 'done')).toBe(true);
    // Reopen: admin/operator only
    expect(canActorTransition('client_owner', 'done', 'in_review')).toBe(false);
    expect(canActorTransition('admin', 'done', 'in_review')).toBe(true);
    expect(canActorTransition('operator', 'done', 'in_review')).toBe(true);
  });

  it('lists next statuses from any state', () => {
    const from: DeliverableStatus[] = [
      'todo',
      'in_progress',
      'in_review',
      'done',
      'rejected',
    ];
    for (const f of from) {
      const next = allowedNextStatuses(f);
      expect(next.length).toBeGreaterThan(0);
      for (const n of next) expect(isValidTransition(f, n)).toBe(true);
    }
  });
});

describe('deliverable allocation', () => {
  it('flags exact/over/under allocation', () => {
    expect(
      summarizeAllocation([
        { fixedShareBps: 5_000, archivedAt: null },
        { fixedShareBps: 5_000, archivedAt: null },
      ]).flag,
    ).toBe('exact');
    expect(
      summarizeAllocation([
        { fixedShareBps: 4_000, archivedAt: null },
        { fixedShareBps: 4_000, archivedAt: null },
      ]).flag,
    ).toBe('under_allocated');
    expect(
      summarizeAllocation([
        { fixedShareBps: 6_000, archivedAt: null },
        { fixedShareBps: 5_000, archivedAt: null },
      ]).flag,
    ).toBe('over_allocated');
  });

  it('ignores archived rows', () => {
    expect(
      summarizeAllocation([
        { fixedShareBps: 10_000, archivedAt: null },
        { fixedShareBps: 10_000, archivedAt: new Date() },
      ]).flag,
    ).toBe('exact');
  });

  it('validates single-share bounds', () => {
    expect(() => validateSingleShareBps(0)).not.toThrow();
    expect(() => validateSingleShareBps(MAX_SINGLE_SHARE_BPS)).not.toThrow();
    expect(() => validateSingleShareBps(MAX_SINGLE_SHARE_BPS + 1)).toThrow();
    expect(() => validateSingleShareBps(-1)).toThrow();
  });

  it('total allocation bps constant matches 100%', () => {
    expect(TOTAL_ALLOCATION_BPS).toBe(10_000);
  });
});

describe('attachment validation', () => {
  it('allows common MIME types', () => {
    expect(isAllowedMime('image/png')).toBe(true);
    expect(isAllowedMime('application/pdf')).toBe(true);
    expect(isAllowedMime('text/markdown')).toBe(true);
  });

  it('rejects unknown MIME types', () => {
    expect(isAllowedMime('application/x-msdownload')).toBe(false);
    expect(isAllowedMime(null)).toBe(false);
    expect(isAllowedMime('')).toBe(false);
  });

  it('rejects over-size uploads', () => {
    expect(() =>
      validateAttachmentInput({
        mimeType: 'image/png',
        sizeBytes: MAX_ATTACHMENT_BYTES + 1,
      }),
    ).toThrow();
  });

  it('accepts exact-limit uploads', () => {
    expect(() =>
      validateAttachmentInput({
        mimeType: 'image/png',
        sizeBytes: MAX_ATTACHMENT_BYTES,
      }),
    ).not.toThrow();
  });

  it('builds a safe storage path', () => {
    const path = buildAttachmentPath({
      brandId: 'b1',
      deliverableId: 'd1',
      fileName: 'ñaño drive.png',
      uuid: 'u1',
    });
    expect(path.startsWith('brand_b1/deliverable_d1/u1-')).toBe(true);
    expect(path).not.toContain(' ');
  });
});

describe('mention extraction', () => {
  it('finds single @mention', () => {
    expect(extractMentions('hi @bruno')).toEqual(['bruno']);
  });

  it('finds multiple unique mentions', () => {
    expect(extractMentions('@ana and @bruno @ana again').sort()).toEqual(['ana', 'bruno']);
  });

  it('ignores email addresses and text inside code fences', () => {
    const input = 'email foo@bar.com and `@code` and ```\n@fenced\n``` plus @real';
    expect(extractMentions(input)).toEqual(['real']);
  });
});

describe('period helpers', () => {
  it('converts a YYYY-MM to a full month range', () => {
    expect(monthStringToPeriod('2026-02')).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    });
    expect(monthStringToPeriod('2024-02').end).toBe('2024-02-29'); // leap year
    expect(monthStringToPeriod('2026-12')).toEqual({
      start: '2026-12-01',
      end: '2026-12-31',
    });
  });

  it('rejects malformed months', () => {
    expect(() => monthStringToPeriod('2026-13')).toThrow();
    expect(() => monthStringToPeriod('bad')).toThrow();
  });

  it('resolves the current UTC period', () => {
    const p = currentUtcPeriod(new Date(Date.UTC(2026, 3, 10)));
    expect(p.start).toBe('2026-04-01');
    expect(p.end).toBe('2026-04-30');
  });
});
