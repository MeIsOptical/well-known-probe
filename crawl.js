
console.clear();

const db = require('./scripts/database');
const Crawler = require('./scripts/crawler');
const CONFIG = require('./config');



//#region SETUP

process.on('SIGINT', () => {
    console.log('\nShutting down...');
    db.close();
    process.exit(0);
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


