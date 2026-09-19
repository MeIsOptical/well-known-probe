

const CONFIG = {

    execution: {
        concurrentCrawlers: 5,
        seeds: [
            'https://news.ycombinator.com/',
            'https://developer.mozilla.org/en-US/',
            'https://en.wikipedia.org/wiki/Main_Page'
        ]
    },

    crawler: {
        crawlerName: 'Well-Known-Probe/1.0',
        allowedLanguages: ['en'],
        rateLimitMs: 1500,
        wellKnownEndpoints: [
            '/.well-known/llms.txt',
            '/.well-known/agent-manifest.json',
            '/.well-known/agent-card.json',
            '/.well-known/agents.json',
            '/.well-known/agent.json',
            '/.well-known/agent-skills/index.json'
        ]
    }

}


module.exports = CONFIG