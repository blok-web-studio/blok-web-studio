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

    async updateLeadNotes(id, notes) {
      return await API.patch('/leads', { id, notes });
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
          <div class="card__footer">Response SLA: 1–4h</div>
        </div>


      `;
    },

    // ── Leads table ────────────────────────────────────────────
    _expandedLeadId: null,
    _leadSearch: '',
    _leadFilter: 'all',
    _leadSort: { field: 'createdAt', dir: 'desc' },
    _selectedLeads: new Set(),
    _currentLeadPage: 1,
    _leadsPerPage: 15,

    renderLeads() {
      const fullContainer = document.getElementById('leadsContainer');
      const previewContainer = document.getElementById('leadsPreviewContainer');

      if (!fullContainer && !previewContainer) return;

      const leads = this._leads;
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

      // ── Preview table (dashboard) — minimal ─────────────────
      if (previewContainer) {
        let previewHtml = `
          <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Name</th>
                <th>Company</th>
                <th>Budget</th>
                <th>Received</th>
              </tr>
            </thead>
            <tbody>
        `;
        leads.slice(0, 5).forEach(function (lead) {
          const statusClass = 'status-badge--' + lead.status;
          const statusLabel = lead.status.charAt(0).toUpperCase() + lead.status.slice(1);
          const date = new Date(lead.createdAt);
          const dateStr = date.toLocaleDateString();
          const comp = lead.company || '-';
          previewHtml += `
            <tr>
              <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
              <td><strong>${esc(lead.name)}</strong></td>
              <td class="text-muted text-sm">${esc(comp)}</td>
              <td><span class="tag tag--steel">${esc(lead.budget)}</span></td>
              <td class="text-muted text-sm">${dateStr}</td>
            </tr>
          `;
        }.bind(this));
        previewHtml += '</tbody></table></div>';
        previewContainer.innerHTML = previewHtml;
      }

      if (!fullContainer) return;

      // ── Split archived from active leads ───────────────────
      var activeLeads = leads.filter(function (l) { return l.status !== 'archived'; });
      var archivedLeads = leads.filter(function (l) { return l.status === 'archived'; });

      // ── Filter + Search + Sort (on active leads only) ─────
      var filtered = activeLeads.filter(function (lead) {
        if (this._leadFilter !== 'all' && lead.status !== this._leadFilter) return false;
        if (this._leadSearch) {
          var q = this._leadSearch.toLowerCase();
          var matchable = (lead.name + ' ' + lead.email + ' ' + (lead.company || '') + ' ' + (lead.message || '') + ' ' + (lead.phone || '')).toLowerCase();
          if (matchable.indexOf(q) === -1) return false;
        }
        return true;
      }.bind(this));

      // Sort
      var sortField = this._leadSort.field;
      var sortDir = this._leadSort.dir;
      filtered.sort(function (a, b) {
        var aVal, bVal;
        if (sortField === 'createdAt') {
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
        } else if (sortField === 'budget') {
          aVal = a.budget || '';
          bVal = b.budget || '';
        } else if (sortField === 'name') {
          aVal = (a.name || '').toLowerCase();
          bVal = (b.name || '').toLowerCase();
        } else {
          aVal = (a[sortField] || '').toLowerCase();
          bVal = (b[sortField] || '').toLowerCase();
        }
        if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });

      // Paginate
      var totalPages = Math.ceil(filtered.length / this._leadsPerPage) || 1;
      if (this._currentLeadPage > totalPages) this._currentLeadPage = totalPages;
      var pageLeads = filtered.slice((this._currentLeadPage - 1) * this._leadsPerPage, this._currentLeadPage * this._leadsPerPage);

      // ── Build filter bar ───────────────────────────────────
      var sortArrow = function (field) {
        if (this._leadSort.field !== field) return '';
        return this._leadSort.dir === 'asc' ? ' ↑' : ' ↓';
      }.bind(this);

      var statusCounts = { all: activeLeads.length };
      activeLeads.forEach(function (l) {
        statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
      });

      var filterHtml = `
        <div class="lead-toolbar">
          <div class="lead-toolbar__left">
            <div class="lead-search">
              <i class="ph ph-magnifying-glass"></i>
              <input type="text" class="lead-search__input" id="leadSearchInput" placeholder="Search name, email, company…" value="${esc(this._leadSearch)}">
            </div>
            <div class="lead-filter-group">
              <button class="lead-filter-btn ${this._leadFilter === 'all' ? 'lead-filter-btn--active' : ''}" data-filter="all">All <span class="lead-filter-count">${statusCounts.all || 0}</span></button>
              <button class="lead-filter-btn ${this._leadFilter === 'new' ? 'lead-filter-btn--active' : ''}" data-filter="new">New <span class="lead-filter-count">${statusCounts.new || 0}</span></button>
              <button class="lead-filter-btn ${this._leadFilter === 'read' ? 'lead-filter-btn--active' : ''}" data-filter="read">Read <span class="lead-filter-count">${statusCounts.read || 0}</span></button>
              <button class="lead-filter-btn ${this._leadFilter === 'contacted' ? 'lead-filter-btn--active' : ''}" data-filter="contacted">Contacted <span class="lead-filter-count">${statusCounts.contacted || 0}</span></button>
              <button class="lead-filter-btn ${this._leadFilter === 'won' ? 'lead-filter-btn--active' : ''}" data-filter="won">Won <span class="lead-filter-count">${statusCounts.won || 0}</span></button>
              <button class="lead-filter-btn ${this._leadFilter === 'lost' ? 'lead-filter-btn--active' : ''}" data-filter="lost">Lost <span class="lead-filter-count">${statusCounts.lost || 0}</span></button>
            </div>
          </div>
          <div class="lead-toolbar__right">
            <span class="lead-toolbar__count">${filtered.length} of ${activeLeads.length} active</span>
            <button class="admin-btn admin-btn--small" onclick="BLOK_ADMIN.exportLeads()" title="Export JSON"><i class="ph ph-download-simple"></i></button>
            <button class="admin-btn admin-btn--small" onclick="BLOK_ADMIN.exportLeadsCSV()" title="Export CSV"><i class="ph ph-file-csv"></i></button>
          </div>
        </div>
      `;

      // ── Bulk actions bar ────────────────────────────────────
      var bulkBarHtml = '';
      if (this._selectedLeads.size > 0) {
        bulkBarHtml = `
          <div class="lead-bulk-bar">
            <span class="lead-bulk-bar__count">${this._selectedLeads.size} selected</span>
            <button class="admin-btn admin-btn--small" onclick="BLOK_ADMIN.bulkUpdateStatus('read')"><i class="ph ph-envelope-open"></i> Mark Read</button>
            <button class="admin-btn admin-btn--small" onclick="BLOK_ADMIN.bulkUpdateStatus('archived')"><i class="ph ph-archive"></i> Archive</button>
            <button class="admin-btn admin-btn--small btn--danger" onclick="BLOK_ADMIN.bulkDelete()"><i class="ph ph-trash"></i> Delete</button>
            <button class="admin-btn admin-btn--small" onclick="BLOK_ADMIN.clearSelection()"><i class="ph ph-x"></i> Clear</button>
          </div>
        `;
      }

      // ── Full leads table ────────────────────────────────────
      var html = filterHtml + bulkBarHtml + '<div class="admin-table-wrap"><table class="admin-table lead-table"><thead><tr>';

      // Header with sortable columns
      var cols = [
        { key: 'sel', label: '' },
        { key: 'status', label: 'Status' },
        { key: 'name', label: 'Name', sortable: true },
        { key: 'company', label: 'Company' },
        { key: 'email', label: 'Email' },
        { key: 'budget', label: 'Budget', sortable: true },
        { key: 'services', label: 'Services' },
        { key: 'message', label: 'Message' },
        { key: 'createdAt', label: 'Received', sortable: true },
        { key: 'actions', label: 'Actions' },
      ];

      cols.forEach(function (col) {
        if (col.sortable) {
          html += '<th class="lead-table__sortable" onclick="BLOK_ADMIN.toggleSort(\'' + col.key + '\')">' + col.label + sortArrow(col.key) + '</th>';
        } else {
          html += '<th>' + col.label + '</th>';
        }
      });

      html += '</tr></thead><tbody>';

      if (pageLeads.length === 0) {
        html += '<tr><td colspan="10"><div class="admin-table__empty"><i class="ph ph-funnel"></i><p>No leads match your filter.</p></div></td></tr>';
      }

      pageLeads.forEach(function (lead) {
        var isExpanded = this._expandedLeadId === lead.id;
        var isSelected = this._selectedLeads.has(lead.id);
        var statusClass = 'status-badge--' + lead.status;
        var statusLabel = lead.status.charAt(0).toUpperCase() + lead.status.slice(1);
        var date = new Date(lead.createdAt);
        var dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        var messagePreview = lead.message && lead.message.length > 60 ? lead.message.slice(0, 60) + '…' : (lead.message || '');

        // Format budget for display
        var budgetDisplay = (lead.budget || '').replace(/-/g, ' — ').replace(/^under\s/i, 'Under ');

        // Format services
        var servicesList = Array.isArray(lead.services) ? lead.services.join(', ') : lead.services || '';
        servicesList = servicesList.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });

        html += '<tr class="lead-row ' + (isExpanded ? 'lead-row--expanded' : '') + (isSelected ? ' lead-row--selected' : '') + '" tabindex="0">';

        // Checkbox
        html += '<td onclick="event.stopPropagation()"><input type="checkbox" class="lead-checkbox" ' + (isSelected ? 'checked' : '') + ' onchange="BLOK_ADMIN.toggleSelectLead(\'' + lead.id + '\')"></td>';

        // Status
        html += '<td><span class="status-badge ' + statusClass + '">' + statusLabel + '</span></td>';

        // Name (clickable to expand)
        html += '<td onclick="BLOK_ADMIN.toggleLeadExpand(\'' + lead.id + '\')"><strong>' + esc(lead.name) + '</strong></td>';

        // Company
        html += '<td class="text-muted text-sm">' + esc(lead.company || '-') + '</td>';

        // Email
        html += '<td onclick="event.stopPropagation()"><a href="mailto:' + esc(lead.email) + '">' + esc(lead.email) + '</a></td>';

        // Budget
        html += '<td><span class="tag tag--steel">' + esc(budgetDisplay) + '</span></td>';

        // Services
        html += '<td class="text-muted text-sm">' + esc(servicesList || '-') + '</td>';

        // Message preview
        html += '<td class="text-muted text-sm" title="' + esc(lead.message || '') + '" onclick="BLOK_ADMIN.toggleLeadExpand(\'' + lead.id + '\')">' + esc(messagePreview) + '</td>';

        // Date
        html += '<td class="text-muted text-sm">' + dateStr + '</td>';

        // Actions
        html += '<td onclick="event.stopPropagation()"><div class="lead-actions">';
        html += '<button class="admin-btn admin-btn--small" onclick="BLOK_ADMIN.toggleLeadExpand(\'' + lead.id + '\')" title="View details"><i class="ph ph-eye"></i></button>';
        html += '<button class="admin-btn admin-btn--small" onclick="BLOK_ADMIN.updateLeadStatus(\'' + lead.id + '\', \'read\')" title="Mark read"><i class="ph ph-envelope-open"></i></button>';
        html += '<button class="admin-btn admin-btn--small" onclick="BLOK_ADMIN.archiveLead(\'' + lead.id + '\')" title="Archive"><i class="ph ph-archive"></i></button>';
        html += '<button class="admin-btn admin-btn--small btn--danger" onclick="BLOK_ADMIN.deleteLead(\'' + lead.id + '\')" title="Delete"><i class="ph ph-trash"></i></button>';
        html += '</div></td>';

        html += '</tr>';

        // ── Expanded detail row ──────────────────────────────
        if (isExpanded) {
          html += '<tr class="lead-detail-row"><td colspan="10"><div class="lead-detail">';

          // Info grid
          html += '<div class="lead-detail__grid">';
          html += '<div class="lead-detail__field"><span class="lead-detail__label"><i class="ph ph-user"></i> Name</span><span class="lead-detail__value">' + esc(lead.name) + '</span></div>';
          html += '<div class="lead-detail__field"><span class="lead-detail__label"><i class="ph ph-building"></i> Company</span><span class="lead-detail__value">' + esc(lead.company || '-') + '</span></div>';
          html += '<div class="lead-detail__field"><span class="lead-detail__label"><i class="ph ph-envelope"></i> Email</span><span class="lead-detail__value"><a href="mailto:' + esc(lead.email) + '">' + esc(lead.email) + '</a></span></div>';
          html += '<div class="lead-detail__field"><span class="lead-detail__label"><i class="ph ph-phone"></i> Phone</span><span class="lead-detail__value">' + esc(lead.phone || '-') + '</span></div>';
          html += '<div class="lead-detail__field"><span class="lead-detail__label"><i class="ph ph-currency-dollar"></i> Budget</span><span class="lead-detail__value"><span class="tag tag--steel">' + esc(budgetDisplay) + '</span></span></div>';
          html += '<div class="lead-detail__field"><span class="lead-detail__label"><i class="ph ph-clock"></i> Timeline</span><span class="lead-detail__value">' + esc((lead.timeline || '').replace(/-/g, ' ') || 'Not specified') + '</span></div>';
          html += '<div class="lead-detail__field"><span class="lead-detail__label"><i class="ph ph-wrench"></i> Services</span><span class="lead-detail__value">' + esc(servicesList || 'Not specified') + '</span></div>';
          html += '<div class="lead-detail__field"><span class="lead-detail__label"><i class="ph ph-calendar"></i> Received</span><span class="lead-detail__value">' + dateStr + '</span></div>';
          html += '</div>';

          // Status workflow
          var statuses = ['new', 'read', 'contacted', 'qualified', 'won', 'lost', 'archived'];
          html += '<div class="lead-detail__status-flow">';
          statuses.forEach(function (s) {
            var active = lead.status === s ? 'lead-status-flow__step--active' : '';
            var label = s.charAt(0).toUpperCase() + s.slice(1);
            html += '<button class="lead-status-flow__step ' + active + '" onclick="BLOK_ADMIN.updateLeadStatus(\'' + lead.id + '\', \'' + s + '\')">' + label + '</button>';
          });
          html += '</div>';

          // Message
          html += '<div class="lead-detail__message"><span class="lead-detail__label"><i class="ph ph-chat-text"></i> Full Message</span><div class="lead-detail__message-body">' + esc(lead.message || '(no message)') + '</div></div>';

          // Internal notes
          var notesId = 'leadNotes_' + lead.id;
          html += '<div class="lead-detail__notes">';
          html += '<span class="lead-detail__label"><i class="ph ph-notepad"></i> Internal Notes</span>';
          html += '<textarea class="lead-notes__textarea" id="' + notesId + '" placeholder="Add private notes about this lead…" rows="3">' + esc(lead.notes || '') + '</textarea>';
          html += '<button class="admin-btn admin-btn--small" onclick="BLOK_ADMIN.saveLeadNotes(\'' + lead.id + '\')" style="margin-top:8px"><i class="ph ph-floppy-disk"></i> Save Notes</button>';
          html += '</div>';

          html += '</div></td></tr>';
        }
      }.bind(this));

      html += '</tbody></table></div>';

      // ── Pagination ──────────────────────────────────────────
      if (totalPages > 1) {
        html += '<div class="lead-pagination"><div class="lead-pagination__inner">';
        html += '<button class="admin-btn admin-btn--small" onclick="BLOK_ADMIN.goToLeadPage(1)" ' + (this._currentLeadPage <= 1 ? 'disabled' : '') + '><i class="ph ph-caret-double-left"></i></button>';
        html += '<button class="admin-btn admin-btn--small" onclick="BLOK_ADMIN.goToLeadPage(' + (this._currentLeadPage - 1) + ')" ' + (this._currentLeadPage <= 1 ? 'disabled' : '') + '><i class="ph ph-caret-left"></i></button>';
        html += '<span class="lead-pagination__info">Page ' + this._currentLeadPage + ' of ' + totalPages + '</span>';
        html += '<button class="admin-btn admin-btn--small" onclick="BLOK_ADMIN.goToLeadPage(' + (this._currentLeadPage + 1) + ')" ' + (this._currentLeadPage >= totalPages ? 'disabled' : '') + '><i class="ph ph-caret-right"></i></button>';
        html += '<button class="admin-btn admin-btn--small" onclick="BLOK_ADMIN.goToLeadPage(' + totalPages + ')" ' + (this._currentLeadPage >= totalPages ? 'disabled' : '') + '><i class="ph ph-caret-double-right"></i></button>';
        html += '</div></div>';
      }

      // ── Footer ─────────────────────────────────────────────
      html += '<div class="card__footer" style="display:flex;justify-content:space-between;align-items:center;"><span>' + filtered.length + ' of ' + activeLeads.length + ' active lead' + (activeLeads.length !== 1 ? 's' : '') + '</span></div>';

      // ── Archived Leads Collapse ────────────────────────────
      if (archivedLeads.length > 0) {
        html += '<div class="archived-collapse" id="archivedCollapse">';
        html += '<button class="archived-collapse__toggle" onclick="BLOK_ADMIN.toggleArchived()"><span><i class="ph ph-archive"></i> Archived (' + archivedLeads.length + ')</span><span class="archived-collapse__toggle-icon"><i class="ph ph-caret-down"></i></span></button>';
        html += '<div class="archived-collapse__body"><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Status</th><th>Name</th><th>Company</th><th>Email</th><th>Budget</th><th>Received</th><th>Actions</th></tr></thead><tbody>';
        archivedLeads.forEach(function (lead) {
          var statusClass = 'status-badge--' + lead.status;
          var statusLabel = lead.status.charAt(0).toUpperCase() + lead.status.slice(1);
          var date = new Date(lead.createdAt);
          var dateStr = date.toLocaleDateString();
          html += '<tr><td><span class="status-badge ' + statusClass + '">' + statusLabel + '</span></td>';
          html += '<td><strong>' + esc(lead.name) + '</strong></td>';
          html += '<td class="text-muted text-sm">' + esc(lead.company || '-') + '</td>';
          html += '<td class="text-muted text-sm">' + esc(lead.email) + '</td>';
          html += '<td><span class="tag tag--steel">' + esc((lead.budget || '').replace(/-/g, ' — ')) + '</span></td>';
          html += '<td class="text-muted text-sm">' + dateStr + '</td>';
          html += '<td><div class="lead-actions">';
          html += '<button class="admin-btn admin-btn--small" onclick="BLOK_ADMIN.updateLeadStatus(\'' + lead.id + '\', \'read\')" title="Unarchive"><i class="ph ph-archive"></i></button>';
          html += '<button class="admin-btn admin-btn--small btn--danger" onclick="BLOK_ADMIN.deleteLead(\'' + lead.id + '\')" title="Delete"><i class="ph ph-trash"></i></button>';
          html += '</div></td></tr>';
        }.bind(this));
        html += '</tbody></table></div></div></div>';
      }

      fullContainer.innerHTML = html;

      // ── Bind search handler ─────────────────────────────────
      var searchInput = document.getElementById('leadSearchInput');
      if (searchInput && !searchInput._bound) {
        searchInput._bound = true;
        searchInput.addEventListener('input', function () {
          DASHBOARD._leadSearch = searchInput.value;
          DASHBOARD._currentLeadPage = 1;
          DASHBOARD.renderLeads();
        });
      }

      // ── Bind filter buttons ─────────────────────────────────
      document.querySelectorAll('.lead-filter-btn').forEach(function (btn) {
        if (!btn._bound) {
          btn._bound = true;
          btn.addEventListener('click', function () {
            DASHBOARD._leadFilter = btn.getAttribute('data-filter');
            DASHBOARD._currentLeadPage = 1;
            DASHBOARD.renderLeads();
          });
        }
      });
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
                ? `<iframe class="portfolio-card__iframe" src="${esc(item.url)}${item.url.includes('?') ? '&' : '?'}embed=1" sandbox="allow-scripts allow-same-origin" loading="lazy" title="Preview of ${esc(item.title)}"></iframe>`
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
                ? `<iframe class="portfolio-card__iframe" src="${esc(item.url)}${item.url.includes('?') ? '&' : '?'}embed=1" sandbox="allow-scripts allow-same-origin" loading="lazy" title="Preview of ${esc(item.title)}"></iframe>`
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
      DB.addLog('info', 'Lead ' + lead.name + ' marked as ' + newStatus);
      await DASHBOARD.refresh();
    },

    async updateLeadStatus(id, status) {
      const lead = DASHBOARD._leads.find(l => l.id === id);
      if (!lead) return;
      await DB.updateLeadStatus(id, status);
      DB.addLog('info', 'Lead ' + lead.name + ' → ' + status);
      await DASHBOARD.refresh();
    },

    async archiveLead(id) {
      await DB.updateLeadStatus(id, 'archived');
      DB.addLog('info', 'Lead archived');
      await DASHBOARD.refresh();
    },

    async deleteLead(id) {
      if (!confirm('Delete this lead permanently?')) return;
      await DB.deleteLead(id);
      DB.addLog('info', 'Lead deleted');
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

    async exportLeadsCSV() {
      const data = DASHBOARD._leads;
      if (!data.length) return;
      var headers = ['Name', 'Email', 'Company', 'Phone', 'Budget', 'Timeline', 'Services', 'Message', 'Status', 'Date', 'Notes'];
      var rows = data.map(function (l) {
        var services = Array.isArray(l.services) ? l.services.join('; ') : (l.services || '');
        return [
          l.name || '', l.email || '', l.company || '', l.phone || '',
          l.budget || '', l.timeline || '', services, l.message || '',
          l.status || '', l.createdAt || '', l.notes || ''
        ].map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
      });
      var csv = headers.join(',') + '\n' + rows.join('\n');
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'blok-leads-' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
      URL.revokeObjectURL(url);
      DB.addLog('info', 'Leads exported as CSV');
    },

    async saveLeadNotes(id) {
      var notesEl = document.getElementById('leadNotes_' + id);
      if (!notesEl) return;
      var notes = notesEl.value;
      await DB.updateLeadNotes(id, notes);
      DB.addLog('info', 'Notes saved for lead ' + id);
      // Flash feedback
      notesEl.style.borderColor = 'var(--green)';
      setTimeout(function () { notesEl.style.borderColor = ''; }, 1500);
    },

    // ── Search / Filter / Sort ──────────────────────────────────
    toggleSort(field) {
      if (DASHBOARD._leadSort.field === field) {
        DASHBOARD._leadSort.dir = DASHBOARD._leadSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        DASHBOARD._leadSort.field = field;
        DASHBOARD._leadSort.dir = 'desc';
      }
      DASHBOARD._currentLeadPage = 1;
      DASHBOARD.renderLeads();
    },

    // ── Bulk Actions ────────────────────────────────────────────
    toggleSelectLead(id) {
      if (DASHBOARD._selectedLeads.has(id)) {
        DASHBOARD._selectedLeads.delete(id);
      } else {
        DASHBOARD._selectedLeads.add(id);
      }
      DASHBOARD.renderLeads();
    },

    clearSelection() {
      DASHBOARD._selectedLeads.clear();
      DASHBOARD.renderLeads();
    },

    async bulkUpdateStatus(status) {
      var ids = Array.from(DASHBOARD._selectedLeads);
      if (!ids.length) return;
      var count = ids.length;
      for (var i = 0; i < ids.length; i++) {
        await DB.updateLeadStatus(ids[i], status);
      }
      DB.addLog('info', count + ' leads marked as ' + status);
      DASHBOARD._selectedLeads.clear();
      await DASHBOARD.refresh();
    },

    async bulkDelete() {
      var ids = Array.from(DASHBOARD._selectedLeads);
      if (!ids.length) return;
      if (!confirm('Delete ' + ids.length + ' leads permanently?')) return;
      for (var i = 0; i < ids.length; i++) {
        await DB.deleteLead(ids[i]);
      }
      DB.addLog('info', ids.length + ' leads deleted');
      DASHBOARD._selectedLeads.clear();
      await DASHBOARD.refresh();
    },

    // ── Pagination ──────────────────────────────────────────────
    goToLeadPage(page) {
      DASHBOARD._currentLeadPage = page;
      DASHBOARD.renderLeads();
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

    // ── Archived Toggle ─────────────────────────────────────────
    _archivedOpen: false,

    toggleArchived() {
      this._archivedOpen = !this._archivedOpen;
      var el = document.getElementById('archivedCollapse');
      if (el) el.classList.toggle('archived-collapse--open', this._archivedOpen);
    },

    // ── User Menu ────────────────────────────────────────────────
    toggleUserMenu() {
      var el = document.getElementById('headerUserMenu');
      if (el) el.classList.toggle('admin-header__user--open');
    },

    closeUserMenu() {
      var el = document.getElementById('headerUserMenu');
      if (el) el.classList.remove('admin-header__user--open');
    },

    openUserManager() {
      this.closeUserMenu();
      var overlay = document.getElementById('userManagerModal');
      if (overlay) overlay.classList.add('admin-modal-overlay--open');
      this.renderUserManager();
    },

    closeUserManager() {
      var overlay = document.getElementById('userManagerModal');
      if (overlay) overlay.classList.remove('admin-modal-overlay--open');
    },

    renderUserManager() {
      var container = document.getElementById('userManagerContent');
      if (!container) return;
      var users = this._getUsers();
      var html = '<div style="margin-bottom:16px;">';
      html += '<p style="font-size:0.8rem;color:var(--muted);margin-bottom:12px;">Manage who has access to this dashboard. Credentials are stored in <code>admin/credentials.json</code>.</p>';
      html += '<table class="admin-table"><thead><tr><th>Username</th><th>Role</th><th>Actions</th></tr></thead><tbody>';
      users.forEach(function (u) {
        html += '<tr><td><strong>' + esc(u.username) + '</strong></td><td><span class="tag tag--steel">' + esc(u.role || 'admin') + '</span></td>';
        html += '<td><button class="admin-btn admin-btn--small btn--danger" onclick="BLOK_ADMIN.deleteUser(\'' + esc(u.username) + '\')" ' + (users.length <= 1 ? 'disabled' : '') + '><i class="ph ph-trash"></i></button></td></tr>';
      });
      html += '</tbody></table></div>';
      html += '<div style="border-top:1px solid var(--border);padding-top:16px;">';
      html += '<label class="admin-label">Add User</label>';
      html += '<div style="display:flex;gap:8px;align-items:end;">';
      html += '<div style="flex:1;"><input type="text" class="admin-input" id="newUserName" placeholder="Username"></div>';
      html += '<div style="flex:1;"><input type="password" class="admin-input" id="newUserPass" placeholder="Password"></div>';
      html += '<button class="admin-btn admin-btn--primary admin-btn--small" onclick="BLOK_ADMIN.addUser()"><i class="ph ph-plus"></i> Add</button>';
      html += '</div></div>';
      container.innerHTML = html;
    },

    _getUsers() {
      try {
        return JSON.parse(sessionStorage.getItem('blok_admin_users')) || [{ username: 'admin', role: 'admin' }];
      } catch { return [{ username: 'admin', role: 'admin' }]; }
    },

    _saveUsers(users) {
      sessionStorage.setItem('blok_admin_users', JSON.stringify(users));
    },

    addUser() {
      var nameInput = document.getElementById('newUserName');
      var passInput = document.getElementById('newUserPass');
      if (!nameInput || !passInput) return;
      var username = nameInput.value.trim();
      var password = passInput.value;
      if (!username || !password) { alert('Both fields required.'); return; }
      var users = this._getUsers();
      if (users.find(function (u) { return u.username === username; })) { alert('User already exists.'); return; }
      users.push({ username: username, role: 'admin', password: password });
      this._saveUsers(users);
      nameInput.value = '';
      passInput.value = '';
      this.renderUserManager();
    },

    deleteUser(username) {
      if (username === 'admin') { alert('Cannot delete the default admin.'); return; }
      if (!confirm('Delete user "' + username + '"?')) return;
      var users = this._getUsers().filter(function (u) { return u.username !== username; });
      this._saveUsers(users);
      this.renderUserManager();
    },

    // ── Utility ────────────────────────────────────────────────
    clearLog() {
      DB.clearLog();
      DASHBOARD.renderLog();
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

      // Render header user area (moved from nav footer)
      const user = AUTH.getUser() || 'admin';
      const headerActions = document.getElementById('headerUserArea');
      if (headerActions) {
        headerActions.innerHTML = `
          <div class="admin-header__user" id="headerUserMenu">
            <div class="admin-header__user-avatar">${user.charAt(0).toUpperCase()}</div>
            <span class="admin-header__user-name">${esc(user)}</span>
            <span class="admin-header__user-chevron"><i class="ph ph-caret-down"></i></span>
            <div class="admin-header__user-dropdown">
              <button class="admin-header__user-dropdown-item" onclick="BLOK_ADMIN.openUserManager()">
                <i class="ph ph-users"></i> Manage Users
              </button>
              <div class="admin-header__user-dropdown-divider"></div>
              <button class="admin-header__user-dropdown-item admin-header__user-dropdown-item--danger" onclick="BLOK_ADMIN.logout()">
                <i class="ph ph-sign-out"></i> Disconnect
              </button>
            </div>
          </div>
        `;
        // Toggle dropdown on click
        document.getElementById('headerUserMenu').addEventListener('click', function (e) {
          e.stopPropagation();
          BLOK_ADMIN.toggleUserMenu();
        });
        // Close on outside click
        document.addEventListener('click', function () {
          BLOK_ADMIN.closeUserMenu();
        });
      }

      // Inject user management modal
      var modal = document.createElement('div');
      modal.className = 'admin-modal-overlay';
      modal.id = 'userManagerModal';
      modal.innerHTML = '<div class="admin-modal">' +
        '<button class="admin-modal__close" onclick="BLOK_ADMIN.closeUserManager()"><i class="ph ph-x"></i></button>' +
        '<div class="admin-modal__title"><i class="ph ph-users" style="margin-right:8px;color:var(--steel);"></i>Manage Users &amp; Permissions</div>' +
        '<div id="userManagerContent"></div>' +
        '</div>';
      document.body.appendChild(modal);
      // Close on overlay click
      modal.addEventListener('click', function (e) {
        if (e.target === modal) BLOK_ADMIN.closeUserManager();
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
