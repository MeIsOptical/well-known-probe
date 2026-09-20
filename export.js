
const fs = require('fs');

const db = require('./scripts/database');
const { preparePath } = require('./scripts/files');
const CONFIG = require('./config');



async function exportData() {

    // fetch all discovered urls
    const rows = db.getAllWellKnownUrls();



    // structure the urls
    const structuredData = [];
    for (const row of rows) {

        try {

            console.log(`Adding '${row.url}'...`);

            const parsedUrl = new URL(row.url);

            // cooldown to prevent rate limiting
            await new Promise(resolve => setTimeout(resolve, CONFIG.crawler.rateLimitMs));

            // fetch url
            const options = {
                headers: { 'User-Agent': CONFIG.crawler.crawlerName },
                signal: AbortSignal.timeout(10000)
            };
            const response = await fetch(row.url, options);

            if (!response.ok) {
                console.log(`Failed: Fetch returned status '${response.status}'`);
                await response.body?.cancel();
                continue;
            }

            // check if redirected away from the exact endpoint
            if (response.url !== row.url) {
                console.log(`Failed: URL redirected to '${response.url}'`);
                await response.body?.cancel();
                continue;
            }

            // reject html responses (soft 404s or spa fallbacks)
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('text/html')) {
                console.log(`Failed: Content is HTML`);
                await response.body?.cancel();
                continue;
            }

            let content = await response.text();
            if (!content.trim()) {
                console.log(`Failed: Page is empty`);
                continue;
            }



            if (row.url.endsWith('.txt') && content.trim().startsWith('<')) {
                console.log(`Failed: HTML content recognized in TXT file`);
                continue;
            }
            

            // validate json structure
            if (row.url.endsWith('.json')) {
                try {
                    content = JSON.parse(content);
                    if (typeof content !== 'object' || content === null) throw new Error();
                } catch {
                    console.log(`Failed: JSON content failed to parse`);
                    continue;
                }
            }           


            

            // structure results
            const structuredRow = {
                url: row.url,
                domain: parsedUrl.hostname,
                endpoint: parsedUrl.pathname,
                filename: parsedUrl.pathname.split('/').pop(),
                content
            };

            structuredData.push(structuredRow);

        }

        catch (error) {
            console.error(`Failed: ${error.message}`);
        }
        
    }



    // save to json file
    const outputPath = preparePath("data", "endpoints.json");
    fs.writeFileSync(outputPath, JSON.stringify(structuredData, null, 4));

    db.close();

    console.log();
    console.log(`Exported ${structuredData.length} URLs to '${outputPath}'`);
    console.log();
}


console.clear();
exportData();