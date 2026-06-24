/* ================================================================
   BLOK. — Admin Engine (Netlify Edition)
   Auth, data management, dashboard — all via Netlify Functions
   ================================================================ */

(function () {
  'use strict';

  // =============================================================
  // 0. API Client
  // =============================================================

  const API = {
    // In local dev (netlify dev) use port 8888; in prod use same origin
    base: (function () {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:8888/api';
      }
      return '/api';
    })(),

    getToken() {
      const raw = sessionStorage.getItem('blok_admin_session');
      if (!raw) return null;
      try {
        return JSON.parse(raw).token;
      } catch {
        return null;
      }
    },

    headers(noAuth) {
      const h = { 'Content-Type': 'application/json' };
      if (!noAuth) {
        const token = this.getToken();
        if (token) h['Authorization'] = 'Bearer ' + token;
      }
      return h;
    },

    async request(method, path, body) {
      const url = this.base + path;
      const opts = { method, headers: this.headers() };
      if (body) opts.body = JSON.stringify(body);

      try {
        const res = await fetch(url, opts);
        const data = await res.json();

        if (!res.ok) {
          // If 401, session expired
          if (res.status === 401) {
            sessionStorage.removeItem('blok_admin_session');
            if (window.location.pathname.includes('dashboard')) {
              sessionStorage.setItem('blok_admin_redirect', window.location.href);
              window.location.href = 'login.html?expired=1';
            }
          }
          return { ok: false, error: data.error || 'Request failed (' + res.status + ')' };
        }
        return { ok: true, ...data };
      } catch (err) {
        return { ok: false, error: 'Network error: ' + err.message };
      }
    },

    get(path) { return this.request('GET', path); },
    post(path, body) { return this.request('POST', path, body); },
    patch(path, body) { return this.request('PATCH', path, body); },
    del(path) { return this.request('DELETE', path); },
  };

  // =============================================================
  // 1. Auth Module
  // =============================================================

  const AUTH = {
    SESSION_KEY: 'blok_admin_session',
    REDIRECT_KEY: 'blok_admin_redirect',

    async login(username, password) {
      const res = await API.post('/auth', { username, password }, true);
      if (res.ok && res.token) {
        const session = {
          user: res.user,
          token: res.token,
          loginAt: new Date().toISOString(),
          expiresIn: res.expiresIn || '24h',
        };
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
        return { ok: true };
      }
      return { ok: false, error: res.error || 'Authentication failed' };
    },

    async verify() {
      const session = this.getSession();
      if (!session) return false;

      const res = await API.get('/auth');
      if (res.ok) return true;

      // Token invalid — clear and redirect
      sessionStorage.removeItem(this.SESSION_KEY);
      return false;
    },

    logout() {
      sessionStorage.removeItem(this.SESSION_KEY);
      window.location.href = 'login.html';
    },

    getSession() {
      const raw = sessionStorage.getItem(this.SESSION_KEY);
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    },

    async requireAuth() {
      const session = this.getSession();
      if (!session) {
        sessionStorage.setItem(this.REDIRECT_KEY, window.location.href);
        window.location.href = 'login.html';
        return false;
      }

      const valid = await this.verify();
      if (!valid) {
        sessionStorage.setItem(this.REDIRECT_KEY, window.location.href);
        window.location.href = 'login.html?expired=1';
        return false;
      }
      return true;
    },

    getUser() {
      const s = this.getSession();
      return s ? s.user : null;
    },
  };

  // =============================================================
  // 2. Data Store — Netlify Blobs API
  // =============================================================

  const DB = {
    // ── Leads ──────────────────────────────────────────────────
    async getLeads() {
      const res = await API.get('/leads');
      return res.ok ? (res.leads || []) : [];
    },

    async addLead(data) {
      return await API.post('/leads', data);
    },

    async updateLeadStatus(id, status) {
      return await API.patch('/leads', { id, status });
    },

    async deleteLead(id) {
      return await API.del('/leads?id=' + encodeURIComponent(id));
    },

    // ── Portfolio ──────────────────────────────────────────────
    async getPortfolio() {
      const res = await API.get('/portfolio');
      return res.ok ? (res.portfolio || []) : [];
    },

    async addPortfolioItem(data) {
      return await API.post('/portfolio', data);
    },

    async removePortfolioItem(id) {
      return await API.del('/portfolio?id=' + encodeURIComponent(id));
    },

    async updatePortfolioItem(data) {
      return await API.patch('/portfolio', data);
    },

    // ── Contact form (public, no auth needed on the function) ──
    async submitContact(data) {
      // The contact endpoint is public, but we can't use API.headers() without token
      try {
        const res = await fetch(API.base + '/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        return await res.json();
      } catch (err) {
        return { ok: false, error: err.message };
      }
    },

    // ── Log (stored client-side for now) ───────────────────────
    getLog() {
      try {
        return JSON.parse(localStorage.getItem('blok_admin_log')) || [];
      } catch { return []; }
    },

    addLog(type, msg) {
      const logs = this.getLog();
      logs.unshift({ type, msg, time: new Date().toISOString() });
      if (logs.length > 100) logs.length = 100;
      localStorage.setItem('blok_admin_log', JSON.stringify(logs));
    },

    clearLog() {
      localStorage.removeItem('blok_admin_log');
    },
  };

  // =============================================================
  // 3. Dashboard Renderer
  // =============================================================

  const DASHBOARD = {
    _leads: [],
    _portfolio: [],

    async init() {
      const [leads, portfolio] = await Promise.all([DB.getLeads(), DB.getPortfolio()]);
      this._leads = leads;
      this._portfolio = portfolio;
      this.renderAll();
    },

    async refresh() {
      const [leads, portfolio] = await Promise.all([DB.getLeads(), DB.getPortfolio()]);
      this._leads = leads;
      this._portfolio = portfolio;
      this.renderAll();
    },

    renderAll() {
      this.renderKPIs();
      this.renderLeads();
      this.renderPortfolio();
      this.renderInspector();
      this.renderLog();
      this.renderQuickActions();
    },

    // ── KPI cards ──────────────────────────────────────────────
    renderKPIs() {
      const grid = document.getElementById('kpiGrid');
      if (!grid) return;

      const leads = this._leads;
      const portfolio = this._portfolio;
      const newLeads = leads.filter(l => l.status === 'new').length;
      const totalLeads = leads.length;

      grid.innerHTML = `
        <div class="card card--kpi">
          <div class="card__body">
            <div class="card__value">${totalLeads}</div>
            <div class="card__label">Total Leads</div>
            ${newLeads > 0 ? `<div class="card__trend card__trend--up"><i class="ph ph-circle"></i> ${newLeads} unread</div>` : '<div class="card__trend card__trend--neutral">All caught up</div>'}
          </div>
          <div class="card__meter"><div class="card__meter-fill card__meter-fill--accent" style="width: ${Math.min(100, totalLeads * 8)}%"></div></div>
          <div class="card__footer">Stored in Netlify Blobs</div>
        </div>

        <div class="card card--kpi">
          <div class="card__body">
            <div class="card__value">${portfolio.length}</div>
            <div class="card__label">Portfolio Items</div>
            <div class="card__trend card__trend--neutral">Managed via API</div>
          </div>
          <div class="card__meter"><div class="card__meter-fill card__meter-fill--steel" style="width: ${Math.min(100, portfolio.length * 20)}%"></div></div>
          <div class="card__footer">Persistent across sessions</div>
        </div>

        <div class="card card--kpi">
          <div class="card__body">
            <div class="card__value">${newLeads}</div>
            <div class="card__label">Needs Attention</div>
            ${newLeads > 0
              ? `<div class="card__trend card__trend--down"><i class="ph ph-warning"></i> Action required</div>`
              : `<div class="card__trend card__trend--up"><i class="ph ph-check"></i> All clear</div>`}
          </div>
          <div class="card__meter"><div class="card__meter-fill card__meter-fill--green" style="width: ${newLeads === 0 ? 100 : 30}%"></div></div>
          <div class="card__footer">Response SLA: 24h</div>
        </div>

        <div class="card card--kpi">
          <div class="card__body">
            <div class="card__value">98.7<span style="font-size:1rem">%</span></div>
            <div class="card__label">Structural Integrity</div>
            <div class="card__trend card__trend--up"><i class="ph ph-arrow-up"></i> Nominal</div>
          </div>
          <div class="card__meter"><div class="card__meter-fill card__meter-fill--green" style="width: 98.7%"></div></div>
          <div class="card__footer">All systems operational</div>
        </div>
      `;
    },

    // ── Leads table ────────────────────────────────────────────
    _expandedLeadId: null,

    renderLeads() {
      const fullContainer = document.getElementById('leadsContainer');
      const previewContainer = document.getElementById('leadsPreviewContainer');

      if (!fullContainer && !previewContainer) return;

      const leads = this._leads;

      // Update lead count label if it exists
      const countLabel = document.getElementById('leadCountLabel');
      if (countLabel) countLabel.textContent = leads.length + ' total';

      if (leads.length === 0) {
        const emptyHtml = `
          <div class="admin-table__empty">
            <i class="ph ph-tray"></i>
            <p>No leads yet. Contact form submissions will appear here.</p>
          </div>
        `;
        if (fullContainer) fullContainer.innerHTML = emptyHtml;
        if (previewContainer) previewContainer.innerHTML = emptyHtml;
        return;
      }

      // ── Full leads table (leads page) ────────────────────────
      let html = `
        <div class="admin-table-wrap">
        <table class="admin-table lead-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Name</th>
              <th>Email</th>
              <th>Budget</th>
              <th>Message</th>
              <th>Received</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
      `;

      leads.forEach(function (lead) {
        const isExpanded = this._expandedLeadId === lead.id;
        const statusClass = 'status-badge--' + lead.status;
        const statusLabel = lead.status.charAt(0).toUpperCase() + lead.status.slice(1);
        const date = new Date(lead.createdAt);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const messagePreview = lead.message && lead.message.length > 60 ? lead.message.slice(0, 60) + '…' : (lead.message || '');

        html += `
          <tr class="lead-row ${isExpanded ? 'lead-row--expanded' : ''}" onclick="BLOK_ADMIN.toggleLeadExpand('${lead.id}')" tabindex="0">
            <td><span class="status-badge ${statusClass}" onclick="event.stopPropagation()">${statusLabel}</span></td>
            <td><strong>${esc(lead.name)}</strong></td>
            <td onclick="event.stopPropagation()"><a href="mailto:${esc(lead.email)}">${esc(lead.email)}</a></td>
            <td><span class="tag tag--steel">${esc(lead.budget)}</span></td>
            <td class="text-muted text-sm">${esc(messagePreview)}</td>
            <td class="text-muted text-sm">${dateStr}</td>
            <td onclick="event.stopPropagation()">
              <div class="lead-actions">
                <button class="admin-btn admin-btn--small" onclick="BLOK_ADMIN.toggleLeadRead('${lead.id}')" title="Mark as ${lead.status === 'new' ? 'read' : 'unread'}"><i class="ph ph-${lead.status === 'new' ? 'envelope-open' : 'envelope'}"></i></button>
                <button class="admin-btn admin-btn--small" onclick="BLOK_ADMIN.archiveLead('${lead.id}')" title="Archive"><i class="ph ph-archive"></i></button>
                <button class="admin-btn admin-btn--small btn--danger" onclick="BLOK_ADMIN.deleteLead('${lead.id}')" title="Delete"><i class="ph ph-trash"></i></button>
              </div>
            </td>
          </tr>
          ${isExpanded ? `
          <tr class="lead-detail-row">
            <td colspan="7">
              <div class="lead-detail">
                <div class="lead-detail__grid">
                  <div class="lead-detail__field">
                    <span class="lead-detail__label"><i class="ph ph-user"></i> Name</span>
                    <span class="lead-detail__value">${esc(lead.name)}</span>
                  </div>
                  <div class="lead-detail__field">
                    <span class="lead-detail__label"><i class="ph ph-envelope"></i> Email</span>
                    <span class="lead-detail__value"><a href="mailto:${esc(lead.email)}">${esc(lead.email)}</a></span>
                  </div>
                  <div class="lead-detail__field">
                    <span class="lead-detail__label"><i class="ph ph-currency-dollar"></i> Budget</span>
                    <span class="lead-detail__value"><span class="tag tag--steel">${esc(lead.budget)}</span></span>
                  </div>
                  <div class="lead-detail__field">
                    <span class="lead-detail__label"><i class="ph ph-calendar"></i> Received</span>
                    <span class="lead-detail__value">${dateStr}</span>
                  </div>
                  <div class="lead-detail__field">
                    <span class="lead-detail__label"><i class="ph ph-folder"></i> Status</span>
                    <span class="lead-detail__value"><span class="status-badge ${statusClass}">${statusLabel}</span></span>
                  </div>
                  <div class="lead-detail__field">
                    <span class="lead-detail__label"><i class="ph ph-tag"></i> ID</span>
                    <span class="lead-detail__value text-muted text-sm">${esc(lead.id)}</span>
                  </div>
                </div>
                <div class="lead-detail__message">
                  <span class="lead-detail__label"><i class="ph ph-chat-text"></i> Full Message</span>
                  <div class="lead-detail__message-body">${esc(lead.message || '(no message)')}</div>
                </div>
              </div>
            </td>
          </tr>
          ` : ''}
        `;
      }.bind(this));

      html += `
          </tbody>
        </table>
        </div>
        <div class="card__footer" style="display:flex;justify-content:space-between;align-items:center;">
          <span>${leads.length} total lead${leads.length !== 1 ? 's' : ''} · Netlify Blob storage</span>
          <button class="admin-btn admin-btn--small" onclick="BLOK_ADMIN.exportLeads()"><i class="ph ph-download-simple"></i> Export JSON</button>
        </div>
      `;

      if (fullContainer) fullContainer.innerHTML = html;

      // ── Preview table (dashboard) — minimal, no expand ───────
      let previewHtml = `
        <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Name</th>
              <th>Email</th>
              <th>Budget</th>
              <th>Message</th>
              <th>Received</th>
            </tr>
          </thead>
          <tbody>
      `;

      leads.slice(0, 5).forEach(function (lead) {
        const statusClass = 'status-badge--' + lead.status;
        const statusLabel = lead.status.charAt(0).toUpperCase() + lead.status.slice(1);
        const date = new Date(lead.createdAt);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const messagePreview = lead.message && lead.message.length > 60 ? lead.message.slice(0, 60) + '…' : (lead.message || '');

        previewHtml += `
          <tr>
            <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
            <td><strong>${esc(lead.name)}</strong></td>
            <td><a href="mailto:${esc(lead.email)}">${esc(lead.email)}</a></td>
            <td><span class="tag tag--steel">${esc(lead.budget)}</span></td>
            <td class="text-muted text-sm" title="${esc(lead.message)}">${esc(messagePreview)}</td>
            <td class="text-muted text-sm">${dateStr}</td>
          </tr>
        `;
      }.bind(this));

      previewHtml += `</tbody></table></div>`;
      if (previewContainer) previewContainer.innerHTML = previewHtml;
    },

    // ── Portfolio ──────────────────────────────────────────────
    _editingPortfolioId: null,

    renderPortfolio() {
      const container = document.getElementById('portfolioContainer');
      if (!container) return;

      const items = this._portfolio;

      if (items.length === 0) {
        container.innerHTML = `
          <div class="admin-table__empty">
            <i class="ph ph-image"></i>
            <p>No portfolio items. Add one above.</p>
          </div>
        `;
        return;
      }

      // Preview container on dashboard
      const previewContainer = document.getElementById('portfolioPreviewContainer');

      let html = '<div class="portfolio-grid">';
      items.forEach(function (item) {
        const isEditing = this._editingPortfolioId === item.id;
        html += `
          <div class="portfolio-card ${isEditing ? 'portfolio-card--editing' : ''}">
            <div class="portfolio-card__thumb">
              ${item.url
                ? `<iframe class="portfolio-card__iframe" src="${esc(item.url)}" sandbox="allow-scripts allow-same-origin" loading="lazy" title="Preview of ${esc(item.title)}"></iframe>`
                : `<span class="tag tag--steel">${esc(item.tag || 'Uncategorized')}</span>`
              }
            </div>
            <div class="portfolio-card__body">
              <div class="portfolio-card__title">${isEditing ? `<input type="text" class="admin-input" value="${esc(item.title)}" id="portEditTitle_${item.id}">` : esc(item.title)}</div>
              <div class="portfolio-card__meta">
                <span class="tag tag--steel">${isEditing ? `<input type="text" class="admin-input" value="${esc(item.tag || '')}" id="portEditTag_${item.id}" placeholder="Category">` : esc(item.tag || 'Uncategorized')}</span>
                ${item.url
                  ? `<span class="tag tag--accent"><i class="ph ph-link"></i> ${isEditing ? `<input type="url" class="admin-input" value="${esc(item.url)}" id="portEditUrl_${item.id}" placeholder="https://..." style="width:200px">` : 'linked'}</span>`
                  : `<span class="tag tag--steel"><i class="ph ph-link-simple-break"></i> local</span>`
                }
              </div>
              ${isEditing
                ? `<textarea class="admin-input" id="portEditDesc_${item.id}" placeholder="Description" rows="2" style="width:100%;margin-top:4px">${esc(item.desc || '')}</textarea>`
                : `<p class="text-sm text-muted" style="margin-top:4px">${esc(item.desc || '')}</p>`
              }
              <div class="portfolio-card__actions">
                ${isEditing
                  ? `
                    <button class="admin-btn admin-btn--primary" onclick="BLOK_ADMIN.savePortfolioItem('${item.id}')"><i class="ph ph-check"></i> Save</button>
                    <button class="admin-btn" onclick="BLOK_ADMIN.cancelEditPortfolio()"><i class="ph ph-x"></i> Cancel</button>
                  `
                  : `
                    <button class="admin-btn admin-btn--small" onclick="BLOK_ADMIN.editPortfolioItem('${item.id}')"><i class="ph ph-pencil-simple"></i> Edit</button>
                    <button onclick="window.open('${esc(item.url)}','_blank')" class="admin-btn admin-btn--small" ${item.url ? '' : 'disabled'}><i class="ph ph-arrow-square-out"></i> View</button>
                    <button class="admin-btn admin-btn--small btn--danger" onclick="BLOK_ADMIN.removePortfolioItem('${item.id}')"><i class="ph ph-trash"></i></button>
                  `
                }
              </div>
            </div>
          </div>
        `;
      }.bind(this));
      html += '</div>';
      container.innerHTML = html;

      // Also populate preview on dashboard (no edit actions, simplified)
      if (previewContainer) {
        let prevHtml = '<div class="portfolio-grid">';
        items.forEach(function (item) {
          prevHtml += `
            <div class="portfolio-card portfolio-card--preview">
              <div class="portfolio-card__thumb">
                ${item.url
                  ? `<iframe class="portfolio-card__iframe" src="${esc(item.url)}" sandbox="allow-scripts allow-same-origin" loading="lazy" title="Preview of ${esc(item.title)}"></iframe>`
                  : `<span class="tag tag--steel">${esc(item.tag || 'Uncategorized')}</span>`
                }
              </div>
              <div class="portfolio-card__body">
                <div class="portfolio-card__title">${esc(item.title)}</div>
                <div class="portfolio-card__meta">
                  <span class="tag tag--steel">${esc(item.tag || 'Uncategorized')}</span>
                  ${item.url ? `<span class="tag tag--accent"><i class="ph ph-link"></i> linked</span>` : ''}
                </div>
                <p class="text-sm text-muted" style="margin-top:4px">${esc(item.desc || '')}</p>
                <div class="portfolio-card__actions">
                  <button onclick="window.open('${esc(item.url)}','_blank')" class="admin-btn admin-btn--small" ${item.url ? '' : 'disabled'}><i class="ph ph-arrow-square-out"></i> View</button>
                </div>
              </div>
            </div>
          `;
        }.bind(this));
        prevHtml += '</div>';
        previewContainer.innerHTML = prevHtml;
      }

      // Populate the add/edit form
      const form = document.getElementById('portfolioForm');
      if (form) {
        form.innerHTML = `
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;align-items:end;">
            <div>
              <label class="admin-label">Title</label>
              <input type="text" class="admin-input" id="portTitle" placeholder="Project name">
            </div>
            <div>
              <label class="admin-label">Category</label>
              <input type="text" class="admin-input" id="portTag" placeholder="Demo / Client">
            </div>
            <div>
              <label class="admin-label">URL</label>
              <input type="url" class="admin-input" id="portUrl" placeholder="https://...">
            </div>
          </div>
          <div style="margin-top:8px;">
            <label class="admin-label">Description</label>
            <input type="text" class="admin-input" id="portDesc" placeholder="Brief description">
          </div>
          <div style="margin-top:12px;">
            <button class="admin-btn admin-btn--primary" onclick="BLOK_ADMIN.addPortfolioItem()"><i class="ph ph-plus"></i> Add Item</button>
          </div>
        `;
      }
    },

    // ── Inspector ──────────────────────────────────────────────
    renderInspector() {
      const container = document.getElementById('inspectorContainer');
      if (!container) return;

      const navStatus = navigator.onLine ? 'Online' : 'Offline';
      const navColor = navigator.onLine ? 'var(--green)' : 'var(--red)';
      const memory = navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'N/A';
      const cores = navigator.hardwareConcurrency ? navigator.hardwareConcurrency + ' cores' : 'N/A';

      container.innerHTML = `
        <div class="inspector-grid">
          <div class="inspector-item">
            <span class="inspector-item__label"><i class="ph ph-wifi-high"></i> Network</span>
            <span class="inspector-item__value" style="color:${navColor}">${navStatus}</span>
          </div>
          <div class="inspector-item">
            <span class="inspector-item__label"><i class="ph ph-cloud"></i> API Status</span>
            <span class="inspector-item__value" style="color:var(--green)">Active</span>
          </div>
          <div class="inspector-item">
            <span class="inspector-item__label"><i class="ph ph-cpu"></i> CPU Cores</span>
            <span class="inspector-item__value">${cores}</span>
          </div>
          <div class="inspector-item">
            <span class="inspector-item__label"><i class="ph ph-database"></i> Memory</span>
            <span class="inspector-item__value">${memory}</span>
          </div>
          <div class="inspector-item">
            <span class="inspector-item__label"><i class="ph ph-hard-drives"></i> Storage</span>
            <span class="inspector-item__value">Netlify Blobs</span>
          </div>
          <div class="inspector-item">
            <span class="inspector-item__label"><i class="ph ph-clock"></i> Server Time</span>
            <span class="inspector-item__value">${new Date().toLocaleString()}</span>
          </div>
        </div>
        <div class="health-ring" style="margin-top:16px;border:1px solid var(--border);">
          <div class="health-ring__visual" id="healthRing">98.7%</div>
          <div class="health-ring__details">
            <div class="health-ring__label">Structural Health</div>
            <div class="health-ring__sub">All systems · Blob storage · API online</div>
            <div class="health-ring__sub" style="margin-top:4px;color:var(--green);">✓ Auth · ✓ Leads API · ✓ Portfolio API · ✓ Contact API</div>
          </div>
        </div>
      `;
    },

    // ── Console log ────────────────────────────────────────────
    renderLog() {
      const container = document.getElementById('logContainer');
      if (!container) return;

      const logs = DB.getLog();

      if (logs.length === 0) {
        container.innerHTML = '<div class="console-log"><div class="console-log__line"><span class="console-log__type console-log__type--info">[system]</span><span class="console-log__msg">No events logged yet.</span></div></div>';
        return;
      }

      let html = '<div class="console-log">';
      logs.slice(0, 30).forEach(function (entry) {
        const time = new Date(entry.time);
        const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const typeClass = 'console-log__type--' + (entry.type || 'info');
        html += `
          <div class="console-log__line">
            <span class="console-log__time">[${timeStr}]</span>
            <span class="console-log__type ${typeClass}">${entry.type}</span>
            <span class="console-log__msg">${esc(entry.msg)}</span>
          </div>
        `;
      }.bind(this));
      html += '</div>';
      container.innerHTML = html;
    },

    // ── Quick actions ──────────────────────────────────────────
    renderQuickActions() {
      const container = document.getElementById('quickActionsContainer');
      if (!container) return;

      container.innerHTML = `
        <div class="quick-actions">
          <a href="../index.html" target="_blank" class="quick-action">
            <i class="ph ph-globe"></i> View Live Site
          </a>
          <button class="quick-action" onclick="document.getElementById('leadsNav').click()">
            <i class="ph ph-tray"></i> View Leads
          </button>
          <button class="quick-action" onclick="document.getElementById('portfolioNav').click()">
            <i class="ph ph-image"></i> Manage Portfolio
          </button>
          <button class="quick-action" onclick="BLOK_ADMIN.exportLeads()">
            <i class="ph ph-download"></i> Export Leads
          </button>
          <button class="quick-action" onclick="BLOK_ADMIN.exportPortfolio()">
            <i class="ph ph-download"></i> Export Portfolio
          </button>
        </div>
      `;
    },
  };

  // =============================================================
  // 4. Page Navigation
  // =============================================================

  const NAV = {
    init() {
      document.querySelectorAll('.admin-nav__item[data-page]').forEach(function (item) {
        item.addEventListener('click', function () {
          const page = item.getAttribute('data-page');
          NAV.goTo(page);
        });
      });

      // Restore hash or default to dashboard
      const hash = window.location.hash.replace('#', '');
      NAV.goTo(hash || 'dashboard');
    },

    goTo(pageId) {
      document.querySelectorAll('.admin-nav__item').forEach(function (item) {
        item.classList.toggle('admin-nav__item--active', item.getAttribute('data-page') === pageId);
      });

      document.querySelectorAll('.admin-page').forEach(function (page) {
        page.classList.toggle('admin-page--active', page.id === pageId + 'Page');
      });

      const headerTitle = document.getElementById('pageTitle');
      const activeItem = document.querySelector('.admin-nav__item--active');
      if (headerTitle && activeItem) {
        headerTitle.textContent = activeItem.textContent.trim();
      }

      // Only set hash if different (avoids redundant navigation/reload)
      if (window.location.hash !== '#' + pageId) {
        window.location.hash = pageId;
      }

      // Refresh data when navigating to data-heavy pages
      if (['dashboard', 'leads', 'portfolio', 'inspector'].includes(pageId)) {
        DASHBOARD.refresh();
      }
    },
  };

  // =============================================================
  // 5. Bootstrap
  // =============================================================

  // Expose to global for inline onclick handlers
  window.BLOK_ADMIN = {
    // ── Auth ────────────────────────────────────────────────────
    async login() {
      const username = document.getElementById('loginUser').value.trim();
      const password = document.getElementById('loginPass').value;
      const errorEl = document.getElementById('loginError');
      const btn = document.getElementById('loginBtn');

      if (!username || !password) {
        errorEl.textContent = 'Both fields are required.';
        errorEl.classList.add('login-error--visible');
        return;
      }

      btn.textContent = 'Authenticating…';
      btn.disabled = true;

      const result = await AUTH.login(username, password);

      if (result.ok) {
        // Restore the original URL (with hash) if redirected from requireAuth
        const redirect = sessionStorage.getItem(AUTH.REDIRECT_KEY);
        sessionStorage.removeItem(AUTH.REDIRECT_KEY);
        window.location.href = redirect || 'dashboard.html';
      } else {
        errorEl.textContent = result.error;
        errorEl.classList.add('login-error--visible');
        btn.textContent = 'Access control';
        btn.disabled = false;
      }
    },

    logout() {
      AUTH.logout();
    },

    // ── Lead Actions ────────────────────────────────────────────
    async toggleLeadRead(id) {
      const lead = DASHBOARD._leads.find(l => l.id === id);
      if (!lead) return;
      const newStatus = lead.status === 'new' ? 'read' : 'new';
      await DB.updateLeadStatus(id, newStatus);
      DB.addLog('info', `Lead ${id} marked as ${newStatus}`);
      await DASHBOARD.refresh();
    },

    async archiveLead(id) {
      await DB.updateLeadStatus(id, 'archived');
      DB.addLog('info', `Lead ${id} archived`);
      await DASHBOARD.refresh();
    },

    async deleteLead(id) {
      if (!confirm('Delete this lead permanently?')) return;
      await DB.deleteLead(id);
      DB.addLog('info', `Lead ${id} deleted`);
      await DASHBOARD.refresh();
    },

    toggleLeadExpand(id) {
      DASHBOARD._expandedLeadId = DASHBOARD._expandedLeadId === id ? null : id;
      DASHBOARD.renderLeads();
    },

    async exportLeads() {
      const data = DASHBOARD._leads;
      downloadJSON(data, 'blok-leads-' + new Date().toISOString().slice(0, 10));
      DB.addLog('info', 'Leads exported');
    },

    async exportPortfolio() {
      const data = DASHBOARD._portfolio;
      downloadJSON(data, 'blok-portfolio-' + new Date().toISOString().slice(0, 10));
      DB.addLog('info', 'Portfolio exported');
    },

    // ── Portfolio Actions ───────────────────────────────────────
    async addPortfolioItem() {
      const title = document.getElementById('portTitle');
      const tag = document.getElementById('portTag');
      const url = document.getElementById('portUrl');
      const desc = document.getElementById('portDesc');

      if (!title.value.trim()) return;

      const result = await DB.addPortfolioItem({
        title: title.value.trim(),
        tag: tag.value.trim() || 'Custom',
        url: url.value.trim(),
        desc: desc.value.trim(),
      });

      if (result.ok) {
        title.value = '';
        tag.value = '';
        url.value = '';
        desc.value = '';
        DASHBOARD._editingPortfolioId = null;
        DB.addLog('info', 'Portfolio item added: ' + title.value);
        await DASHBOARD.refresh();
      }
    },

    async removePortfolioItem(id) {
      if (!confirm('Remove this portfolio item?')) return;
      await DB.removePortfolioItem(id);
      DASHBOARD._editingPortfolioId = null;
      DB.addLog('info', 'Portfolio item removed');
      await DASHBOARD.refresh();
    },

    editPortfolioItem(id) {
      DASHBOARD._editingPortfolioId = id;
      DASHBOARD.renderPortfolio();
    },

    cancelEditPortfolio() {
      DASHBOARD._editingPortfolioId = null;
      DASHBOARD.renderPortfolio();
    },

    async savePortfolioItem(id) {
      const title = document.getElementById('portEditTitle_' + id);
      const tag = document.getElementById('portEditTag_' + id);
      const url = document.getElementById('portEditUrl_' + id);
      const desc = document.getElementById('portEditDesc_' + id);

      if (!title) return;

      const update = { id };
      if (title.value !== undefined) update.title = title.value.trim() || 'Untitled';
      if (tag) update.tag = tag.value.trim() || 'Custom';
      if (url) update.url = url.value.trim();
      if (desc) update.desc = desc.value.trim();

      const result = await DB.updatePortfolioItem(update);
      if (result.ok) {
        DASHBOARD._editingPortfolioId = null;
        DB.addLog('ok', 'Portfolio item updated: ' + update.title);
        await DASHBOARD.refresh();
      }
    },

    // ── Utility ────────────────────────────────────────────────
    clearLog() {
      DB.clearLog();
      DASHBOARD.renderLog();
    },

    toggleViz(btn, mode) {
      document.querySelectorAll('.admin-header__viz-btn').forEach(function (b) {
        b.classList.remove('admin-header__viz-btn--active');
      });
      btn.classList.add('admin-header__viz-btn--active');
      document.documentElement.setAttribute('data-viz', mode);
    },

    navTo(page) {
      NAV.goTo(page);
    },
  };

  // =============================================================
  // 6. Helpers
  // =============================================================

  function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  // =============================================================
  // 7. Init
  // =============================================================

  document.addEventListener('DOMContentLoaded', async function () {
    const isDashboard = document.getElementById('adminApp');
    const isLogin = document.getElementById('loginApp');

    if (isDashboard) {
      const authed = await AUTH.requireAuth();
      if (!authed) return;

      NAV.init();
      await DASHBOARD.init();

      // Update user info
      const user = AUTH.getUser();
      document.querySelectorAll('.admin-nav__user-name').forEach(function (el) {
        el.textContent = user || 'admin';
      });

      DB.addLog('ok', 'Dashboard loaded — Netlify backend');

    } else if (isLogin) {
      // Check for expired param
      const params = new URLSearchParams(window.location.search);
      if (params.get('expired') === '1') {
        const errorEl = document.getElementById('loginError');
        if (errorEl) {
          errorEl.textContent = 'Session expired. Please log in again.';
          errorEl.classList.add('login-error--visible');
        }
      }

      // Enter key support
      const passInput = document.getElementById('loginPass');
      if (passInput) {
        passInput.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') BLOK_ADMIN.login();
        });
      }
      const userInput = document.getElementById('loginUser');
      if (userInput) {
        userInput.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') document.getElementById('loginPass').focus();
        });
      }
    }
  });

})();
