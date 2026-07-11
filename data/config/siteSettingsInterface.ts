type OptionalFeatureConfig = boolean | Record<string, unknown>;

export interface SiteMetadata {
  title: string;
  description: string;
  domain: string;
  logoTitle: string;
  socialBanner: string;
  supportEmail: string;

  email: string;
  twitter: string;
  instagram: string;
  tiktok: string;
  github: string;
  linkedin: string;
  youtube: string;
  facebook: string;
  threads: string;
  mastodon: string;

  language: string;
  theme: 'system' | 'dark' | 'light';
  locale: string;
}

export interface SiteConfig extends SiteMetadata {
  allArticlesPath: string;
  disableAnalytics: boolean;
  analytics?: Record<string, unknown>;
  comments?: OptionalFeatureConfig;
  newsletter?: Record<string, unknown>;
  search?: OptionalFeatureConfig;
}
