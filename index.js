const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 7860;
const DB_PATH = path.join(__dirname, 'db.json');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// Initialize database
if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ applications: [] }, null, 2));
}

const getDB = () => JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
const saveDB = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

// API Endpoints
app.get('/api/applications', (req, res) => {
    const db = getDB();
    res.json(db.applications);
});

app.post('/api/applications', (req, res) => {
    const { userId, username, displayName, status, reason, timestamp, moderator, messageId } = req.body;
    const db = getDB();
    
    // Check if we are updating an existing application by messageId (sent by bot)
    const existingIndex = db.applications.findIndex(app => app.messageId === messageId && messageId !== undefined);

    if (existingIndex !== -1) {
        // Update existing
        db.applications[existingIndex] = {
            ...db.applications[existingIndex],
            status,
            reason: reason || db.applications[existingIndex].reason,
            moderator: moderator || db.applications[existingIndex].moderator,
            timestamp: timestamp || new Date().toISOString()
        };
        saveDB(db);
        return res.status(200).json(db.applications[existingIndex]);
    } else {
        // Create new
        const newApp = {
            id: Date.now().toString(),
            userId,
            username,
            displayName,
            status: status || 'pending',
            reason: reason || 'No reason provided',
            timestamp: timestamp || new Date().toISOString(),
            moderator: moderator || 'N/A',
            messageId
        };

        db.applications.push(newApp);
        saveDB(db);
        res.status(201).json(newApp);
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
