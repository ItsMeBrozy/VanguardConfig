const express = require('express');
const path = require('path');
const cors = require('cors');
const { loadData } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// API to get all applications
app.get('/api/applications', (req, res) => {
  const data = loadData();
  res.json(data.applications || []);
});

// API to get stats
app.get('/api/stats', (req, res) => {
  const data = loadData();
  const apps = data.applications || [];
  
  const stats = {
    total: apps.length,
    pending: apps.filter(a => a.status === 'pending').length,
    approved: apps.filter(a => a.status === 'approved').length,
    rejected: apps.filter(a => a.status === 'rejected').length
  };
  
  res.json(stats);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
