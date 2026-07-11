import type { MDXComponents } from 'mdx/types';
import Image from './shared/Image';
import CustomLink from './shared/Link';

export const components: MDXComponents = {
  Image,
  a: CustomLink,
};
