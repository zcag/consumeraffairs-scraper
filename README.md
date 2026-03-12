# ConsumerAffairs Review Scraper

Apify Actor that extracts reviews, ratings, and company data from [ConsumerAffairs.com](https://www.consumeraffairs.com/).

Uses **Playwright** (headless browser) to handle ConsumerAffairs' bot protection. Automatically paginates through all review pages.

## Features

- Extract reviews with ratings, titles, text, author info, and dates
- Company profile data (overall rating, total reviews)
- Multi-company scraping in a single run
- Automatic pagination with redirect detection
- Handles bot protection via Playwright + proxy rotation
- Configurable max reviews per company

## Input

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `companyUrls` | string[] | Company page URLs or paths (e.g. `homeowners/american_home_shield`) | required |
| `maxReviewsPerCompany` | number | Max reviews per company (0 = unlimited) | 100 |
| `includeCompanyInfo` | boolean | Include company profile summary | true |
| `proxyConfig` | object | Proxy settings (residential recommended) | Apify Proxy |

## Output

Each review includes:

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

## Usage

### Via Apify Console

1. Go to the actor page on Apify Store
2. Enter company URLs
3. Click Run

### Via API

```bash
curl -X POST "https://api.apify.com/v2/acts/YOUR_USERNAME~consumeraffairs-review-scraper/runs" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"companyUrls": ["homeowners/american_home_shield"]}'
```

## Notes

- ConsumerAffairs uses PerimeterX bot protection. **Residential proxies are recommended** for reliable results.
- The scraper first attempts JSON-LD extraction, then falls back to DOM parsing.
- Pagination end is detected via redirect (ConsumerAffairs redirects past-last-page requests).
