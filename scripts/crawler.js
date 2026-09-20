
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
    checkLanguage(pLoadedPage) {
        const langAttr = pLoadedPage('html').attr('lang');
        if (!langAttr) return false;

        const lang = langAttr.split('-')[0].toLowerCase();
        return CONFIG.crawler.allowedLanguages.includes(lang);
    }





    // extract absolute and relative links
    extractLinks(pLoadedPage, pBaseUrl) {
        const found = new Set();
        
        pLoadedPage('a').each((i, el) => {
            const node = pLoadedPage(el);
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
                
                // remove hash fragments and query params
                urlObj.hash = '';
                urlObj.search = '';
                
                const url = urlObj.href;
                
                if (url.startsWith('https://')) {
                    found.add(url);
                }
            } catch (e) {
                // ignore invalid urls
            }
        });
        
        return Array.from(found);
    }








    // extract all urls from text or json content
    extractPayloadUrls(pContent, pBaseUrl) {
        const found = new Set();

        // absolute paths
        const absoluteMatches = pContent.match(/https?:\/\/[^\s"'`<>\)\],}]+/g) || [];
        for (const url of absoluteMatches) {
            try {
                const parsed = new URL(url);
                parsed.hash = '';
                found.add(parsed.href);
            } catch { }
        }

        // relative markdown paths
        const markdownMatches = pContent.matchAll(/\[.*?\]\((?!https?:\/\/)(\/[^\s\)]+)\)/g);
        for (const match of markdownMatches) {
            try {
                const resolved = new URL(match[1], pBaseUrl);
                resolved.hash = '';
                found.add(resolved.href);
            } catch { }
        }

        // relative paths
        const stringMatches = pContent.matchAll(/(['"`])(\/[^\s'"`]+)\1/g);
        for (const match of stringMatches) {
            try {
                // match[1] is the quote character, match[2] is the actual path
                const resolved = new URL(match[2], pBaseUrl);
                resolved.hash = '';
                found.add(resolved.href);
            } catch { }
        }

        return Array.from(found);
    }










    // probe and validate a specific well-known endpoint
    async probeEndpoint(pUrl, pOrigin) {

        // check if already visited
        if (db.isUrlVisited(pUrl)) return;
        db.addVisitedUrl(pUrl);

        let response;

        try {
            // rate limits
            await this.enforceRateLimit(pOrigin);

            // fetch url
            const options = {
                headers: { 'User-Agent': CONFIG.crawler.crawlerName },
                signal: AbortSignal.timeout(10000)
            };
            response = await fetch(pUrl, options);

            if (!response.ok) {
                await response.body?.cancel();
                return;
            }

            // check if redirected away from a .well-known path
            const finalUrlObj = new URL(response.url);
            if (!finalUrlObj.pathname.includes('/.well-known/')) {
                await response.body?.cancel();
                return;
            }

            // reject html responses (soft 404s or spa fallbacks)
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('text/html')) {
                await response.body?.cancel();
                return;
            }

            const text = await response.text();
            if (!text.trim()) return;

            if (finalUrlObj.pathname.endsWith('.txt') && text.trim().startsWith('<')) {
                return;
            }


            // validate json structure
            if (finalUrlObj.pathname.endsWith('.json')) {
                try {
                    const parsed = JSON.parse(text);
                    if (typeof parsed !== 'object' || parsed === null) return;
                } catch {
                    return;
                }
            }


            console.log(`Found well-known endpoint: ${pUrl}`);
            db.addWellKnownUrl(pUrl);


            // discover and route nested urls inside the payload
            const payloadUrls = this.extractPayloadUrls(text, pOrigin);
            for (const extractedUrl of payloadUrls) {
                if (extractedUrl.includes('/.well-known/')) {
                    // recursively probe nested endpoints
                    const nextOrigin = new URL(extractedUrl).origin;
                    await this.probeEndpoint(extractedUrl, nextOrigin);
                } else if (!db.isUrlVisited(extractedUrl)) {
                    // queue standard web pages for regular crawling
                    db.addUrlToQueue(extractedUrl);
                }
            }

        } catch (error) {
            // ignore failed requests
            if (response?.body && !response.bodyUsed) {
                await response.body.cancel().catch(() => { });
            }
        }
    }






    

    // fetch well-known endpoints for an origin
    async checkWellKnownEndpoints(pOrigin) {
        for (const endpoint of CONFIG.crawler.wellKnownEndpoints) {
            const url = `${pOrigin}${endpoint}`;
            await this.probeEndpoint(url, pOrigin);
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

            let response;

            try {

                // rate limit
                const origin = new URL(url).origin;
                await this.enforceRateLimit(origin);

                console.log(`Crawling '${url}'`);

                // fetch url
                const options = {
                    headers: { 'User-Agent': CONFIG.crawler.crawlerName },
                    signal: AbortSignal.timeout(10000)
                };
                response = await fetch(url, options);

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

                // read or cancel body before checking well-known routes
                const contentType = response.headers.get('content-type') || '';
                const isHtml = contentType.includes('text/html');

                let html = '';
                if (isHtml) {
                    html = await response.text();
                } else {
                    await response.body?.cancel();
                }

                
                // check well-known endpoints once per origin
                try {
                    const finalOrigin = new URL(finalUrl).origin;
                    if (!checkedOrigins.has(finalOrigin)) {
                        checkedOrigins.add(finalOrigin);
                        await this.checkWellKnownEndpoints(finalOrigin);
                    }
                } catch (error) {
                    // ignore invalid urls
                }


                if (!isHtml) continue;

                const loadedPage = cheerio.load(html);
                
                // enforce language check
                if (!this.checkLanguage(loadedPage)) continue;
                

                // extract links
                const links = this.extractLinks(loadedPage, finalUrl);
                for (const link of links) {
                    if (link.includes('/.well-known/')) {
                        if (!db.isUrlVisited(link)) {
                            const linkOrigin = new URL(link).origin;
                            await this.probeEndpoint(link, linkOrigin);
                        }
                    } else if (!db.isUrlVisited(link)) {
                        db.addUrlToQueue(link);
                    }
                }

            }
            catch (error) {
                // ignore failed requests
                if (response?.body && !response.bodyUsed) {
                    await response.body.cancel().catch(() => { });
                }
            }
        }
    }


}




module.exports = Crawler;