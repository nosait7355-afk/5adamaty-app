/**
 * مفاتيح TanStack Query — مصدر واحد للحقيقة.
 * يمنع تضارب الـcache ويجعل الإبطال (invalidation) دقيقًا.
 */
export const queryKeys = {
  health: ['health'] as const,

  categories: {
    all: ['categories'] as const,
    detail: (slug: string) => ['categories', slug] as const,
  },

  professions: {
    byCategory: (categoryId: string) => ['professions', { categoryId }] as const,
    documentRequirements: (professionId: string) =>
      ['professions', professionId, 'document-requirements'] as const,
  },

  providers: {
    list: (filters: Record<string, unknown>) => ['providers', filters] as const,
    detail: (id: string) => ['providers', id] as const,
    reviews: (id: string) => ['providers', id, 'reviews'] as const,
  },

  services: {
    list: (filters: Record<string, unknown>) => ['services', filters] as const,
    detail: (id: string) => ['services', id] as const,
  },

  search: {
    query: (q: string, type: string) => ['search', { q, type }] as const,
  },


  notifications: {
    list: (filters: Record<string, unknown>) => ['notifications', filters] as const,
    unreadCount: ['notifications', 'unread-count'] as const,
  },

  account: {
    me: ['account', 'me'] as const,
    /** ملخص صفحة «حسابي» `{ user, stats }` — مفتاح منفصل عن `me` لأن شكلها مختلف. */
    summary: ['account', 'summary'] as const,
    addresses: ['account', 'addresses'] as const,
    favorites: ['account', 'favorites'] as const,
  },

  faqs: {
    list: (q: string) => ['faqs', { q }] as const,
  },


  provider: {
    dashboard: ['provider', 'dashboard'] as const,
    profile: ['provider', 'profile'] as const,
    services: ['provider', 'services'] as const,
    documents: ['provider', 'documents'] as const,
  },

  admin: {
    verificationQueue: (status: string) => ['admin', 'providers', { status }] as const,
    provider: (id: string) => ['admin', 'providers', id] as const,
    dashboard: ['admin', 'dashboard'] as const,
    users: (filters: Record<string, unknown>) => ['admin', 'users', filters] as const,
    categories: ['admin', 'categories'] as const,
    professions: (filters: Record<string, unknown>) => ['admin', 'professions', filters] as const,
    services: (filters: Record<string, unknown>) => ['admin', 'services', filters] as const,
    reviews: (filters: Record<string, unknown>) => ['admin', 'reviews', filters] as const,
    settings: ['admin', 'settings'] as const,
    auditLogs: (filters: Record<string, unknown>) => ['admin', 'audit-logs', filters] as const,
  },
} as const;
