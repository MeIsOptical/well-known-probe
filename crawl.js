
console.clear();

const events = require('events');

const db = require('./scripts/database');
const Crawler = require('./scripts/crawler');
const CONFIG = require('./config');



//#region SETUP


// scale listener threshold dynamically with amount of crawlers
events.defaultMaxListeners = Math.max(20, CONFIG.execution.concurrentCrawlers * 3);


process.on('SIGINT', () => {
    console.log('\nShutting down...');
    db.close();
    process.exit(0);
});

process.on('uncaughtException', (err) => {
    // ignore undici socket disconnect assertion bugs
    if (err.code === 'ERR_ASSERTION' && err.message?.includes('!this.paused')) {
        console.warn('Recovered from abrupt socket closure assertion.');
        return;
    }

    console.error('Fatal unhandled error:', err);
    db.close();
    process.exit(1);
});

//#endregion



//#region CRAWLER

// add seeds to queue
for (const seed of CONFIG.execution.seeds) {
    db.addUrlToQueue(seed);
}

// spawn multiple crawlers
const workers = [];
for (let i = 0; i < CONFIG.execution.concurrentCrawlers; i++) {
    const crawler = new Crawler();
    workers.push(crawler.crawl());
}

Promise.all(workers).then(() => {
    console.log();
    console.log('All crawlers finished.');
});

//#endregion


