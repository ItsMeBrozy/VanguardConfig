const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

function loadData() {
  const defaultData = { 
    loops: {}, 
    checks: {}, 
    applications: [], 
    config: {
      reviewChannelId: null,
      logsChannelId: null
    } 
  };
  
  if (!fs.existsSync(DATA_FILE)) return defaultData;
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return { ...defaultData, ...data };
  } catch {
    return defaultData;
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

module.exports = { loadData, saveData };
