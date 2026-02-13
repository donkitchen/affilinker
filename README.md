# Affilinker

A CLI tool for managing affiliate and outbound links in content files (MDX, Markdown, HTML).

## Features

- **Scan** - Find all outbound links in your content files
- **Convert** - Convert affiliate links to clean URLs with proper tracking tags
- **Report** - Generate reports in JSON, CSV, SQL, or Markdown format
- **Transform** - Replace outbound links with tracking URLs (`/link/slug`)
- **Sync** - Sync links to a database (Supabase or JSON file)

## Installation

```bash
npm install affilinker
```

Or run directly with npx:

```bash
npx affilinker scan
```

## Quick Start

1. Create a config file (`affilinker.config.js`):

```javascript
export default {
  content: {
    include: ['content/**/*.mdx'],
    exclude: ['**/node_modules/**'],
  },
  siteUrl: 'https://yoursite.com',
  tracking: {
    baseUrl: '/link/',
    slugStrategy: 'auto',
  },
  networks: {
    amazon: {
      enabled: true,
      tag: 'your-amazon-tag-20',
      cleanParams: true,
    },
  },
};
```

2. Scan your content:

```bash
affilinker scan
```

3. Generate a report:

```bash
affilinker report --format sql -o links.sql
```

4. Transform your content to use tracking URLs:

```bash
affilinker transform --dry-run  # Preview changes
affilinker transform             # Apply changes
```

## Commands

### `affilinker scan`

Scan content files for outbound links.

```bash
affilinker scan [options]

Options:
  -c, --config <path>   Path to config file
  -p, --pattern <glob>  Override content include pattern
  --json                Output results as JSON
  --affiliate-only      Only show affiliate links
  --external-only       Only show external links
```

### `affilinker convert`

Convert affiliate links to clean format with proper tags.

```bash
affilinker convert [options]

Options:
  -c, --config <path>   Path to config file
  -p, --pattern <glob>  Override content include pattern
  --json                Output results as JSON
  --network <name>      Only convert links from specific network
```

### `affilinker report`

Generate reports of scanned links.

```bash
affilinker report [options]

Options:
  -c, --config <path>    Path to config file
  -p, --pattern <glob>   Override content include pattern
  -f, --format <type>    Output format: json, csv, sql, markdown (default: json)
  -o, --output <path>    Output file path (prints to stdout if not specified)
  -t, --table <name>     Table name for SQL output (default: affiliate_links)
  --affiliate-only       Only include affiliate links
  --external-only        Only include external links
```

### `affilinker transform`

Transform links in content files to use tracking URLs.

```bash
affilinker transform [options]

Options:
  -c, --config <path>   Path to config file
  -p, --pattern <glob>  Override content include pattern
  --dry-run             Show changes without applying them
  --json                Output results as JSON
```

### `affilinker sync`

Sync links with a database.

```bash
affilinker sync [options]

Options:
  -c, --config <path>   Path to config file
  -p, --pattern <glob>  Override content include pattern
  --dry-run             Show what would be synced without syncing
  --json                Output results as JSON
```

## Configuration

### Full Configuration Example

```javascript
export default {
  content: {
    include: ['content/**/*.mdx', 'content/**/*.md'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
  siteUrl: 'https://yoursite.com',
  tracking: {
    baseUrl: '/link/',
    slugStrategy: 'auto', // or 'manual'
  },
  networks: {
    amazon: {
      enabled: true,
      tag: 'your-amazon-tag-20',
      cleanParams: true, // Remove tracking parameters from URLs
    },
  },
  storage: {
    adapter: 'supabase', // or 'json'
    supabase: {
      url: process.env.SUPABASE_URL,
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      table: 'affiliate_links',
    },
    // Or for JSON file storage:
    // json: {
    //   path: './links.json',
    // },
  },
};
```

## Supported Networks

- **Amazon Associates** - Detects and converts Amazon product links

More networks coming soon.

## Database Schema

If using the `sync` command with Supabase, create a table with this schema:

```sql
CREATE TABLE affiliate_links (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  is_affiliate BOOLEAN DEFAULT false,
  network TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## How It Works

1. **Scanning**: Affilinker parses your MDX/Markdown files using unified/remark and extracts all links.

2. **Detection**: For each link, it checks if it matches a known affiliate network pattern (e.g., Amazon product links).

3. **Conversion**: Affiliate links are converted to clean URLs with proper tracking tags. For example:
   - Before: `http://www.amazon.com/gp/product/B000A6PPOK/ref=as_li_ss_tl?ie=UTF8&camp=1789&creative=390957&creativeASIN=B000A6PPOK&linkCode=as2&tag=donkitchencom-20`
   - After: `https://www.amazon.com/dp/B000A6PPOK?tag=donkitchencom-20`

4. **Slug Generation**: Each unique URL gets a slug generated from its link text. Duplicates are handled by appending domain names or numeric suffixes.

5. **Transformation**: Original URLs in your content are replaced with tracking URLs (`/link/slug-name`).

## License

MIT
