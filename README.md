# Well-Known Probe

[![Dataset](https://img.shields.io/badge/dataset-live_json-blue?style=flat-square)](https://raw.githubusercontent.com/MeIsOptical/well-known-probe/main/data/endpoints.json)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-purple?style=flat-square)](LICENSE)

A crawler cataloging verified AI agent manifests, agent cards, and machine-readable metadata discovered across the web under RFC 8615 `/.well-known/` paths.

<br>

## Overview
This repository catalogs endpoints that define autonomous agent capabilities, specifications, and LLM documentation. Every entry has been fetched and verified against redirects and errors.

<br>

## Usage

### NPM Package

Install via npm:

```bash
npm install well-known-probe
```


Search or fetch endpoints:
```javascript
const { searchFor, getDataset } = require('well-known-probe');

async function run() {
    // Search top matches
    const results = await searchFor('mcp', 5);
    console.log(results);

    // Or load the full dataset directly
    const dataset = await getDataset();
}

run();
```

<br>

### Raw Dataset
If you want, you can also just fetch the latest version of the dataset for your own projects at `https://raw.githubusercontent.com/MeIsOptical/well-known-probe/main/data/endpoints.json`. This JSON file contains an array of objects, each representing a discovered endpoint.

<br>

## Monitored Endpoints

| Endpoint | Typical Content |
| ----- | ----- |
| `/.well-known/llms.txt` | Context and usage guides |
| `/.well-known/agent-manifest.json` | Capability definitions and service schemas |
| `/.well-known/agent-card.json` | Identification, models, and interaction protocols |
| `/.well-known/agents.json` | Directory of agents hosted under the domain |
| `/.well-known/agent.json` | Single agent metadata and capabilities |
| `/.well-known/agent-skills/index.json` | Directory of executable skills and functions |

<br>

To ensure data quality, entries in this dataset must meet strict validation rules:

- **Strict Route Match:** The response URL after redirects must match the exact expected pathname.
- **Soft-404 Elimination:** Responses returning HTML content types (text/html) are dropped to filter out Single Page Application fallback routes.
- **Payload Validation:** JSON endpoints must parse into valid objects, and .txt endpoints cannot begin with HTML tags.

<br>

## Reproduction
If you wish to reproduce this dataset, follow these steps:
1. Make sure to have **Node.js** (v18+).
2. Clone this repository.
3. Install dependencies with `npm install` *(cheerio & better-sqlite3)*.
4. Update the `config.js` file to match your preferences.
5. Run the script using `node crawl`.

<br>

 **Notes:**
<br>
*The database will be created at `data/urls.db`.
<br>
*To export the found endpoints, use `node export`.