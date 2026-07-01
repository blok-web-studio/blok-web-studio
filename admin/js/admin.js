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
      this._showLoading();
      const [leads, portfolio] = await Promise.all([DB.getLeads(), DB.getPortfolio()]);
      this._leads = leads;
      this._portfolio = portfolio;
      this.renderAll();
    },

    async refresh() {
      this._showLoading();
      const [leads, portfolio] = await Promise.all([DB.getLeads(), DB.getPortfolio()]);
      this._leads = leads;
      this._portfolio = portfolio;
      this.renderAll();
    },

    _showLoading() {
      var containers = ['kpiGrid', 'leadsContainer', 'leadsPreviewContainer', 'portfolioContainer', 'portfolioPreviewContainer', 'inspectorContainer', 'logContainer', 'quickActionsContainer', 'userManagerContent'];
      containers.forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.children.length === 0) {
          el.innerHTML = '<div class="loading-state"><div class="loading-state__spinner"></div><div class="loading-state__text">Loading…</div></div>';
        }
      });
    },

    renderAll() {
      this.renderKPIs();
      this.renderLeads();
      this.renderPortfolio();
      this.renderInspector();
      this.renderLog();
      this.renderQuickActions();
      this.renderUserManager();
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
        </div>

        <div class="card card--kpi">
          <div class="card__body">
            <div class="card__value">${portfolio.length}</div>
            <div class="card__label">Portfolio Items</div>
          </div>
          <div class="card__meter"><div class="card__meter-fill card__meter-fill--steel" style="width: ${Math.min(100, portfolio.length * 20)}%"></div></div>
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
        </div>
      `;
    },

    // ── Leads master-detail ─────────────────────────────────────
    _activeLeadId: null,
    _leadSearch: '',
    _leadFilter: 'all',
    _leadSort: { field: 'createdAt', dir: 'desc' },
    _selectedLeads: new Set(),
    _currentLeadPage: 1,
    _leadsPerPage: 30,
    _archivedOpen: false,

    renderLeads() {
      const fullContainer = document.getElementById('leadsContainer');
      const previewContainer = document.getElementById('leadsPreviewContainer');

      if (!fullContainer && !previewContainer) return;

      const leads = this._leads;
      const activeLeads = leads.filter(function (l) { return l.status !== 'archived'; });
      const archivedLeads = leads.filter(function (l) { return l.status === 'archived'; });

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
            <thead><tr>
              <th>Status</th><th>Name</th><th>Company</th><th>Budget</th><th>Received</th>
            </tr></thead>
            <tbody>
        `;
        leads.slice(0, 5).forEach(function (lead) {
          const sc = 'status-badge--' + lead.status;
          const sl = lead.status.charAt(0).toUpperCase() + lead.status.slice(1);
          previewHtml += '<tr><td><span class="status-badge ' + sc + '">' + sl + '</span></td>'
            + '<td><strong>' + esc(lead.name) + '</strong></td>'
            + '<td class="text-muted text-sm">' + esc(lead.company || '-') + '</td>'
            + '<td><span class="tag tag--steel">' + esc(lead.budget) + '</span></td>'
            + '<td class="text-muted text-sm">' + new Date(lead.createdAt).toLocaleDateString() + '</td></tr>';
        }.bind(this));
        previewHtml += '</tbody></table></div>';
        previewContainer.innerHTML = previewHtml;
      }

      if (!fullContainer) return;

      // ── Filter + Search + Sort ─────────────────────────────
      var filtered = activeLeads.filter(function (lead) {
        if (this._leadFilter !== 'all' && lead.status !== this._leadFilter) return false;
        if (this._leadSearch) {
          var q = this._leadSearch.toLowerCase();
          var m = (lead.name + ' ' + lead.email + ' ' + (lead.company || '') + ' ' + (lead.message || '') + ' ' + (lead.phone || '')).toLowerCase();
          if (m.indexOf(q) === -1) return false;
        }
        return true;
      }.bind(this));

      // Sort
      var sf = this._leadSort.field, sd = this._leadSort.dir;
      filtered.sort(function (a, b) {
        var av, bv;
        if (sf === 'createdAt') { av = new Date(a.createdAt).getTime(); bv = new Date(b.createdAt).getTime(); }
        else if (sf === 'name') { av = (a.name || '').toLowerCase(); bv = (b.name || '').toLowerCase(); }
        else if (sf === 'budget') { av = a.budget || ''; bv = b.budget || ''; }
        else { av = (a[sf] || '').toLowerCase(); bv = (b[sf] || '').toLowerCase(); }
        if (av < bv) return sd === 'asc' ? -1 : 1;
        if (av > bv) return sd === 'asc' ? 1 : -1;
        return 0;
      });

      // Paginate
      var totalPages = Math.ceil(filtered.length / this._leadsPerPage) || 1;
      if (this._currentLeadPage > totalPages) this._currentLeadPage = totalPages;
      var pageLeads = filtered.slice((this._currentLeadPage - 1) * this._leadsPerPage, this._currentLeadPage * this._leadsPerPage);

      // Auto-select first lead if none selected or selected is not in view
      if (pageLeads.length > 0) {
        var stillInView = pageLeads.some(function (l) { return l.id === this._activeLeadId; }.bind(this));
        if (!stillInView) this._activeLeadId = pageLeads[0].id;
      } else {
        this._activeLeadId = null;
      }

      // Status counts
      var scounts = { all: activeLeads.length };
      activeLeads.forEach(function (l) { scounts[l.status] = (scounts[l.status] || 0) + 1; });

      var statusFilters = ['all', 'new', 'read', 'contacted', 'won', 'lost'];

      // Build HTML
      var html = '<div class="leads-list-panel">';

      // ── Toolbar (search + filters) ─────────────────────────
      html += '<div class="leads-list-panel__toolbar">';
      html += '<div class="leads-list-panel__search">';
      html += '<i class="ph ph-magnifying-glass"></i>';
      html += '<input type="text" id="leadSearchInput" placeholder="Search name, email, company…" value="' + esc(this._leadSearch) + '">';
      html += '</div>';
      html += '<div class="leads-list-panel__filters">';
      statusFilters.forEach(function (f) {
        var active = this._leadFilter === f ? ' leads-list-panel__filter-btn--active' : '';
        var label = f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1);
        html += '<button class="leads-list-panel__filter-btn' + active + '" data-filter="' + f + '">' + label + ' <span class="leads-list-panel__filter-count">' + (scounts[f] || 0) + '</span></button>';
      }.bind(this));
      html += '</div>';
      html += '</div>';

      // ── Bulk bar ───────────────────────────────────────────
      if (this._selectedLeads.size > 0) {
        html += '<div class="leads-bulk-bar">';
        html += '<span class="leads-bulk-bar__count">' + this._selectedLeads.size + ' selected</span>';
        html += '<button class="admin-btn" onclick="BLOK_ADMIN.bulkUpdateStatus(\'read\')"><i class="ph ph-envelope-open"></i> Read</button>';
        html += '<button class="admin-btn" onclick="BLOK_ADMIN.bulkUpdateStatus(\'archived\')"><i class="ph ph-archive"></i> Archive</button>';
        html += '<button class="admin-btn btn--danger" onclick="BLOK_ADMIN.bulkDelete()"><i class="ph ph-trash"></i> Delete</button>';
        html += '<button class="admin-btn" onclick="BLOK_ADMIN.clearSelection()"><i class="ph ph-x"></i> Clear</button>';
        html += '</div>';
      }

      // ── Card list ──────────────────────────────────────────
      html += '<div class="leads-list-panel__body">';

      if (pageLeads.length === 0) {
        html += '<div style="padding:40px 20px;text-align:center;color:var(--muted);font-family:var(--font-mono);font-size:0.65rem;"><i class="ph ph-funnel" style="font-size:1.5rem;display:block;margin-bottom:8px;opacity:0.3;"></i>No leads match your filter.</div>';
      }

      pageLeads.forEach(function (lead) {
        var isSelected = this._selectedLeads.has(lead.id);
        var isActive = this._activeLeadId === lead.id;
        var sc = 'status-badge--' + lead.status;
        var sl = lead.status.charAt(0).toUpperCase() + lead.status.slice(1);
        var date = new Date(lead.createdAt);
        var dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        var budgetDisplay = (lead.budget || '').replace(/-/g, ' — ').replace(/^under\s/i, 'Under ');
        var messagePreview = lead.message && lead.message.length > 80 ? lead.message.slice(0, 80) + '…' : (lead.message || '');

        html += '<div class="lead-card' + (isActive ? ' lead-card--selected' : '') + '" onclick="BLOK_ADMIN.selectLead(\'' + lead.id + '\')">';
        html += '<div class="lead-card__checkbox" onclick="event.stopPropagation()"><input type="checkbox" ' + (isSelected ? 'checked' : '') + ' onchange="BLOK_ADMIN.toggleSelectLead(\'' + lead.id + '\')"></div>';
        html += '<div class="lead-card__content">';
        html += '<div class="lead-card__header"><span class="lead-card__name">' + esc(lead.name) + '</span><span class="lead-card__status"><span class="status-badge ' + sc + '">' + sl + '</span></span></div>';
        html += '<div class="lead-card__company">' + esc(lead.company || '') + '</div>';
        html += '<div class="lead-card__meta">';
        html += '<span class="lead-card__budget">' + esc(budgetDisplay) + '</span>';
        html += '<span class="lead-card__date">' + dateStr + '</span>';
        html += '</div>';
        if (messagePreview) {
          html += '<div class="lead-card__preview">' + esc(messagePreview) + '</div>';
        }
        html += '</div></div>';
      }.bind(this));

      html += '</div>'; // list body

      // ── Footer (pagination + count) ────────────────────────
      html += '<div class="leads-list-panel__footer">';
      html += '<span>' + filtered.length + ' of ' + activeLeads.length + ' active</span>';
      if (totalPages > 1) {
        html += '<div style="display:flex;gap:4px;align-items:center;">';
        html += '<button class="admin-btn admin-btn--small" onclick="BLOK_ADMIN.goToLeadPage(' + (this._currentLeadPage - 1) + ')" ' + (this._currentLeadPage <= 1 ? 'disabled' : '') + '><i class="ph ph-caret-left"></i></button>';
        html += '<span>' + this._currentLeadPage + ' / ' + totalPages + '</span>';
        html += '<button class="admin-btn admin-btn--small" onclick="BLOK_ADMIN.goToLeadPage(' + (this._currentLeadPage + 1) + ')" ' + (this._currentLeadPage >= totalPages ? 'disabled' : '') + '><i class="ph ph-caret-right"></i></button>';
        html += '</div>';
      }
      html += '</div>';

      // ── Archived toggle ────────────────────────────────────
      if (archivedLeads.length > 0) {
        html += '<button class="leads-archived-toggle' + (this._archivedOpen ? ' leads-archived-toggle--open' : '') + '" onclick="BLOK_ADMIN.toggleArchived()">';
        html += '<span><i class="ph ph-archive"></i> Archived (' + archivedLeads.length + ')</span>';
        html += '<span class="leads-archived-toggle__icon"><i class="ph ph-caret-down"></i></span>';
        html += '</button>';
        if (this._archivedOpen) {
          html += '<div style="padding:6px;">';
          archivedLeads.forEach(function (lead) {
            var sc = 'status-badge--' + lead.status;
            var sl = lead.status.charAt(0).toUpperCase() + lead.status.slice(1);
            var ds = new Date(lead.createdAt).toLocaleDateString();
            html += '<div class="lead-card" style="cursor:pointer" onclick="BLOK_ADMIN.selectLead(\'' + lead.id + '\')">';
            html += '<div class="lead-card__content">';
            html += '<div class="lead-card__header"><span class="lead-card__name">' + esc(lead.name) + '</span><span class="lead-card__status"><span class="status-badge ' + sc + '">' + sl + '</span></span></div>';
            html += '<div class="lead-card__company">' + esc(lead.company || '') + '</div>';
            html += '<div class="lead-card__meta"><span class="lead-card__date">' + ds + '</span></div>';
            html += '</div></div>';
          }.bind(this));
          html += '</div>';
        }
      }

      html += '</div>'; // list panel

      // ── Detail Panel ───────────────────────────────────────
      html += '<div class="leads-detail-panel">';
      html += '<button class="leads-detail-panel__back" onclick="BLOK_ADMIN.closeDetailMobile()"><i class="ph ph-caret-left"></i> Back</button>';

      var activeLead = this._activeLeadId ? this._leads.find(function (l) { return l.id === this._activeLeadId; }.bind(this)) : null;

      if (!activeLead) {
        html += '<div class="leads-detail-panel__empty">';
        html += '<i class="ph ph-tray"></i>';
        html += '<p>Select a lead to view details</p>';
        html += '</div>';
      } else {
        var servicesList = Array.isArray(activeLead.services) ? activeLead.services.join(', ') : activeLead.services || '';
        servicesList = servicesList.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
        var budgetDisplay = (activeLead.budget || '').replace(/-/g, ' — ').replace(/^under\s/i, 'Under ');

        html += '<div class="leads-detail-panel__body">';

        // Header
        html += '<h3 style="font-family:var(--font-display);font-size:1.1rem;font-weight:600;margin-bottom:4px;">' + esc(activeLead.name) + '</h3>';
        html += '<p style="font-family:var(--font-mono);font-size:0.6rem;color:var(--muted);margin-bottom:16px;">' + esc(activeLead.email) + '</p>';

        // Status workflow
        var statuses = ['new', 'read', 'contacted', 'qualified', 'won', 'lost', 'archived'];
        html += '<div class="lead-detail__status-flow">';
        statuses.forEach(function (s) {
          var active = activeLead.status === s ? 'lead-status-flow__step--active' : '';
          var label = s.charAt(0).toUpperCase() + s.slice(1);
          html += '<button class="lead-status-flow__step ' + active + '" onclick="BLOK_ADMIN.updateLeadStatus(\'' + activeLead.id + '\', \'' + s + '\')">' + label + '</button>';
        });
        html += '</div>';

        // Info grid
        html += '<div class="lead-detail__grid">';
        html += '<div class="lead-detail__field"><span class="lead-detail__label"><i class="ph ph-user"></i> Name</span><span class="lead-detail__value">' + esc(activeLead.name) + '</span></div>';
        html += '<div class="lead-detail__field"><span class="lead-detail__label"><i class="ph ph-building"></i> Company</span><span class="lead-detail__value">' + esc(activeLead.company || '-') + '</span></div>';
        html += '<div class="lead-detail__field"><span class="lead-detail__label"><i class="ph ph-envelope"></i> Email</span><span class="lead-detail__value"><a href="mailto:' + esc(activeLead.email) + '">' + esc(activeLead.email) + '</a></span></div>';
        html += '<div class="lead-detail__field"><span class="lead-detail__label"><i class="ph ph-phone"></i> Phone</span><span class="lead-detail__value">' + esc(activeLead.phone || '-') + '</span></div>';
        html += '<div class="lead-detail__field"><span class="lead-detail__label"><i class="ph ph-currency-dollar"></i> Budget</span><span class="lead-detail__value"><span class="lead-card__budget">' + esc(budgetDisplay) + '</span></span></div>';
        html += '<div class="lead-detail__field"><span class="lead-detail__label"><i class="ph ph-clock"></i> Timeline</span><span class="lead-detail__value">' + esc((activeLead.timeline || '').replace(/-/g, ' ') || 'Not specified') + '</span></div>';
        html += '<div class="lead-detail__field"><span class="lead-detail__label"><i class="ph ph-wrench"></i> Services</span><span class="lead-detail__value">' + esc(servicesList || 'Not specified') + '</span></div>';
        html += '<div class="lead-detail__field"><span class="lead-detail__label"><i class="ph ph-calendar"></i> Received</span><span class="lead-detail__value">' + new Date(activeLead.createdAt).toLocaleString() + '</span></div>';
        html += '</div>';

        // Message
        html += '<div class="lead-detail__message"><span class="lead-detail__label"><i class="ph ph-chat-text"></i> Full Message</span><div class="lead-detail__message-body">' + esc(activeLead.message || '(no message)') + '</div></div>';

        // Notes
        var notesId = 'leadNotes_' + activeLead.id;
        html += '<div class="lead-detail__notes">';
        html += '<span class="lead-detail__label"><i class="ph ph-notepad"></i> Internal Notes</span>';
        html += '<textarea id="' + notesId + '" placeholder="Add private notes about this lead…" rows="3">' + esc(activeLead.notes || '') + '</textarea>';
        html += '<div class="lead-detail__actions">';
        html += '<button class="admin-btn admin-btn--small" onclick="BLOK_ADMIN.saveLeadNotes(\'' + activeLead.id + '\')"><i class="ph ph-floppy-disk"></i> Save Notes</button>';
        html += '<button class="admin-btn admin-btn--small btn--danger" onclick="BLOK_ADMIN.deleteLead(\'' + activeLead.id + '\')"><i class="ph ph-trash"></i> Delete</button>';
        html += '</div>';
        html += '</div>';

        html += '</div>'; // body
      }

      html += '</div>'; // detail panel

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
      document.querySelectorAll('.leads-list-panel__filter-btn').forEach(function (btn) {
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
          <div class="portfolio-form-grid">
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
          <div class="portfolio-form-desc">
            <label class="admin-label">Description</label>
            <input type="text" class="admin-input" id="portDesc" placeholder="Brief description">
          </div>
          <div class="portfolio-form-submit">
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
      const navStatusClass = navigator.onLine ? 'inspector-item__value--online' : 'inspector-item__value--offline';
      const memory = navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'N/A';
      const cores = navigator.hardwareConcurrency ? navigator.hardwareConcurrency + ' cores' : 'N/A';

      container.innerHTML = `
        <div class="inspector-grid">
          <div class="inspector-item">
            <span class="inspector-item__label"><i class="ph ph-wifi-high"></i> Network</span>
            <span class="inspector-item__value ${navStatusClass}">${navStatus}</span>
          </div>
          <div class="inspector-item">
            <span class="inspector-item__label"><i class="ph ph-cloud"></i> API Status</span>
            <span class="inspector-item__value inspector-item__value--active">Active</span>
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
          // Close mobile nav on navigation
          NAV.closeMobile();
        });
      });

      // Mobile nav toggle
      var toggleBtn = document.getElementById('navToggle');
      var overlay = document.getElementById('navOverlay');
      if (toggleBtn && overlay) {
        toggleBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          NAV.toggleMobile();
        });
        overlay.addEventListener('click', function () {
          NAV.closeMobile();
        });
      }

      // Restore hash or default to dashboard
      const hash = window.location.hash.replace('#', '');
      NAV.goTo(hash || 'dashboard');
    },

    toggleMobile() {
      var nav = document.querySelector('.admin-nav');
      var toggle = document.getElementById('navToggle');
      var overlay = document.getElementById('navOverlay');
      if (!nav) return;
      var isOpen = nav.classList.toggle('admin-nav--open');
      if (toggle) toggle.classList.toggle('nav-toggle--open', isOpen);
      if (overlay) overlay.classList.toggle('nav-overlay--visible', isOpen);
      // Update icon
      if (toggle) {
        var icon = toggle.querySelector('.ph');
        if (icon) icon.className = isOpen ? 'ph ph-x' : 'ph ph-list';
      }
    },

    closeMobile() {
      var nav = document.querySelector('.admin-nav');
      var toggle = document.getElementById('navToggle');
      var overlay = document.getElementById('navOverlay');
      if (!nav) return;
      nav.classList.remove('admin-nav--open');
      if (toggle) {
        toggle.classList.remove('nav-toggle--open');
        var icon = toggle.querySelector('.ph');
        if (icon) icon.className = 'ph ph-list';
      }
      if (overlay) overlay.classList.remove('nav-overlay--visible');
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
      if (['dashboard', 'leads', 'portfolio', 'inspector', 'users'].includes(pageId)) {
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
      TOAST.success('Lead status updated');
      await DASHBOARD.refresh();
    },

    async archiveLead(id) {
      await DB.updateLeadStatus(id, 'archived');
      DB.addLog('info', 'Lead archived');
      TOAST.success('Lead archived');
      await DASHBOARD.refresh();
    },

    async deleteLead(id) {
      if (!confirm('Delete this lead permanently?')) return;
      await DB.deleteLead(id);
      DB.addLog('info', 'Lead deleted');
      TOAST.success('Lead deleted');
      await DASHBOARD.refresh();
    },

    selectLead(id) {
      DASHBOARD._activeLeadId = id;
      DASHBOARD.renderLeads();
    },

    closeDetailMobile() {
      DASHBOARD._activeLeadId = null;
      DASHBOARD.renderLeads();
    },

    async exportLeads() {
      const data = DASHBOARD._leads;
      if (!data.length) { TOAST.error('No leads to export'); return; }
      downloadJSON(data, 'blok-leads-' + new Date().toISOString().slice(0, 10));
      DB.addLog('info', 'Leads exported');
      TOAST.success('Leads exported');
    },

    async exportLeadsCSV() {
      const data = DASHBOARD._leads;
      if (!data.length) { TOAST.error('No leads to export'); return; }
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
      TOAST.success('Leads exported as CSV');
    },

    async saveLeadNotes(id) {
      var notesEl = document.getElementById('leadNotes_' + id);
      if (!notesEl) return;
      var notes = notesEl.value;
      await DB.updateLeadNotes(id, notes);
      DB.addLog('info', 'Notes saved for lead ' + id);
      TOAST.success('Notes saved');
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
      TOAST.success(count + ' leads updated');
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
      TOAST.success(ids.length + ' leads deleted');
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
      if (!data.length) { TOAST.error('No portfolio items to export'); return; }
      downloadJSON(data, 'blok-portfolio-' + new Date().toISOString().slice(0, 10));
      DB.addLog('info', 'Portfolio exported');
      TOAST.success('Portfolio exported');
    },

    // ── Portfolio Actions ───────────────────────────────────────
    async addPortfolioItem() {
      const title = document.getElementById('portTitle');
      const tag = document.getElementById('portTag');
      const url = document.getElementById('portUrl');
      const desc = document.getElementById('portDesc');

      if (!title.value.trim()) {
        TOAST.error('Title is required');
        return;
      }

      const result = await DB.addPortfolioItem({
        title: title.value.trim(),
        tag: tag.value.trim() || 'Custom',
        url: url.value.trim(),
        desc: desc.value.trim(),
      });

      if (result.ok) {
        var addedTitle = title.value.trim();
        title.value = '';
        tag.value = '';
        url.value = '';
        desc.value = '';
        DASHBOARD._editingPortfolioId = null;
        DB.addLog('info', 'Portfolio item added: ' + addedTitle);
        TOAST.success('Portfolio item added');
        await DASHBOARD.refresh();
      } else {
        TOAST.error(result.error || 'Failed to add item');
      }
    },

    async removePortfolioItem(id) {
      if (!confirm('Remove this portfolio item?')) return;
      await DB.removePortfolioItem(id);
      DASHBOARD._editingPortfolioId = null;
      DB.addLog('info', 'Portfolio item removed');
      TOAST.success('Portfolio item removed');
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
        TOAST.success('Portfolio item updated');
        await DASHBOARD.refresh();
      } else {
        TOAST.error(result.error || 'Failed to update');
      }
    },

    // ── Archived Toggle ─────────────────────────────────────────
    _archivedOpen: false,

    toggleArchived() {
      this._archivedOpen = !this._archivedOpen;
      DASHBOARD.renderLeads();
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

    navToUsers() {
      NAV.goTo('users');
    },

    renderUserManager() {
      var container = document.getElementById('userManagerContent');
      if (!container) return;
      var users = this._getUsers();
      var html = '<div class="user-manager-section">';
      html += '<p class="user-manager-intro">Manage who has access to this dashboard. Credentials are stored in <code>admin/credentials.json</code>.</p>';
      html += '<table class="admin-table"><thead><tr><th>Username</th><th>Role</th><th>Actions</th></tr></thead><tbody>';
      users.forEach(function (u) {
        html += '<tr><td><strong>' + esc(u.username) + '</strong></td><td><span class="tag tag--steel">' + esc(u.role || 'admin') + '</span></td>';
        html += '<td><button class="admin-btn admin-btn--small btn--danger" onclick="BLOK_ADMIN.deleteUser(\'' + esc(u.username) + '\')" ' + (users.length <= 1 ? 'disabled' : '') + '><i class="ph ph-trash"></i></button></td></tr>';
      });
      html += '</tbody></table></div>';
      html += '<div class="user-manager-add">';
      html += '<label class="admin-label">Add User</label>';
      html += '<div class="user-manager-add__form">';
      html += '<div class="user-manager-add__field"><input type="text" class="admin-input" id="newUserName" placeholder="Username"></div>';
      html += '<div class="user-manager-add__field"><input type="password" class="admin-input" id="newUserPass" placeholder="Password"></div>';
      html += '<button class="admin-btn admin-btn--primary" onclick="BLOK_ADMIN.addUser()"><i class="ph ph-plus"></i> Add</button>';
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
  // 6. Toast / UI helpers
  // =============================================================

  const TOAST = {
    _container: null,

    _ensureContainer() {
      if (!this._container) {
        this._container = document.createElement('div');
        this._container.className = 'toast-container';
        document.body.appendChild(this._container);
      }
      return this._container;
    },

    show(msg, type) {
      type = type || 'info';
      const container = this._ensureContainer();
      const el = document.createElement('div');
      el.className = 'toast toast--' + type;
      el.innerHTML = msg;
      container.appendChild(el);
      setTimeout(function () {
        el.classList.add('toast--out');
        setTimeout(function () { el.remove(); }, 250);
      }, 3000);
    },

    success(msg) { this.show(msg, 'success'); },
    error(msg) { this.show(msg, 'error'); },
    info(msg) { this.show(msg, 'info'); },
  };

  /** Show a loading spinner in a container while an async op runs */
  async function withLoading(containerId, fn) {
    const el = document.getElementById(containerId);
    if (!el) return fn();
    el.innerHTML = '<div class="loading-state"><div class="loading-state__spinner"></div><div class="loading-state__text">Loading…</div></div>';
    try {
      return await fn();
    } catch (e) {
      TOAST.error('Error: ' + (e.message || e));
      throw e;
    }
  }

  // =============================================================
  // 7. Helpers
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
              <button class="admin-header__user-dropdown-item" onclick="BLOK_ADMIN.logout()">
                <i class="ph ph-user-switch"></i> Change User
              </button>
              <button class="admin-header__user-dropdown-item" onclick="BLOK_ADMIN.logout()">
                <i class="ph ph-sign-out"></i> Log Out
              </button>
              <div class="admin-header__user-dropdown-divider"></div>
              <button class="admin-header__user-dropdown-item admin-header__user-dropdown-item--danger" onclick="BLOK_ADMIN.logout()">
                <i class="ph ph-plugs-out"></i> Disconnect
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
