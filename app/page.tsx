import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const metadata = {
  title: 'Roger Wilco Aviation Services | Garmin Avionics, NDT, Fabrication & Aircraft Support',
  description:
    'FAA-certificated repair station offering Garmin avionics installations, NDT, sheet metal fabrication, and aircraft maintenance in Yankton, South Dakota.',
};

async function loadNewspaperHtml() {
  const filePath = path.join(process.cwd(), 'public', 'newspaper', 'index.html');
  const raw = await readFile(filePath, 'utf8');

  const styleMatch = raw.match(/<style>([\s\S]*?)<\/style>/i);
  const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

  if (!styleMatch || !bodyMatch) {
    throw new Error('Could not extract newspaper HTML content.');
  }

  const style = styleMatch[1]
    .replace(/url\((['"]?)images\//g, 'url($1/newspaper/images/');

  const body = bodyMatch[1]
    .replace(/src="images\//g, 'src="/newspaper/images/')
    .replace(/src='images\//g, "src='/newspaper/images/")
    .replace(/href="images\//g, 'href="/newspaper/images/')
    .replace(/href='images\//g, "href='/newspaper/images/");

  return { style, body };
}

export default async function Home() {
  const { style, body } = await loadNewspaperHtml();

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: style }} />
      <div dangerouslySetInnerHTML={{ __html: body }} />
    </>
  );
}
