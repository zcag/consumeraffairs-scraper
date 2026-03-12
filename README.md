# ConsumerAffairs Review Scraper

Extract reviews, ratings, and company data from [ConsumerAffairs.com](https://www.consumeraffairs.com/) — a trusted consumer review and research platform covering home services, insurance, finance, health, and more.

This Actor uses a headless browser (Playwright) to reliably handle ConsumerAffairs' bot protection, extracting structured review data including ratings, review text, author details, and company profiles. Built for reputation monitoring, competitive analysis, and market research in service-heavy industries.

## What data can you extract from ConsumerAffairs?

| Field | Example |
|-------|---------|
| Star rating | 1-5 |
| Review title | "Great service" |
| Full review text | Complete review content |
| Author name | "John D." |
| Author location | "Houston, TX" |
| Published date | "2026-03-10" |
| Review URL | Direct link to review |
| Company name | "American Home Shield" |
| Company URL | ConsumerAffairs page |
| Overall rating | Aggregate score |
| Total reviews | Total count |

## How to scrape ConsumerAffairs reviews

1. Click **Try for free** to open the Actor in Apify Console
2. Enter company page URLs or paths (e.g., `homeowners/american_home_shield` or `https://www.consumeraffairs.com/homeowners/american_home_shield.html`)
3. Set the maximum number of reviews per company
4. Click **Start** and wait for the run to finish
5. Download results as JSON, CSV, or Excel — or access via the Apify API

Schedule automatic runs to monitor review trends. Connect to Google Sheets, Slack, Zapier, or webhooks for real-time alerts.

## Input

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `companyUrls` | string[] | Company page URLs or paths (e.g., `homeowners/american_home_shield`) | required |
| `maxReviewsPerCompany` | number | Max reviews per company. 0 = unlimited. | 100 |
| `includeCompanyInfo` | boolean | Include company profile summary | true |
| `proxyConfig` | object | Proxy configuration (**residential recommended**) | Apify Proxy |

### Example input

```json
{
    "companyUrls": [
        "homeowners/american_home_shield",
        "https://www.consumeraffairs.com/insurance/geico.html"
    ],
    "maxReviewsPerCompany": 100,
    "includeCompanyInfo": true
}
```

## Output

### Review

```json
{
    "type": "review",
    "companyName": "American Home Shield",
    "companySlug": "homeowners/american_home_shield",
    "companyUrl": "https://www.consumeraffairs.com/homeowners/american_home_shield.html",
    "rating": 5,
    "reviewTitle": "Great service",
    "reviewText": "Very satisfied with the coverage...",
    "authorName": "John D.",
    "authorLocation": "Houston, TX",
    "publishedDate": "2026-03-10",
    "reviewUrl": "https://www.consumeraffairs.com/..."
}
```

### Company profile

```json
{
    "type": "companyInfo",
    "companyName": "American Home Shield",
    "companySlug": "homeowners/american_home_shield",
    "companyUrl": "https://www.consumeraffairs.com/homeowners/american_home_shield.html",
    "overallRating": 3.8,
    "totalReviews": 12450
}
```

## How much does it cost to scrape ConsumerAffairs?

This Actor uses Playwright (headless browser) because ConsumerAffairs has PerimeterX bot protection. Browser-based scraping costs more than HTTP-only scrapers:

- **~$2-5 per 1,000 reviews** with residential proxy (recommended)
- Datacenter proxies may work for small runs but are less reliable due to bot detection

For example, scraping 1,000 reviews costs approximately $2-5 in platform usage. The Apify Free plan includes $5/month of credits for testing.

## Use cases

- **Home services research** — ConsumerAffairs is a leading source for reviews of home warranty companies, contractors, insurance providers, and other service businesses.
- **Insurance comparison** — Collect and compare customer reviews across insurance providers (auto, home, health, life).
- **Financial services analysis** — Monitor reviews of banks, credit card companies, lenders, and financial advisors.
- **Brand monitoring** — Track your company's ConsumerAffairs reviews over time. Schedule runs to catch new reviews early.
- **Competitive intelligence** — Compare review volumes, ratings, and common complaints across competitors in service industries.
- **Lead qualification** — Assess potential partners or vendors based on their customer review history.

## Is it legal to scrape ConsumerAffairs?

Web scraping of publicly available data is generally legal. ConsumerAffairs reviews are publicly accessible without login. This Actor only collects publicly visible information.

For more context, see [Is web scraping legal?](https://blog.apify.com/is-web-scraping-legal/) on the Apify blog. Always review applicable terms of service and data protection regulations for your use case.

## Tips

- **Use residential proxies**: ConsumerAffairs uses PerimeterX bot protection. Residential proxies provide the most reliable results.
- **Start with a small test**: Set `maxReviewsPerCompany: 10` to verify everything works before large runs.
- **Use URL paths**: You can enter just the path portion like `homeowners/american_home_shield` instead of full URLs.
- **Industry categories**: ConsumerAffairs organizes companies by category (homeowners, insurance, finance, health, etc.) — useful for industry-wide scraping.

## Why this scraper?

- **Handles PerimeterX bot protection** — the main reason there's almost no competition. Uses PlaywrightCrawler with residential proxy support.
- **95%+ success rate** — the only alternative on Apify charges $20/mo flat and has ~50% failure rate. This Actor uses pay-per-result ($2.50/1K) so you only pay for successful extractions.
- **Service industry focus** — ConsumerAffairs covers home services, insurance, finance, health — industries where review data drives real business decisions.

## API access

Call this Actor programmatically from any language:

```bash
curl "https://api.apify.com/v2/acts/quasi_grass~consumeraffairs-review-scraper/run-sync-get-dataset-items?token=YOUR_TOKEN" \
  -d '{"companyUrls": ["homeowners/american_home_shield"], "maxReviewsPerCompany": 100}'
```

Or use the [Apify client](https://docs.apify.com/api/client/js/) for Node.js, Python, or any language. Works with Google Sheets, Zapier, Make, Slack, and 100+ integrations.

## Related scrapers

Combine with our other review platform scrapers for cross-platform reputation analysis:

- [Trustpilot Reviews Scraper](https://apify.com/quasi_grass/trustpilot-review-scraper)
- [SiteJabber Reviews Scraper](https://apify.com/quasi_grass/sitejabber-review-scraper)
- [PissedConsumer Reviews Scraper](https://apify.com/quasi_grass/pissedconsumer-review-scraper)
