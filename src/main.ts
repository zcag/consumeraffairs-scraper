import { PlaywrightCrawler, Dataset } from '@crawlee/playwright';
import { Actor, log } from 'apify';
import type { Page } from 'playwright';

// ── Types ──────────────────────────────────────────────────────────────

interface Input {
    companyUrls: string[];
    maxReviewsPerCompany?: number;
    includeCompanyInfo?: boolean;
    proxyConfig?: object;
}

interface ReviewResult {
    type: 'review';
    companyName: string;
    companySlug: string;
    companyUrl: string;
    rating: number;
    reviewTitle: string;
    reviewText: string;
    authorName: string;
    authorLocation: string;
    publishedDate: string;
    reviewUrl: string;
}

interface CompanyResult {
    type: 'companyInfo';
    companyName: string;
    companySlug: string;
    companyUrl: string;
    totalReviews: number;
    averageRating: number;
}

interface UserData {
    label: 'REVIEW_PAGE';
    companySlug: string;
    companyBaseUrl: string;
    reviewCount: number;
    companyInfoEmitted: boolean;
}

// ── Init ───────────────────────────────────────────────────────────────

await Actor.init();

const {
    companyUrls = [],
    maxReviewsPerCompany = 100,
    includeCompanyInfo = true,
    proxyConfig,
} = (await Actor.getInput<Input>()) ?? ({} as Input);

if (companyUrls.length === 0) {
    log.error('No company URLs provided. Exiting.');
    await Actor.exit({ exitCode: 1 });
}

const proxyConfiguration = await Actor.createProxyConfiguration(proxyConfig);

// ── URL helpers ────────────────────────────────────────────────────────

function normalizeCompanyUrl(input: string): string {
    if (input.startsWith('http')) {
        const url = new URL(input);
        // Strip query/hash, keep path
        return `${url.origin}${url.pathname}`;
    }
    // Assume it's a path like "homeowners/american_home_shield"
    const slug = input.replace(/\.html$/, '');
    return `https://www.consumeraffairs.com/${slug}.html`;
}

function extractSlug(url: string): string {
    const match = url.match(/consumeraffairs\.com\/(.+?)(?:\.html)?$/);
    return match ? match[1] : url;
}

function buildPageUrl(baseUrl: string, page: number): string {
    const url = new URL(baseUrl);
    if (page > 1) url.searchParams.set('page', String(page));
    return url.href;
}

// ── Extraction helpers ─────────────────────────────────────────────────

async function extractJsonLd(page: Page): Promise<any[]> {
    return page.$$eval('script[type="application/ld+json"]', (scripts) => {
        const results: any[] = [];
        for (const script of scripts) {
            try {
                const data = JSON.parse(script.textContent || '{}');
                results.push(data);
            } catch { /* skip */ }
        }
        return results;
    });
}

async function extractReviewsFromPage(page: Page, companySlug: string, companyBaseUrl: string): Promise<{
    reviews: ReviewResult[];
    companyInfo: CompanyResult | null;
}> {
    const reviews: ReviewResult[] = [];
    let companyInfo: CompanyResult | null = null;

    // Try JSON-LD first
    const jsonLdBlocks = await extractJsonLd(page);
    for (const data of jsonLdBlocks) {
        const items = data['@graph'] || [data];
        for (const item of items) {
            // Company info
            if (['Organization', 'LocalBusiness', 'ProfessionalService', 'Place'].includes(item['@type'])) {
                const agg = item.aggregateRating || {};
                companyInfo = {
                    type: 'companyInfo',
                    companyName: item.name || companySlug,
                    companySlug,
                    companyUrl: companyBaseUrl,
                    totalReviews: parseInt(agg.reviewCount) || 0,
                    averageRating: parseFloat(agg.ratingValue) || 0,
                };
            }
            // Reviews in JSON-LD
            if (item['@type'] === 'Review') {
                reviews.push({
                    type: 'review',
                    companyName: '',
                    companySlug,
                    companyUrl: companyBaseUrl,
                    rating: parseInt(item.reviewRating?.ratingValue) || 0,
                    reviewTitle: item.headline || item.name || '',
                    reviewText: item.reviewBody || '',
                    authorName: item.author?.name || '',
                    authorLocation: '',
                    publishedDate: item.datePublished || '',
                    reviewUrl: item.url || '',
                });
            }
        }
    }

    // If JSON-LD found reviews, use them
    if (reviews.length > 0) {
        const name = companyInfo?.companyName || companySlug;
        for (const r of reviews) r.companyName = name;
        return { reviews, companyInfo };
    }

    // Fallback: extract from DOM using known CSS selectors
    const domReviews = await page.$$eval('.rvw', (elements) => {
        return elements.map((el) => {
            const bodyEl = el.querySelector('.rvw-bd');
            const authorEl = el.querySelector('.rvw-aut__inf');
            const paragraphs = bodyEl ? Array.from(bodyEl.querySelectorAll('p')) : [];

            // Rating from stars (look for star rating elements)
            let rating = 0;
            const ratingEl = el.querySelector('[class*="star"]') ||
                             el.querySelector('[data-rating]') ||
                             el.querySelector('.ca-a-star');
            if (ratingEl) {
                const ratingAttr = ratingEl.getAttribute('data-rating') ||
                                   ratingEl.getAttribute('data-value') ||
                                   ratingEl.getAttribute('aria-label') || '';
                const match = ratingAttr.match(/(\d)/);
                if (match) rating = parseInt(match[1]);
            }
            // Also check for filled star SVGs or class patterns
            if (rating === 0) {
                const starEls = el.querySelectorAll('.ca-a-star--filled, [class*="star-filled"], [class*="star"][class*="active"]');
                if (starEls.length > 0 && starEls.length <= 5) rating = starEls.length;
            }

            // Title
            const titleEl = authorEl?.querySelector('strong') ||
                            el.querySelector('.rvw-aut__nm') ||
                            el.querySelector('h3, h4');
            const title = titleEl?.textContent?.trim() || '';

            // Review text
            const text = paragraphs.map(p => p.textContent?.trim()).filter(Boolean).join('\n\n');

            // Author
            const authorName = (el.querySelector('.rvw-aut__nm') || authorEl?.querySelector('strong:nth-of-type(1)'))?.textContent?.trim() || '';

            // Location
            const locationEl = el.querySelector('.rvw-aut__loc') || el.querySelector('[class*="location"]');
            const authorLocation = locationEl?.textContent?.trim() || '';

            // Date
            const dateEl = el.querySelector('time') || el.querySelector('[datetime]') || el.querySelector('.rvw-aut__date');
            const publishedDate = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || '';

            // Review URL
            const linkEl = el.querySelector('a[href*="review"]') || el.querySelector('.rvw-bd a');
            const reviewUrl = linkEl?.getAttribute('href') || '';

            return { rating, title, text, authorName, authorLocation, publishedDate, reviewUrl };
        });
    });

    for (const dr of domReviews) {
        reviews.push({
            type: 'review',
            companyName: '',
            companySlug,
            companyUrl: companyBaseUrl,
            rating: dr.rating,
            reviewTitle: dr.title,
            reviewText: dr.text,
            authorName: dr.authorName,
            authorLocation: dr.authorLocation,
            publishedDate: dr.publishedDate,
            reviewUrl: dr.reviewUrl.startsWith('http')
                ? dr.reviewUrl
                : dr.reviewUrl ? `https://www.consumeraffairs.com${dr.reviewUrl}` : '',
        });
    }

    // Try to get company info from DOM if not in JSON-LD
    if (!companyInfo) {
        const info = await page.evaluate(() => {
            const nameEl = document.querySelector('h1, .ca-page-hd__title, [class*="brand-name"]');
            const ratingEl = document.querySelector('[class*="overall-rating"], [class*="aggregate"]');
            const countEl = document.querySelector('[class*="review-count"], [class*="total-reviews"]');
            return {
                name: nameEl?.textContent?.trim() || '',
                rating: ratingEl?.textContent?.trim() || '',
                count: countEl?.textContent?.trim() || '',
            };
        });
        if (info.name) {
            companyInfo = {
                type: 'companyInfo',
                companyName: info.name,
                companySlug,
                companyUrl: companyBaseUrl,
                totalReviews: parseInt(info.count.replace(/[^\d]/g, '')) || 0,
                averageRating: parseFloat(info.rating) || 0,
            };
        }
    }

    const name = companyInfo?.companyName || companySlug;
    for (const r of reviews) r.companyName = name;
    return { reviews, companyInfo };
}

// ── Pagination detection ───────────────────────────────────────────────

async function detectTotalPages(page: Page): Promise<number> {
    return page.evaluate(() => {
        let maxPage = 1;
        // Look for pagination links
        const links = Array.from(document.querySelectorAll('a[href*="page="], nav a, .ca-pag a'));
        for (const link of links) {
            const text = link.textContent?.trim() || '';
            const num = parseInt(text);
            if (!isNaN(num) && num > maxPage) maxPage = num;

            const href = link.getAttribute('href') || '';
            const match = href.match(/page=(\d+)/);
            if (match) {
                const hrefPage = parseInt(match[1]);
                if (hrefPage > maxPage) maxPage = hrefPage;
            }
        }
        return maxPage;
    });
}

// ── Crawler ────────────────────────────────────────────────────────────

const crawler = new PlaywrightCrawler({
    proxyConfiguration,
    maxRequestsPerCrawl: 2000,
    maxConcurrency: 3,
    requestHandlerTimeoutSecs: 120,
    navigationTimeoutSecs: 60,
    headless: true,
    launchContext: {
        launchOptions: {
            args: ['--disable-blink-features=AutomationControlled'],
        },
    },
    preNavigationHooks: [
        async ({ page }) => {
            // Mask automation signals
            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => false });
            });
        },
    ],
    requestHandler: async ({ request, page, crawler: c }) => {
        const userData = request.userData as UserData;
        const { companySlug, companyBaseUrl } = userData;
        let { reviewCount, companyInfoEmitted } = userData;

        // Wait for page to load reviews
        await page.waitForLoadState('domcontentloaded');

        // Check for redirect (ConsumerAffairs redirects past-last-page to last valid page)
        const currentUrl = page.url();
        if (request.url !== currentUrl) {
            const reqPage = new URL(request.url).searchParams.get('page');
            const curPage = new URL(currentUrl).searchParams.get('page');
            if (reqPage && curPage && reqPage !== curPage) {
                log.info(`Redirected from page ${reqPage} to ${curPage} — end of pagination for ${companySlug}`);
                return;
            }
        }

        // Wait a bit for dynamic content
        await page.waitForTimeout(2000);

        log.info(`Processing ${request.url} (${reviewCount} reviews so far for ${companySlug})`);

        const { reviews: pageReviews, companyInfo } = await extractReviewsFromPage(page, companySlug, companyBaseUrl);

        if (includeCompanyInfo && !companyInfoEmitted && companyInfo) {
            await Dataset.pushData(companyInfo);
            companyInfoEmitted = true;
        }

        let reviews = pageReviews;
        const totalPages = await detectTotalPages(page);

        log.info(`Found ${reviews.length} reviews on page, ${totalPages} total pages detected`);

        // Trim to limit
        if (maxReviewsPerCompany > 0) {
            const remaining = maxReviewsPerCompany - reviewCount;
            if (remaining <= 0) return;
            reviews = reviews.slice(0, remaining);
        }

        if (reviews.length > 0) {
            await Dataset.pushData(reviews);
            reviewCount += reviews.length;
            log.info(`Pushed ${reviews.length} reviews (total: ${reviewCount}) for ${companySlug}`);
        }

        // Check limit
        if (maxReviewsPerCompany > 0 && reviewCount >= maxReviewsPerCompany) {
            log.info(`Reached max reviews (${maxReviewsPerCompany}) for ${companySlug}`);
            return;
        }

        // Enqueue next page
        const currentPage = parseInt(new URL(request.url).searchParams.get('page') || '1');

        if (currentPage < totalPages) {
            const nextUrl = buildPageUrl(companyBaseUrl, currentPage + 1);
            await c.addRequests([{
                url: nextUrl,
                userData: {
                    label: 'REVIEW_PAGE' as const,
                    companySlug,
                    companyBaseUrl,
                    reviewCount,
                    companyInfoEmitted,
                },
            }]);
        } else if (reviews.length > 0 && totalPages <= 1) {
            // Try next page speculatively
            const nextUrl = buildPageUrl(companyBaseUrl, currentPage + 1);
            await c.addRequests([{
                url: nextUrl,
                userData: {
                    label: 'REVIEW_PAGE' as const,
                    companySlug,
                    companyBaseUrl,
                    reviewCount,
                    companyInfoEmitted,
                },
            }]);
            log.info(`Speculatively trying page ${currentPage + 1}`);
        } else {
            log.info(`Finished all pages for ${companySlug} (${reviewCount} reviews total)`);
        }
    },

    failedRequestHandler: async ({ request }, error) => {
        log.error(`Request failed: ${request.url} — ${error.message}`);
    },
});

// ── Build start URLs ───────────────────────────────────────────────────

const startUrls = companyUrls.map((input) => {
    const baseUrl = normalizeCompanyUrl(input);
    const slug = extractSlug(baseUrl);
    return {
        url: buildPageUrl(baseUrl, 1),
        userData: {
            label: 'REVIEW_PAGE' as const,
            companySlug: slug,
            companyBaseUrl: baseUrl,
            reviewCount: 0,
            companyInfoEmitted: false,
        },
    };
});

log.info(`Starting ConsumerAffairs scraper for ${startUrls.length} companies: ${startUrls.map(u => u.userData.companySlug).join(', ')}`);

await crawler.run(startUrls);

const datasetInfo = await Dataset.open().then(d => d.getInfo());
log.info(`Done. Total items in dataset: ${datasetInfo?.itemCount ?? 0}`);

await Actor.exit();
