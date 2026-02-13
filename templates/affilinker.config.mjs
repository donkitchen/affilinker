/** @type {import('../src/types').LinksmithConfig} */
export default {
  content: {
    include: ['content/**/*.mdx', 'content/**/*.md'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
  siteUrl: 'https://example.com',
  tracking: {
    baseUrl: '/link/',
    slugStrategy: 'auto',
  },
  networks: {
    amazon: {
      enabled: true,
      tag: 'your-tag-20',
      cleanParams: true,
    },
  },
  storage: {
    adapter: 'supabase',
    supabase: {
      url: process.env.SUPABASE_URL,
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      table: 'affiliate_links',
    },
  },
};
