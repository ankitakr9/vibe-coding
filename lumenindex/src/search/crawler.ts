import dns from 'node:dns/promises';
import net from 'node:net';
import * as cheerio from 'cheerio';

const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 8000;
const MAX_BODY_BYTES = 1_500_000;

function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split('.').map((n) => Number.parseInt(n, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local & cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a >= 224) return true; // Multicast & reserved
  return false;
}

function isPrivateOrReservedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA fc00::/7
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
    return true; // Link-local fe80::/10
  }
  if (normalized.startsWith('::ffff:')) {
    const mappedV4 = normalized.slice('::ffff:'.length);
    if (net.isIPv4(mappedV4)) {
      return isPrivateOrReservedIPv4(mappedV4);
    }
    return true;
  }
  return false;
}

function isBlockedIp(address: string): boolean {
  const version = net.isIP(address);
  if (version === 4) return isPrivateOrReservedIPv4(address);
  if (version === 6) return isPrivateOrReservedIPv6(address);
  return true;
}

async function assertSafePublicUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Please provide a valid URL starting with http:// or https://.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http:// and https:// web page URLs are supported.');
  }

  const rawHostname = parsed.hostname.toLowerCase();
  const hostname =
    rawHostname.startsWith('[') && rawHostname.endsWith(']')
      ? rawHostname.slice(1, -1)
      : rawHostname;

  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'metadata.google.internal'
  ) {
    throw new Error('Private or internal network addresses cannot be crawled.');
  }

  if (net.isIP(hostname) !== 0) {
    if (isBlockedIp(hostname)) {
      throw new Error('Private or reserved IP addresses cannot be crawled.');
    }
    return parsed;
  }

  let resolvedAddresses: Array<{ address: string }>;
  try {
    resolvedAddresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error(`Could not resolve hostname "${hostname}".`);
  }

  if (resolvedAddresses.length === 0) {
    throw new Error(`Hostname "${hostname}" returned no DNS records.`);
  }

  for (const record of resolvedAddresses) {
    if (isBlockedIp(record.address)) {
      throw new Error('Target URL resolves to a restricted network address.');
    }
  }

  return parsed;
}

export interface CrawledPageResult {
  url: string;
  domain: string;
  title: string;
  summary: string;
  content: string;
  keywords: string;
}

export async function crawlWebPage(inputUrl: string): Promise<CrawledPageResult> {
  let currentUrl = await assertSafePublicUrl(inputUrl);
  let response: Response | null = null;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      response = await fetch(currentUrl.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'LumenIndexCrawler/1.0 (+https://lumenindex.local)',
          Accept: 'text/html, text/plain;q=0.9, */*;q=0.1',
        },
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Fetching the web page timed out after 8 seconds.');
      }
      throw new Error('Unable to reach the target web page. Verify the URL is publicly accessible.');
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        throw new Error('Target URL returned an incomplete redirect.');
      }
      if (hop === MAX_REDIRECTS) {
        throw new Error('Target URL exceeded the maximum redirect limit.');
      }
      const nextUrl = new URL(location, currentUrl).toString();
      currentUrl = await assertSafePublicUrl(nextUrl);
      continue;
    }

    break;
  }

  if (!response) {
    throw new Error('Failed to fetch target web page.');
  }

  if (!response.ok) {
    throw new Error(`Target web page responded with HTTP ${response.status}.`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
    throw new Error('Only HTML and plain-text web pages can be indexed.');
  }

  const reader = response.body?.getReader();
  let html = '';
  if (reader) {
    const decoder = new TextDecoder('utf-8');
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        break;
      }
      html += decoder.decode(value, { stream: true });
    }
    html += decoder.decode();
  } else {
    html = (await response.text()).slice(0, MAX_BODY_BYTES);
  }

  const domain = currentUrl.hostname.replace(/^www\./, '');

  if (contentType.includes('text/plain')) {
    const cleaned = html.replace(/\s+/g, ' ').trim();
    const title = currentUrl.pathname.split('/').filter(Boolean).pop() || domain;
    return {
      url: currentUrl.toString(),
      domain,
      title,
      summary: cleaned.slice(0, 260),
      content: cleaned.slice(0, 30000),
      keywords: domain,
    };
  }

  const $ = cheerio.load(html);
  $('script, style, noscript, iframe, svg, nav, footer, aside').remove();

  const title =
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('title').first().text().trim() ||
    $('h1').first().text().trim() ||
    domain;

  const metaDescription =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    '';

  const metaKeywords = $('meta[name="keywords"]').attr('content')?.trim() || '';

  const mainRoot = $('main, article, [role="main"]').first();
  const rawBody = (mainRoot.length > 0 ? mainRoot.text() : $('body').text())
    .replace(/\s+/g, ' ')
    .trim();

  if (rawBody.length < 30) {
    throw new Error('The fetched page did not contain enough readable text to index.');
  }

  const summary = (metaDescription || rawBody.slice(0, 260)).trim();

  return {
    url: currentUrl.toString(),
    domain,
    title: title.slice(0, 200),
    summary: summary.slice(0, 500),
    content: rawBody.slice(0, 35000),
    keywords: metaKeywords.slice(0, 300),
  };
}
