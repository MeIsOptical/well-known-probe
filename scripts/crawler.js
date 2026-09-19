
const cheerio = require('cheerio');

const db = require('./database');
const CONFIG = require('../config');


// shared state across all crawler instances
const domainRateLimits = new Map();
const checkedOrigins = new Set();



class Crawler {

    constructor() {
    }





    async enforceRateLimit(pOrigin) {
        const now = Date.now();
        const nextAllowedTime = domainRateLimits.get(pOrigin) || 0;

        if (now < nextAllowedTime) {
            // reserve the next available slot in the future
            const waitTime = nextAllowedTime - now;
            domainRateLimits.set(pOrigin, nextAllowedTime + CONFIG.crawler.rateLimitMs);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
            // execute immediately and reserve the next slot
            domainRateLimits.set(pOrigin, now + CONFIG.crawler.rateLimitMs);
        }
    }




    
    // check page language
    checkLanguage(pHtml) {
        const $ = cheerio.load(pHtml);
        const langAttr = $('html').attr('lang');
        if (!langAttr) return false;

        const lang = langAttr.split('-')[0].toLowerCase();
        return CONFIG.crawler.allowedLanguages.includes(lang);
    }





    // extract absolute and relative links
    extractLinks(pHtml, pBaseUrl) {
        const links = new Set();
        const $ = cheerio.load(pHtml);
        
        $('a').each((i, el) => {
            const node = $(el);
            const href = node.attr('href');
            if (!href) return;

            // check lang attribute on the anchor tag if present
            const langAttr = node.attr('lang');
            if (langAttr) {
                const lang = langAttr.split('-')[0].toLowerCase();
                if (!CONFIG.crawler.allowedLanguages.includes(lang)) {
                    return;
                }
            }
            
            try {
                const urlObj = new URL(href, pBaseUrl);
                
                // remove hash fragments to prevent duplicate page fetches
                urlObj.hash = '';
                
                const url = urlObj.href;
                
                if (url.startsWith('https://')) {
                    links.add(url);
                }
            } catch (e) {
                // ignore invalid urls
            }
        });
        
        return Array.from(links);
    }










    // fetch well-known endpoints for an origin
    async checkWellKnownEndpoints(pOrigin) {

        for (const endpoint of CONFIG.crawler.wellKnownEndpoints) {
            const url = `${pOrigin}${endpoint}`;

            // check if already visited
            if (db.isUrlVisited(url)) continue;
            db.addVisitedUrl(url);

            try {
                // rate limits
                await this.enforceRateLimit(pOrigin);

                // fetch url
                const options = { headers: { 'User-Agent': CONFIG.crawler.crawlerName } };
                const response = await fetch(url, options);

                if (!response.ok) {
                    await response.body?.cancel();
                    continue;
                }

                // check if redirected away from the exact endpoint
                const finalUrlObj = new URL(response.url);
                if (finalUrlObj.pathname !== endpoint) {
                    await response.body?.cancel();
                    continue;
                }

                // reject html responses (soft 404s or spa fallbacks)
                const contentType = response.headers.get('content-type') || '';
                if (contentType.includes('text/html')) {
                    await response.body?.cancel();
                    continue;
                }

                const text = await response.text();
                if (!text.trim()) continue;

                // validate json structure
                if (endpoint.endsWith('.json')) {
                    try {
                        const parsed = JSON.parse(text);
                        if (typeof parsed !== 'object' || parsed === null) continue;
                    } catch {
                        continue;
                    }
                }

                // validate text structure
                if (endpoint.endsWith('.txt')) {
                    if (text.trim().startsWith('<')) continue;
                }

                console.log(`Found well-known endpoint: ${url}`);
                db.addWellKnownUrl(url);
            } catch (error) {
                // ignore failed requests
            }
        }
    }









    async crawl() {
        while (true) {
            const item = db.popNextInQueue();
            
            // wait if queue is empty
            if (!item) {
                console.log("Queue is empty: Trying again in 10 seconds.");
                await new Promise(resolve => setTimeout(resolve, 10000));
                continue;
            }

            const { id, url } = item;

            // skip if already visited
            if (db.isUrlVisited(url)) continue;

            // mark as visited
            db.addVisitedUrl(url);

            try {

                // rate limit
                const origin = new URL(url).origin;
                await this.enforceRateLimit(origin);

                console.log(`Crawling '${url}'`);

                // fetch url
                const options = { headers: { 'User-Agent': CONFIG.crawler.crawlerName } };
                const response = await fetch(url, options);

                // discard if status code is not valid
                if (!response.ok) {
                    await response.body?.cancel();
                    continue;
                }
                
                // capture final url after redirect
                const finalUrl = response.url;
                if (finalUrl !== url && !db.isUrlVisited(finalUrl)) {
                    db.addVisitedUrl(finalUrl);
                }

                
                // check well-known agent endpoints once per origin
                try {
                    const finalOrigin = new URL(finalUrl).origin;
                    if (!checkedOrigins.has(finalOrigin)) {
                        checkedOrigins.add(finalOrigin);
                        await this.checkWellKnownEndpoints(finalOrigin);
                    }
                } catch (error) {
                    // ignore invalid urls
                }


                if (!response.headers.get('content-type')?.includes('text/html')) {
                    await response.body?.cancel();
                    continue;
                }
                
                const html = await response.text();
                
                // enforce language check
                if (!this.checkLanguage(html)) continue;
                

                // pass finalUrl as base to correctly resolve relative links
                const links = this.extractLinks(html, finalUrl);
                for (const link of links) {
                    if (!db.isUrlVisited(link)) {
                        db.addUrlToQueue(link);
                    }
                }
            } catch (error) {
                // ignore failed requests
            }
        }
    }


}




module.exports = Crawler;