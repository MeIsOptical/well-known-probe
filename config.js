

const CONFIG = {

    execution: {
        concurrentCrawlers: 20,
        seeds: [
            'https://nodejs.org/en',
            'https://www.electronjs.org/',
            'https://vercel.com/',
            'https://lobste.rs/',
            'https://ollama.com/',
            'https://huggingface.co/',
            'https://js.langchain.com/',
            'https://news.ycombinator.com/',
            'https://developer.mozilla.org/en-US/',
            'https://simonwillison.net/',
            'https://dev.to/',
            'https://hashnode.com/'
        ]
    },

    crawler: {
        crawlerName: 'Well-Known-Probe/1.0',
        allowedLanguages: ['en'],
        rateLimitMs: 700,
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