
const DATA_URL = "https://raw.githubusercontent.com/MeIsOptical/well-known-probe/main/data/endpoints.json";

let cachedData = null;


/**
 * Helper to fetch the well-known-probe dataset
 * @param {boolean} pRefresh Bypass the cache
 * @returns Array of all discovered endpoints from the official dataset
 */
async function getDataset(pRefresh = false) {

    if (!cachedData || pRefresh) {
        const response = await fetch(DATA_URL);
        if (!response.ok) {
            throw new Error(`Failed to fetch /.well-known/ endpoints: ${response.status} ${response.statusText}`);
        }

        try {
            cachedData = await response.json();
        }
        catch (error) {
            throw new Error(`Failed to parse JSON from dataset.`);
        }
    }

    return cachedData;

}






/**
 * Searches the well-known-probe dataset and returns the best results
 * @param {string} pQuery Search query
 * @param {number} pTopCount [pTopCount=10] Maximum number of results to return (min: 1, max: 100)
 * @returns {Promise<Object[]>} Sorted array of matching entries
 */
async function searchFor(pQuery, pTopCount = 10) {

    if (pTopCount < 1 || pTopCount > 100) throw new Error("pTopCount must be between 1 and 100.");

    const dataset = await getDataset();
    const query = pQuery.toLowerCase();
    const results = [];

    for (const entry of dataset) {

        // Get searchable text
        const contentText = typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content);
        const searchableText = `${entry.url} ${contentText}`.toLowerCase();

        // Count how many times the query is in the searchable text
        const count = searchableText.split(query).length - 1;

        // Add to results if matches found
        if (count > 0) {
            const score = count / searchableText.length;
            results.push({ entry, score });
        }

    }

    // Sort by score
    results.sort((a, b) => b.score - a.score);

    // Slice top results and remove score property
    return results.slice(0, pTopCount).map(item => item.entry);

}



// Exports
module.exports = {
    getDataset,
    searchFor
};