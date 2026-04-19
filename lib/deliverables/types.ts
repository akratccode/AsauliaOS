export type DeliverableStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'rejected';

export type DeliverableType =
  | 'content_post'
  | 'ad_creative'
  | 'landing_page'
  | 'seo_article'
  | 'email_sequence'
  | 'strategy_doc'
  | 'custom';

export type AllocationFlag = 'exact' | 'under_allocated' | 'over_allocated';
