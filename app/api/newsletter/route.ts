import { NewsletterAPI } from '@shipixen/pliny/newsletter';
import { siteConfig } from '@/data/config/site.settings';

export const runtime = 'edge';
export const dynamic = 'force-static';

const handler = NewsletterAPI({
  // @ts-ignore
  provider: siteConfig.newsletter.provider,
});

export { handler as GET, handler as POST };
