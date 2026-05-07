<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vanguard FC | Application Dashboard</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <header>
            <div class="logo">
                <h1>VANGUARD FC</h1>
            </div>
            <div class="refresh">
                <button class="tab-btn" onclick="fetchData()">Refresh Dashboard</button>
            </div>
        </header>

        <div class="stats-grid">
            <div class="stat-card">
                <span class="stat-value" id="total-apps">0</span>
                <span class="stat-label">Total Apps</span>
            </div>
            <div class="stat-card">
                <span class="stat-value" id="pending-apps" style="color: var(--warning)">0</span>
                <span class="stat-label">Pending</span>
            </div>
            <div class="stat-card">
                <span class="stat-value" id="approved-apps" style="color: var(--success)">0</span>
                <span class="stat-label">Approved</span>
            </div>
            <div class="stat-card">
                <span class="stat-value" id="rejected-apps" style="color: var(--danger)">0</span>
                <span class="stat-label">Rejected</span>
            </div>
            <div class="stat-card">
                <span class="stat-value" id="left-apps" style="color: #fff">0</span>
                <span class="stat-label">Kicked/Left</span>
            </div>
        </div>

        <div class="search-container">
            <input type="text" id="search-input" class="search-bar" placeholder="Search by username or user ID..." oninput="renderApps()">
        </div>

        <div class="tabs">
            <button class="tab-btn active" onclick="filterApps('all')">All</button>
            <button class="tab-btn" onclick="filterApps('pending')">Pending</button>
            <button class="tab-btn" onclick="filterApps('approved')">Approved</button>
            <button class="tab-btn" onclick="filterApps('rejected')">Rejected</button>
            <button class="tab-btn" onclick="filterApps('left')">Kicked/Left</button>
        </div>

        <div class="applications-grid" id="apps-container">
            <!-- Applications will be loaded here -->
        </div>
    </div>

    <script>
        let allApps = [];
        let currentFilter = 'all';

        async function fetchData() {
            try {
                const timestamp = Date.now();
                const [appsRes, statsRes] = await Promise.all([
                    fetch(`/api/applications?t=${timestamp}`),
                    fetch(`/api/stats?t=${timestamp}`)
                ]);
                
                allApps = await appsRes.json();
                const stats = await statsRes.json();

                document.getElementById('total-apps').innerText = stats.total;
                document.getElementById('pending-apps').innerText = stats.pending;
                document.getElementById('approved-apps').innerText = stats.approved;
                document.getElementById('rejected-apps').innerText = stats.rejected;
                document.getElementById('left-apps').innerText = stats.left || 0;

                renderApps();
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        }

        function filterApps(filter) {
            currentFilter = filter;
            document.querySelectorAll('.tab-btn').forEach(btn => {
                const btnText = btn.innerText.toLowerCase();
                if (btnText === filter.toLowerCase() || (btnText === 'kicked/left' && filter === 'left')) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            renderApps();
        }

        function renderApps() {
            const container = document.getElementById('apps-container');
            const searchQuery = document.getElementById('search-input').value.toLowerCase();
            container.innerHTML = '';

            let filtered = currentFilter === 'all' 
                ? allApps 
                : allApps.filter(a => a.status === currentFilter);

            // Apply search filter
            if (searchQuery) {
                filtered = filtered.filter(a => 
                    a.username.toLowerCase().includes(searchQuery) || 
                    a.userId.includes(searchQuery)
                );
            }

            if (filtered.length === 0) {
                container.innerHTML = '<p style="text-align: center; grid-column: 1/-1; color: var(--text-muted);">No applications found.</p>';
                return;
            }

            // Sort by timestamp (newest first)
            filtered.sort((a, b) => b.timestamp - a.timestamp);

            filtered.forEach(app => {
                const date = new Date(app.timestamp).toLocaleString();
                const card = document.createElement('div');
                card.className = `app-card ${app.status}`;
                
                // Construct body HTML based on whether we have dynamic fields or legacy ones
                let bodyHtml = '';
                if (app.fields && Array.isArray(app.fields)) {
                    bodyHtml = app.fields.map(f => `
                        <div class="app-field">
                            <span class="field-label">${f.label}</span>
                            <span class="field-value">${f.response}</span>
                        </div>
                    `).join('');
                } else {
                    // Legacy support
                    bodyHtml = `
                        <div class="app-field">
                            <span class="field-label">Name / Nickname</span>
                            <span class="field-value">${app.name || 'N/A'}</span>
                        </div>
                        <div class="app-field">
                            <span class="field-label">Age</span>
                            <span class="field-value">${app.age || 'N/A'}</span>
                        </div>
                        <div class="app-field">
                            <span class="field-label">Reason for joining</span>
                            <span class="field-value">${app.reason || 'N/A'}</span>
                        </div>
                    `;
                }

                const statusLabel = app.status === 'left' ? 'Kicked/Left' : app.status;

                card.innerHTML = `
                    <div class="app-header" style="display: flex; align-items: center; gap: 1rem;">
                        <img src="${app.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}" class="user-avatar" style="width: 50px; height: 50px; border-radius: 50%;" alt="Avatar">
                        <div class="user-info">
                            <h3 style="margin: 0; font-size: 1.1rem;">${app.username}</h3>
                            <span style="font-size: 0.8rem; color: var(--text-muted);">${date}</span>
                        </div>
                        <span class="app-status status-${app.status}" style="margin-left: auto; font-size: 0.75rem; text-transform: uppercase; font-weight: 700; padding: 0.25rem 0.75rem; border-radius: 2rem;">${statusLabel}</span>
                    </div>
                    <div class="app-body">
                        ${bodyHtml}
                        <div class="app-field" style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 5px;">
                            <span class="field-label">User ID</span>
                            <span class="field-value" style="font-family: monospace; font-size: 0.8rem;">${app.userId}</span>
                        </div>
                        ${app.rejectReason ? `
                            <div class="reject-reason">
                                <strong>Rejection Reason:</strong> ${app.rejectReason}
                            </div>
                        ` : ''}
                    </div>
                `;
                container.appendChild(card);
            });
        }

        // Initial fetch and polling every 10 seconds
        fetchData();
        setInterval(fetchData, 10000);
    </script>
</body>
</html>
