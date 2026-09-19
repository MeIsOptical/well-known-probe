
const DATA_URL = "https://raw.githubusercontent.com/MeIsOptical/well-known-probe/main/data/endpoints.json";


let cachedData = null;

/**
 * Helper to fetch the dataset
 * @param {boolean} pRefresh Bypass the cache.
 * @returns Array of all discovered endpoints from the official dataset.
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