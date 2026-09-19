
const fs = require('fs');
const path = require('path');




const DIRNAME = path.join(__dirname, '..');


function preparePath(pDir, pFile) {
    const fullDir = path.join(DIRNAME, pDir);
    const fullPath = path.join(fullDir, pFile);

    // create dir if doesn't exist
    if (!fs.existsSync(fullDir)) {
        fs.mkdirSync(fullDir, { recursive: true });
        console.log(`Created directory './${pDir}'`);
    }

    return fullPath;
}




module.exports = {
    DIRNAME,
    preparePath
}