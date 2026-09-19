

const SQLITE_DB = require('better-sqlite3');
const { preparePath } = require('./files');



class Database {
    constructor() {

        const dbPath = preparePath("data", "urls.db");
        this.db = new SQLITE_DB(dbPath);  
        
        // allow multiple sources at the same time
        this.db.pragma('journal_mode = WAL');

        // wait up to 5 seconds if db is locked instead of throwing error
        this.db.pragma('busy_timeout = 5000');


        // prepare tables
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS well_known_urls (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS visited_urls (
                url TEXT PRIMARY KEY
            );

            CREATE TABLE IF NOT EXISTS queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT UNIQUE NOT NULL
            );
        `);


        // visited_urls statements
        this.addVisitedStmt = this.db.prepare('INSERT OR IGNORE INTO visited_urls (url) VALUES (?)');
        this.checkVisitedStmt = this.db.prepare('SELECT url FROM visited_urls WHERE url = ?');
        this.removeVisitedStmt = this.db.prepare('DELETE FROM visited_urls WHERE url = ?');

        // queue statements
        this.addQueueStmt = this.db.prepare('INSERT OR IGNORE INTO queue (url) VALUES (?)');
        this.getNextQueueStmt = this.db.prepare('SELECT id, url FROM queue ORDER BY RANDOM() LIMIT 1');
        this.removeQueueStmt = this.db.prepare('DELETE FROM queue WHERE id = ?');

        // well_known_urls statements
        this.addWellKnownStmt = this.db.prepare('INSERT OR IGNORE INTO well_known_urls (url) VALUES (?)');
        this.getAllWellKnownStmt = this.db.prepare('SELECT url FROM well_known_urls');
    }



    close() {
        this.db.close();
    }





    // #region VISITED URLS

    addVisitedUrl(pUrl) {
        return this.addVisitedStmt.run(pUrl);
    }

    isUrlVisited(pUrl) {
        return this.checkVisitedStmt.get(pUrl) !== undefined;
    }

    removeVisitedUrl(pUrl) {
        return this.removeVisitedStmt.run(pUrl);
    }

    // #endregion




    // $#region QUEUE

    addUrlToQueue(pUrl) {
        return this.addQueueStmt.run(pUrl);
    }

    getNextInQueue() {
        // returns an object { id, url } or undefined if queue is empty
        return this.getNextQueueStmt.get();
    }

    removeUrlFromQueue(pId) {
        return this.removeQueueStmt.run(pId);
    }

    popNextInQueue() {
        return this.db.transaction(() => {
            const item = this.getNextQueueStmt.get();
            if (item) {
                this.removeQueueStmt.run(item.id);
            }
            return item;
        })();
    }

    // #endregion






    // #region WELL KNOWN

    addWellKnownUrl(pUrl) {
        return this.addWellKnownStmt.run(pUrl);
    }

    getAllWellKnownUrls() {
        return this.getAllWellKnownStmt.all();
    }

    // #endregion

    
}




module.exports = new Database();