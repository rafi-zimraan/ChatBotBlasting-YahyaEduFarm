// ============================================
// Jabatangan — WhatsApp Blast Controller
// YahyaEduFarm | GriyaIT Nusantara
// ============================================

let groupsData = [];
let selectedGroups = new Set();
let botActive = true;
let botMenuActive = true;
let blastHistoryList = [];
let analyticsData = {};
let donorsData = [];
let newUsersData = [];
let activityChart = null;
let currentPeriod = 'today';
let currentQr = null;
let waConnected = false;
let dashQrInstance = null;

let contactsData = [];
let selectedContacts = new Set();
let campaignsData = [];
let cmSelectedLabel = null;

let conversationsData = {};
let selectedConvId = null;
let blockedData = [];

// Socket.io connection dengan token dari login
const savedToken = sessionStorage.getItem('jabatangan-token');
if (!savedToken) {
    window.location.href = '/login.html';
}
const socket = io({ auth: { token: savedToken || '' } });

socket.on('connect_error', () => {
    sessionStorage.removeItem('jabatangan-token');
    window.location.href = '/login.html';
});

// ============ SOCKET EVENTS ============
socket.on('connect', () => {
    document.getElementById('connectionBadge').innerHTML = '<span class="status-dot green"></span> Terhubung';
    socket.emit('request-state');
});

socket.on('disconnect', () => {
    document.getElementById('connectionBadge').innerHTML = '<span class="status-dot red"></span> Putus';
});

socket.on('state', (data) => {
    if (data.groups) groupsData = data.groups;
    if (data.schedules) renderSchedules(data.schedules);
    if (data.blastHistory) blastHistoryList = data.blastHistory;
    if (data.faqs) renderFaqs(data.faqs);
    if (data.faqsBlasting) renderFaqsBlast(data.faqsBlasting);
    if (data.analytics) { analyticsData = data.analytics; setTimeout(renderChart, 50); }
    if (data.donors) { donorsData = data.donors; renderDonors(); renderDonorSummary(); renderTopDonor(); }
    if (data.newUsers) { newUsersData = data.newUsers; renderNewUsers(); }
    if (data.contacts) { contactsData = data.contacts; renderContacts(); }
    if (data.personalCampaigns) { campaignsData = data.personalCampaigns; renderCampaigns(); renderCampaignStats(); }
    if (data.blockedContacts) { blockedData = data.blockedContacts; renderBlocked(); }
    if (data.conversations && data.conversations.length) {
        data.conversations.forEach(c => { conversationsData[c.id] = { ...conversationsData[c.id], ...c }; });
        renderConvList();
    }
    if (data.user) renderProfile(data.user);

    if (data.waStatus) updateWaBadge(data.waStatus);
    if (data.qrCode) { currentQr = data.qrCode; }
    renderDashboardQr(data.waStatus || 'disconnected', data.qrCode || null);

    updateStatus(data);
    renderGroups();
    renderStats(data);
    renderBlastHistory();
    renderHoloCards();
});

socket.on('contacts-update', (data) => {
    contactsData = data;
    renderContacts();
});

socket.on('campaigns-update', (data) => {
    campaignsData = data;
    renderCampaigns();
    renderCampaignStats();
});

socket.on('campaign-progress', (data) => {
    renderCampaigns();
    renderCampaignStats();
});

socket.on('campaign-created', (data) => {
    if (data.scheduledAt) {
        showToast('Campaign dijadwalkan', `Blasting akan dikirim pada ${new Date(data.scheduledAt).toLocaleString('id-ID')}`, '⏰');
    } else {
        showToast('Blasting dimulai', 'Pesan sedang dikirim ke kontak...', '📨');
    }
});

socket.on('qr', (qr) => {
    currentQr = qr;
    updateWaBadge('qr');
    showQrModal(qr);
    renderDashboardQr('qr', qr);
});

socket.on('wa-status', (status) => {
    updateWaBadge(status);
    if (status === 'ready') {
        currentQr = null;
        setQrConnected();
        renderDashboardQr('ready', null);
        showToast('WhatsApp Terhubung', 'Bot siap menerima pesan', '✅');
    } else if (status === 'disconnected') {
        renderDashboardQr('disconnected', null);
        showToast('WhatsApp Terputus', 'Bot tidak aktif sementara', '⚠️');
    }
});

socket.on('status-update', (data) => {
    updateStatus(data);
    renderStats(data);
});

socket.on('groups-update', (groups) => {
    groupsData = groups;
    renderGroups();
    renderStats({ groupsCount: groups.length });
});

socket.on('schedules-update', (schedules) => {
    renderSchedules(schedules);
    renderStats({ schedulesCount: schedules.filter(s => s.enabled).length });
});

socket.on('analytics-update', (data) => {
    analyticsData = data;
    renderChart();
    renderTodayStats();
});

socket.on('donors-update', (data) => {
    donorsData = data;
    renderDonors();
    renderDonorSummary();
    renderTopDonor();
    renderHoloCards();
    renderStats({ donorsCount: data.length });
});

socket.on('new-users-update', (data) => {
    newUsersData = data;
    renderNewUsers();
});

socket.on('blast-progress', (data) => {
    const progressDiv = document.getElementById('blastProgress');
    progressDiv.style.display = 'block';
    const pct = data.total > 0 ? Math.round((data.current / data.total) * 100) : 0;
    document.getElementById('progressFill').style.width = pct + '%';
    document.getElementById('progressText').textContent = `${data.current} / ${data.total}`;
    document.getElementById('progressDetail').textContent = data.currentDetail || '';
});

socket.on('blast-complete', (data) => {
    document.getElementById('progressFill').style.width = '100%';
    document.getElementById('progressText').textContent = `${data.sukses} sukses, ${data.gagal} gagal`;
    document.getElementById('progressDetail').textContent = `Selesai! Total ${data.total} grup`;

    blastHistoryList.unshift({
        message: document.getElementById('blastMessage').value || '(pesan dari dashboard)',
        time: new Date().toLocaleString('id-ID'),
        sukses: data.sukses,
        gagal: data.gagal,
        total: data.total
    });
    renderBlastHistory();

    setTimeout(() => {
        document.getElementById('blastProgress').style.display = 'none';
    }, 5000);
});

socket.on('faq-update', (faqs) => { renderFaqs(faqs); });
socket.on('faq-blast-update', (faqs) => { renderFaqsBlast(faqs); });

socket.on('conversations-list', (list) => {
    list.forEach(c => { conversationsData[c.id] = { ...conversationsData[c.id], ...c }; });
    renderConvList();
});

socket.on('conv-update', (data) => {
    const existing = conversationsData[data.id] || {};
    conversationsData[data.id] = { ...existing, ...data.conv };
    renderConvList();
    if (selectedConvId === data.id) {
        const msgs = data.conv.messages;
        if (msgs && msgs.length) appendChatMessage(msgs[msgs.length - 1]);
        scrollChatToBottom();
    }
});

socket.on('conv-list-update', (list) => {
    list.forEach(c => {
        if (!conversationsData[c.id]) conversationsData[c.id] = {};
        Object.assign(conversationsData[c.id], c);
    });
    renderConvList();
});

socket.on('conversation-detail', (conv) => {
    conversationsData[conv.id] = conv;
    openConversation(conv.id);
});

socket.on('cs-reply-sent', (data) => {
    const btn = document.getElementById('mcSendBtn');
    const input = document.getElementById('mcReplyInput');
    if (btn) btn.disabled = false;
    if (!data.ok) {
        showToast('Gagal kirim', data.error || 'Coba lagi', '❌');
    } else {
        if (input) { input.value = ''; input.focus(); }
    }
});

socket.on('blocked-update', (data) => {
    blockedData = data;
    renderBlocked();
    renderConvList();
});

// ============ PROFILE ============
function renderProfile(user) {
    if (!user) return;
    const nameEl = document.getElementById('profileName');
    const emailEl = document.getElementById('profileEmail');
    const avatarEl = document.querySelector('.profile-avatar');
    if (nameEl) nameEl.textContent = user.email === 'owner@gmail.com' ? 'Owner' : user.email.split('@')[0];
    if (emailEl) emailEl.textContent = user.email || 'owner@gmail.com';
    if (avatarEl) avatarEl.textContent = (user.email || 'O').charAt(0).toUpperCase();
}

// ============ TOAST NOTIFICATIONS ============
function showToast(title, desc, icon) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <div class="toast-icon">${icon || '🎉'}</div>
        <div class="toast-body">
            <div class="toast-title">${title}</div>
            <div class="toast-desc">${desc}</div>
            <div class="toast-time">${timeStr}</div>
        </div>
        <button class="toast-close" onclick="dismissToast(this)" aria-label="Tutup">&times;</button>
    `;
    container.appendChild(toast);

    setTimeout(() => dismissToast(toast), 6000);
}

function dismissToast(el) {
    const toast = el.tagName === 'DIV' ? el : el.parentElement;
    toast.classList.add('toast-out');
    setTimeout(() => {
        if (toast.parentElement) toast.remove();
    }, 350);
}

socket.on('donor-notification', (donor) => {
    const categoryLabels = {
        donasi: 'Donasi', pembelian: 'Pembelian', wisata: 'Paket Wisata',
        pelatihan: 'Pelatihan', gathering: 'Gathering'
    };
    const cat = categoryLabels[donor.category] || donor.category;
    const amount = 'Rp' + (donor.amount || 0).toLocaleString('id-ID');
    showToast(
        donor.name,
        `${cat} — ${amount}${donor.notes ? ' · ' + donor.notes : ''}`,
        '❤️'
    );
});

// ============ THEME ============
function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('jabatangan-theme', next);
    if (activityChart) {
        updateChartTheme(next);
    }
}

function updateChartTheme(theme) {
    if (!activityChart) return;
    const tickColor = theme === 'dark' ? '#8b949e' : '#667781';
    const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    activityChart.options.scales.x.ticks.color = tickColor;
    activityChart.options.scales.y.ticks.color = tickColor;
    activityChart.options.scales.y.grid.color = gridColor;
    activityChart.update();
}

// Terapkan tema tersimpan saat load
(function () {
    const saved = localStorage.getItem('jabatangan-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
})();

// ============ NAVIGATION ============
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function() {
        navigateTo(this.dataset.page);
    });
});

function navigateTo(page) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');
    document.getElementById(`page-${page}`).classList.add('active');

    const titles = {
        dashboard: 'Dashboard',
        monitoring: 'Monitoring Chat',
        groups: 'Groups',
        blast: 'Blast',
        schedule: 'Jadwal',
        faq: 'FAQ Bot',
        contacts: 'Kontak Personal',
        donors: 'Donatur Tetap',
        blocked: 'Kontak Diblokir',
    };
    document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';

    if (page === 'groups') renderGroups();
    if (page === 'schedule') socket.emit('request-schedules');
    if (page === 'faq') socket.emit('request-state');
    if (page === 'dashboard') { setTimeout(() => { renderChart(); renderTodayStats(); renderTopDonor(); renderHoloCards(); renderNewUsers(); }, 50); }
    if (page === 'donors') { renderDonors(); renderDonorSummary(); }
    if (page === 'contacts') { renderContacts(); }
    if (page === 'blast') { renderCampaigns(); renderCampaignStats(); }
    if (page === 'monitoring') {
        // Reset filter & search setiap kali buka halaman
        const s = document.getElementById('monitorSearch'); if (s) s.value = '';
        const l = document.getElementById('monitorLabelFilter'); if (l) l.value = 'all';
        socket.emit('get-conversations');
        renderConvList();
    }
    if (page === 'blocked') { renderBlocked(); }
}

// ============ STATUS ============
function updateStatus(data) {
    const statusEl = document.getElementById('botStatus');
    const dot = statusEl.querySelector('.status-dot');
    const label = statusEl.querySelector('.status-label');

    if (data.botAktif !== undefined) botActive = data.botAktif;
    if (data.botMenu !== undefined) botMenuActive = data.botMenu;

    dot.className = botActive ? 'status-dot green' : 'status-dot red';
    label.textContent = botActive ? 'Bot Aktif' : 'Bot Mati';
}

function renderStats(data) {
    if (data.botAktif !== undefined) {
        const el = document.getElementById('statBotStatus');
        if (el) {
            el.textContent = data.botAktif ? 'Aktif' : 'Offline';
            el.style.color = data.botAktif ? 'var(--green)' : 'var(--red)';
        }
        const micro = document.getElementById('microBotStatus');
        if (micro) micro.textContent = data.botAktif ? 'Aktif' : 'Mati';
    }
    if (data.botMenu !== undefined) {
        const microMenu = document.getElementById('microMenu');
        if (microMenu) microMenu.textContent = data.botMenu ? 'Aktif' : 'Mati';
    }
    if (data.groupsCount !== undefined) {
        const el = document.getElementById('statGroups');
        if (el) el.textContent = data.groupsCount;
        const heroG = document.getElementById('heroGroupsCount');
        if (heroG) heroG.textContent = data.groupsCount + ' Grup';
        const microG = document.getElementById('microGroups');
        if (microG) microG.textContent = data.groupsCount;
    }
    if (data.schedulesCount !== undefined) {
        const el = document.getElementById('statSchedules');
        if (el) el.textContent = data.schedulesCount;
        const micro = document.getElementById('microSchedules');
        if (micro) micro.textContent = data.schedulesCount;
    }
    if (data.donorsCount !== undefined) {
        const el = document.getElementById('statDonors');
        if (el) el.textContent = data.donorsCount;
    }

    renderTodayStats();

    const toggleBtn = document.getElementById('dashToggleBot');
    if (toggleBtn) {
        if (botActive) {
            toggleBtn.innerHTML = 'Matikan Bot';
            toggleBtn.className = 'btn btn-outline';
        } else {
            toggleBtn.innerHTML = 'Aktifkan Bot';
            toggleBtn.className = 'btn btn-primary';
        }
    }
}

function renderTodayStats() {
    const { start, end } = getPeriodRange(currentPeriod);
    let totalPrivate = 0, totalGroupFaq = 0;
    const d = new Date(start);
    while (d.toISOString().slice(0, 10) <= end) {
        const key = d.toISOString().slice(0, 10);
        totalPrivate += (analyticsData[key] || {}).private || 0;
        totalGroupFaq += (analyticsData[key] || {}).groupFaq || 0;
        d.setDate(d.getDate() + 1);
    }

    const el = document.getElementById('statPrivateToday');
    const el2 = document.getElementById('statGroupFaqToday');
    if (el) el.textContent = totalPrivate;
    if (el2) el2.textContent = totalGroupFaq;
    if (document.getElementById('statDonors')) {
        document.getElementById('statDonors').textContent = donorsData.length;
    }
    const heroToday = document.getElementById('heroTodayCount');
    if (heroToday) heroToday.textContent = (totalPrivate + totalGroupFaq) + ' Pesan ' + getPeriodLabel(currentPeriod);
    const heroStatus = document.getElementById('heroBotStatus');
    if (heroStatus) heroStatus.textContent = botActive ? '✅ Bot Aktif' : '🔴 Bot Mati';
}

function toggleBot() {
    botActive = !botActive;
    socket.emit('toggle-bot', botActive);
}

// ============ PERIOD SWITCHING & HOLOGRAM CARDS ============
function getPeriodRange(period) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const today = `${y}-${m}-${d}`;
    if (period === 'today') return { start: today, end: today };
    if (period === 'week') {
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
        const start = new Date(now.setDate(diff));
        const end = new Date();
        return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
    }
    if (period === 'month') return { start: `${y}-${m}-01`, end: today };
    if (period === 'year') return { start: `${y}-01-01`, end: today };
    return { start: today, end: today };
}

function getPeriodLabel(period) {
    const labels = { today: 'Hari Ini', week: 'Minggu Ini', month: 'Bulan Ini', year: 'Tahun Ini' };
    return labels[period] || 'Hari Ini';
}

function getPreviousPeriodRange(period) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const today = `${y}-${m}-${d}`;
    if (period === 'today') {
        const yesterday = new Date(Date.now() - 86400000);
        const ys = yesterday.toISOString().slice(0, 10);
        return { start: ys, end: ys };
    }
    if (period === 'week') {
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
        const endPrev = new Date(now.setDate(diff - 1));
        const startPrev = new Date(now.setDate(diff - 7));
        return { start: startPrev.toISOString().slice(0, 10), end: endPrev.toISOString().slice(0, 10) };
    }
    if (period === 'month') {
        const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        const pm = String(prevMonth.getMonth() + 1).padStart(2, '0');
        const py = prevMonth.getFullYear();
        return { start: `${py}-${pm}-01`, end: today };
    }
    if (period === 'year') return { start: `${y - 1}-01-01`, end: `${y - 1}-12-31` };
    return { start: today, end: today };
}

function isDateInRange(dateStr, start, end) {
    return dateStr >= start && dateStr <= end;
}

function computePeriodSum(period, field) {
    let start, end;
    if (typeof period === 'object' && period.start && period.end) {
        start = period.start;
        end = period.end;
    } else {
        const range = getPeriodRange(period);
        if (!range) return 0;
        start = range.start;
        end = range.end;
    }
    if (field === 'private') {
        let total = 0;
        const d = new Date(start);
        while (d.toISOString().slice(0, 10) <= end) {
            const key = d.toISOString().slice(0, 10);
            total += (analyticsData[key] || {}).private || 0;
            d.setDate(d.getDate() + 1);
        }
        return total;
    }
    if (field.startsWith('analytics.')) {
        const f = field.replace('analytics.', '');
        let total = 0;
        const d = new Date(start);
        while (d.toISOString().slice(0, 10) <= end) {
            const key = d.toISOString().slice(0, 10);
            total += (analyticsData[key] || {})[f] || 0;
            d.setDate(d.getDate() + 1);
        }
        return total;
    }
    if (field === 'blastCount') {
        const { start: start2, end: end2 } = getPeriodRange(period);
        return blastHistoryList.filter(b => {
            const dt = b.time ? b.time.split(' ')[0] : '';
            return dt >= start2 && dt <= end2;
        }).length;
    }
    if (field === 'donors') {
        return donorsData.filter(d => d.date >= start && d.date <= end).length;
    }
    if (field === 'donationSum') {
        return donorsData
            .filter(d => d.date >= start && d.date <= end)
            .reduce((sum, d) => sum + (d.amount || 0), 0);
    }
    return 0;
}

function computeTrend(period, field) {
    const current = computePeriodSum(period, field);
    const prev = computePeriodSum(getPreviousPeriodRange(period), field);
    if (prev === 0) return { value: current, pct: current > 0 ? 100 : 0, direction: current > 0 ? 'up' : 'neutral' };
    const pct = Math.round(((current - prev) / prev) * 100);
    return { value: current, pct: Math.abs(pct), direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral' };
}

function renderTrendHtml(trend) {
    if (trend.direction === 'up') return `<span class="trend-up">↑ ${trend.pct}%</span>`;
    if (trend.direction === 'down') return `<span class="trend-down">↓ ${trend.pct}%</span>`;
    return `<span class="trend-neutral">—</span>`;
}

function renderHoloCards() {
    const p = currentPeriod;
    const msgs = computeTrend(p, 'analytics.private');
    const blasts = computeTrend(p, 'blastCount');
    const donation = computeTrend(p, 'donationSum');
    const donors = computeTrend(p, 'donors');
    const label = getPeriodLabel(p);

    document.getElementById('holoMessages').textContent = msgs.value;
    document.getElementById('trendMessages').innerHTML = renderTrendHtml(msgs);

    document.getElementById('holoBlasts').textContent = blasts.value;
    document.getElementById('trendBlasts').innerHTML = renderTrendHtml(blasts);

    document.getElementById('holoDonation').textContent = 'Rp' + donation.value.toLocaleString('id-ID');
    document.getElementById('trendDonation').innerHTML = renderTrendHtml(donation);

    document.getElementById('holoDonors').textContent = donors.value;
    document.getElementById('trendDonors').innerHTML = renderTrendHtml(donors);
}

function switchPeriod(period) {
    currentPeriod = period;
    document.querySelectorAll('.period-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.period-tab[data-period="${period}"]`).classList.add('active');
    renderHoloCards();
    renderTopDonor();
    renderTodayStats();
}

function logout() {
    fetch('/api/logout', { method: 'POST' }).then(() => {
        sessionStorage.removeItem('jabatangan-token');
        window.location.href = '/login.html';
    });
}

// ============ CHART ============
function getLast7Days() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        days.push(d.toISOString().slice(0, 10));
    }
    return days;
}

function renderChart() {
    const canvas = document.getElementById('activityChart');
    if (!canvas) return;
    if (canvas.offsetParent === null) {
        // canvas tidak visible — coba lagi setelah navigasi
        return;
    }

    const days = getLast7Days();
    const labels = days.map(d => {
        const dt = new Date(d + 'T00:00:00');
        return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    });

    const privateData = days.map(d => (analyticsData[d] || {}).private || 0);
    const groupFaqData = days.map(d => (analyticsData[d] || {}).groupFaq || 0);
    const blastData = days.map(d => (analyticsData[d] || {}).blasts || 0);

    if (activityChart) {
        activityChart.data.labels = labels;
        activityChart.data.datasets[0].data = privateData;
        activityChart.data.datasets[1].data = groupFaqData;
        activityChart.data.datasets[2].data = blastData;
        activityChart.update();
        return;
    }

    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    const tickColor = theme === 'dark' ? '#8b949e' : '#667781';
    const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const tooltipBg = theme === 'dark' ? '#161b22' : '#111b21';

    activityChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'DM Private',
                    data: privateData,
                    backgroundColor: 'rgba(37,211,102,0.7)',
                    borderColor: 'rgba(37,211,102,1)',
                    borderWidth: 1,
                    borderRadius: 4,
                },
                {
                    label: 'FAQ Grup',
                    data: groupFaqData,
                    backgroundColor: 'rgba(167,139,250,0.7)',
                    borderColor: 'rgba(167,139,250,1)',
                    borderWidth: 1,
                    borderRadius: 4,
                },
                {
                    label: 'Blast Dikirim',
                    data: blastData,
                    backgroundColor: 'rgba(245,158,11,0.7)',
                    borderColor: 'rgba(245,158,11,1)',
                    borderWidth: 1,
                    borderRadius: 4,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: tooltipBg,
                    titleColor: '#8b949e',
                    bodyColor: '#e6edf3',
                    padding: 10,
                },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 12 }, color: tickColor },
                },
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, font: { size: 12 }, color: tickColor },
                    grid: { color: gridColor },
                },
            },
        },
    });
}

// ============ GROUPS ============
function renderGroups() {
    const tbody = document.getElementById('groupsTableBody');
    if (!groupsData || groupsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Belum ada grup. Tambahkan bot ke grup WhatsApp terlebih dahulu.</td></tr>';
        return;
    }

    const searchTerm = (document.getElementById('groupSearch')?.value || '').toLowerCase();
    const filtered = groupsData.filter(g =>
        g.name.toLowerCase().includes(searchTerm) || g.id.includes(searchTerm)
    );

    tbody.innerHTML = filtered.map(g => {
        const initial = (g.name || '?').charAt(0).toUpperCase();
        const checked = selectedGroups.has(g.id) ? 'checked' : '';
        return `<tr>
            <td><input type="checkbox" class="group-checkbox" value="${g.id}" ${checked} onchange="toggleGroup('${g.id}')"></td>
            <td>
                <div class="group-name-cell">
                    <div class="group-avatar">${initial}</div>
                    <span>${escapeHtml(g.name)}</span>
                </div>
            </td>
            <td>${g.memberCount}</td>
            <td style="font-size:12px;color:var(--text-muted);font-family:monospace">${g.id}</td>
        </tr>`;
    }).join('');

    updateSelectionBar();
}

function filterGroups() { renderGroups(); }

function toggleGroup(id) {
    if (selectedGroups.has(id)) selectedGroups.delete(id);
    else selectedGroups.add(id);
    updateSelectionBar();
    document.getElementById('selectAllGroups').checked = selectedGroups.size === groupsData.length;
}

function toggleSelectAll() {
    const checked = document.getElementById('selectAllGroups').checked;
    if (checked) groupsData.forEach(g => selectedGroups.add(g.id));
    else selectedGroups.clear();
    renderGroups();
}

function updateSelectionBar() {
    const bar = document.getElementById('selectionBar');
    const count = selectedGroups.size;
    document.getElementById('selectedCount').textContent = count;
    bar.classList.toggle('visible', count > 0);
}

function refreshGroups() { socket.emit('refresh-groups'); }

function blastSelected() { navigateTo('blast'); }

// ============ BLAST ============
function toggleBlastTarget() {
    const target = document.querySelector('input[name="blastTarget"]:checked').value;
    const info = document.getElementById('selectedGroupsInfo');
    if (target === 'selected') {
        info.style.display = 'flex';
        document.getElementById('blastSelectedCount').textContent = selectedGroups.size + ' grup dipilih';
    } else {
        info.style.display = 'none';
    }
}

document.getElementById('blastMessage')?.addEventListener('input', function() {
    document.getElementById('charCount').textContent = this.value.length;
});

let blastMediaData = null;

function onBlastMediaSelect(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        blastMediaData = { base64, filename: file.name, mimetype: file.type };
        document.getElementById('blastMediaPreview').style.display = 'flex';
        document.getElementById('blastMediaName').textContent = file.name;
        document.getElementById('blastMediaText').textContent = 'Ganti file';
    };
    reader.readAsDataURL(file);
}

function removeBlastMedia() {
    blastMediaData = null;
    document.getElementById('blastMediaPreview').style.display = 'none';
    document.getElementById('blastMediaInput').value = '';
    document.getElementById('blastMediaText').textContent = 'Lampirkan gambar/PDF/video';
}

function executeBlast() {
    const message = document.getElementById('blastMessage').value.trim();
    if (!message && !blastMediaData) { alert('Tulis pesan atau lampirkan file!'); return; }

    const target = document.querySelector('input[name="blastTarget"]:checked').value;
    const targetGroups = target === 'selected' ? Array.from(selectedGroups) : [];

    if (target === 'selected' && targetGroups.length === 0) {
        alert('Pilih grup terlebih dahulu!'); return;
    }

    document.getElementById('sendBlastBtn').disabled = true;
    document.getElementById('sendBlastBtn').textContent = 'Mengirim...';
    socket.emit('execute-blast', {
        message,
        targetGroups,
        media: blastMediaData,
    });
}

socket.on('blast-sent', () => {
    document.getElementById('sendBlastBtn').disabled = false;
    document.getElementById('sendBlastBtn').innerHTML =
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg> Kirim Blast';
    document.getElementById('blastMessage').value = '';
    document.getElementById('charCount').textContent = '0';
});

function renderBlastHistory() {
    const container = document.getElementById('blastHistory');
    if (!blastHistoryList || blastHistoryList.length === 0) {
        container.innerHTML = '<div class="empty-state">Belum ada riwayat blast.</div>';
        return;
    }
    container.innerHTML = blastHistoryList.slice(0, 20).map(h =>
        `<div class="history-item">
            <div class="history-msg">
                <span class="msg-text">${escapeHtml(h.message)}</span>
                <span class="history-meta">${h.time}</span>
            </div>
            <div class="history-result ${h.gagal > 0 ? 'partial' : 'success'}">
                ${h.sukses}/${h.total} sukses
            </div>
        </div>`
    ).join('');
}

// ============ SCHEDULE ============
function addSchedule() {
    const time = document.getElementById('scheduleTime').value;
    const message = document.getElementById('scheduleMessage').value.trim();
    const days = Array.from(document.querySelectorAll('#scheduleDays input:checked')).map(cb => cb.value);
    if (!time) { alert('Pilih waktu jadwal!'); return; }
    if (!message) { alert('Tulis pesan untuk jadwal!'); return; }
    socket.emit('add-schedule', { time, message, days });
    document.getElementById('scheduleMessage').value = '';
    document.querySelectorAll('#scheduleDays input:checked').forEach(cb => cb.checked = false);
}

socket.on('schedule-added', (data) => { renderSchedules(data.schedules); });

function removeSchedule(id) {
    if (confirm('Hapus jadwal ini?')) socket.emit('remove-schedule', id);
}

function toggleSchedule(id, enabled) {
    socket.emit('toggle-schedule', { id, enabled });
}

function renderSchedules(schedules) {
    const container = document.getElementById('scheduleList');
    if (!schedules || schedules.length === 0) {
        container.innerHTML = '<div class="empty-state">Belum ada jadwal. Buat jadwal baru di atas.</div>';
        return;
    }
    const DAY_LABEL = { sen: 'Sen', sel: 'Sel', rab: 'Rab', kam: 'Kam', jum: 'Jum', sab: 'Sab', min: 'Min' };
    container.innerHTML = schedules.map(s => {
        const days = s.days || [];
        const hariLabel = days.length > 0 ? days.map(d => DAY_LABEL[d] || d).join(', ') : 'Setiap hari';
        return `<div class="schedule-item">
            <div class="schedule-time">${s.time}</div>
            <div class="schedule-msg">
                <span class="msg-text">${escapeHtml(s.message)}</span>
                <span class="schedule-meta">📅 ${hariLabel} · ${s.enabled ? 'Aktif' : 'Nonaktif'}</span>
            </div>
            <div class="schedule-actions">
                <label class="toggle-switch">
                    <input type="checkbox" ${s.enabled ? 'checked' : ''} onchange="toggleSchedule('${s.id}', this.checked)">
                    <span class="toggle-slider"></span>
                </label>
                <button class="btn-danger-sm" onclick="removeSchedule('${s.id}')">Hapus</button>
            </div>
        </div>`;
    }).join('');

    const activeCount = schedules.filter(s => s.enabled).length;
    const el = document.getElementById('statSchedules');
    if (el) el.textContent = activeCount;
    const micro = document.getElementById('microSchedules');
    if (micro) micro.textContent = activeCount;
}

// ============ FAQ TABS ============
function switchFaqTab(tab, el) {
    document.querySelectorAll('.faq-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('faq-panel-dm').style.display = tab === 'dm' ? 'block' : 'none';
    document.getElementById('faq-panel-blast').style.display = tab === 'blast' ? 'block' : 'none';
}

// ============ FAQ (DM) ============
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve({ base64, filename: file.name, mimetype: file.type });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function addFaq() {
    const keyword = (document.getElementById('faqKeyword').value || '').trim();
    const answer = (document.getElementById('faqAnswer').value || '').trim();
    if (!keyword) { alert('Isi kata kunci terlebih dahulu!'); return; }
    if (!answer) { alert('Isi jawaban terlebih dahulu!'); return; }
    socket.emit('add-faq', { keyword, answer });
    document.getElementById('faqKeyword').value = '';
    document.getElementById('faqAnswer').value = '';
}

function removeFaq(id) {
    if (confirm('Hapus FAQ ini?')) socket.emit('remove-faq', id);
}

function toggleFaq(id, enabled) { socket.emit('toggle-faq', { id, enabled }); }

function uploadFaqMedia(id) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        const { base64, filename, mimetype } = await readFileAsBase64(file);
        socket.emit('upload-faq-media', { id, base64, filename, mimetype });
    };
    input.click();
}

function removeFaqMedia(id) {
    if (confirm('Hapus media dari FAQ ini?')) socket.emit('remove-faq-media', id);
}

function renderFaqs(faqs) {
    const container = document.getElementById('faqList');
    if (!faqs || faqs.length === 0) {
        container.innerHTML = '<div class="empty-state">Belum ada FAQ DM. Tambah di atas.</div>';
        return;
    }
    container.innerHTML = faqs.map(f =>
        `<div class="schedule-item">
            <div class="faq-keyword">
                <span class="faq-badge">${escapeHtml(f.keyword)}</span>
                ${f.media ? '<span class="faq-media-badge" title="Ada media">🖼️</span>' : ''}
            </div>
            <div class="schedule-msg" style="flex:1;padding:0 12px">
                <span class="msg-text">${escapeHtml(f.answer)}</span>
                <span class="schedule-meta">${f.enabled ? 'Aktif' : 'Nonaktif'}</span>
            </div>
            <div class="schedule-actions">
                ${f.media
                    ? `<button class="btn-outline-sm" onclick="removeFaqMedia(${f.id})" title="Hapus media">📎</button>`
                    : `<button class="btn-outline-sm" onclick="uploadFaqMedia(${f.id})" title="Upload media">📷</button>`}
                <label class="toggle-switch">
                    <input type="checkbox" ${f.enabled ? 'checked' : ''} onchange="toggleFaq(${f.id}, this.checked)">
                    <span class="toggle-slider"></span>
                </label>
                <button class="btn-danger-sm" onclick="removeFaq(${f.id})">Hapus</button>
            </div>
        </div>`
    ).join('');
}

// ============ FAQ BLAST (GRUP) ============
function addFaqBlast() {
    const keyword = (document.getElementById('faqBlastKeyword').value || '').trim();
    const answer = (document.getElementById('faqBlastAnswer').value || '').trim();
    if (!keyword) { alert('Isi kata kunci terlebih dahulu!'); return; }
    if (!answer) { alert('Isi jawaban terlebih dahulu!'); return; }
    socket.emit('add-faq-blast', { keyword, answer });
    document.getElementById('faqBlastKeyword').value = '';
    document.getElementById('faqBlastAnswer').value = '';
}

function removeFaqBlast(id) {
    if (confirm('Hapus FAQ Grup ini?')) socket.emit('remove-faq-blast', id);
}

function toggleFaqBlast(id, enabled) { socket.emit('toggle-faq-blast', { id, enabled }); }

function uploadFaqBlastMedia(id) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        const { base64, filename, mimetype } = await readFileAsBase64(file);
        socket.emit('upload-faq-blast-media', { id, base64, filename, mimetype });
    };
    input.click();
}

function removeFaqBlastMedia(id) {
    if (confirm('Hapus media dari FAQ ini?')) socket.emit('remove-faq-blast-media', id);
}

function renderFaqsBlast(faqs) {
    const container = document.getElementById('faqBlastList');
    if (!container) return;
    if (!faqs || faqs.length === 0) {
        container.innerHTML = '<div class="empty-state">Belum ada FAQ Grup. Tambah di atas.</div>';
        return;
    }
    container.innerHTML = faqs.map(f =>
        `<div class="schedule-item">
            <div class="faq-keyword">
                <span class="faq-badge faq-badge-blast">${escapeHtml(f.keyword)}</span>
                ${f.media ? '<span class="faq-media-badge" title="Ada media">🖼️</span>' : ''}
            </div>
            <div class="schedule-msg" style="flex:1;padding:0 12px">
                <span class="msg-text">${escapeHtml(f.answer)}</span>
                <span class="schedule-meta">${f.enabled ? 'Aktif' : 'Nonaktif'}</span>
            </div>
            <div class="schedule-actions">
                ${f.media
                    ? `<button class="btn-outline-sm" onclick="removeFaqBlastMedia(${f.id})" title="Hapus media">📎</button>`
                    : `<button class="btn-outline-sm" onclick="uploadFaqBlastMedia(${f.id})" title="Upload media">📷</button>`}
                <label class="toggle-switch">
                    <input type="checkbox" ${f.enabled ? 'checked' : ''} onchange="toggleFaqBlast(${f.id}, this.checked)">
                    <span class="toggle-slider"></span>
                </label>
                <button class="btn-danger-sm" onclick="removeFaqBlast(${f.id})">Hapus</button>
            </div>
        </div>`
    ).join('');
}

// ============ DONORS ============
function addDonor() {
    const name = (document.getElementById('donorName').value || '').trim();
    const phone = (document.getElementById('donorPhone').value || '').trim();
    const amount = parseInt(document.getElementById('donorAmount').value) || 0;
    const date = document.getElementById('donorDate').value || new Date().toISOString().slice(0, 10);
    const category = document.getElementById('donorCategory').value;
    const notes = (document.getElementById('donorNotes').value || '').trim();

    if (!name) { alert('Isi nama donatur!'); return; }
    if (!amount || amount <= 0) { alert('Isi nominal yang valid!'); return; }

    socket.emit('add-donor', { name, phone, amount, date, category, notes });

    document.getElementById('donorName').value = '';
    document.getElementById('donorPhone').value = '';
    document.getElementById('donorAmount').value = '';
    document.getElementById('donorDate').value = '';
    document.getElementById('donorNotes').value = '';
}

function removeDonor(id) {
    if (confirm('Hapus data donatur ini?')) socket.emit('remove-donor', id);
}

function filterDonors() { renderDonors(); }

function exportDonorPDF() { window.open('/api/donors/export/pdf', '_blank'); }
function exportDonorXLSX() { window.open('/api/donors/export/xlsx', '_blank'); }

function renderDonors() {
    const tbody = document.getElementById('donorTableBody');
    if (!tbody) return;

    const year = document.getElementById('donorYearFilter')?.value || 'all';

    // Populate year filter
    const years = [...new Set(donorsData.map(d => d.year))].sort((a, b) => b - a);
    const yearSelect = document.getElementById('donorYearFilter');
    if (yearSelect) {
        const currentVal = yearSelect.value;
        yearSelect.innerHTML = '<option value="all">Semua</option>' +
            years.map(y => `<option value="${y}" ${currentVal == y ? 'selected' : ''}>${y}</option>`).join('');
    }

    let filtered = donorsData;
    if (year !== 'all') filtered = donorsData.filter(d => String(d.year) === String(year));

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Belum ada data donatur.</td></tr>';
        return;
    }

    const categoryLabels = {
        donasi: 'Donasi',
        pembelian: 'Pembelian',
        wisata: 'Paket Wisata',
        pelatihan: 'Pelatihan',
        gathering: 'Gathering'
    };

    tbody.innerHTML = filtered.map(d => {
        const amountStr = 'Rp ' + d.amount.toLocaleString('id-ID');
        const dateStr = new Date(d.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const cat = categoryLabels[d.category] || d.category;
        return `<tr>
            <td><strong>${escapeHtml(d.name)}</strong></td>
            <td style="font-family:monospace;font-size:13px">${escapeHtml(d.phone || '-')}</td>
            <td><span class="donor-badge donor-cat-${d.category}">${cat}</span></td>
            <td style="font-weight:600;color:var(--green)">${amountStr}</td>
            <td style="font-size:13px;color:var(--text-muted)">${dateStr}</td>
            <td style="font-size:13px;color:var(--text-muted)">${escapeHtml(d.notes || '-')}</td>
            <td><button class="btn-danger-sm" onclick="removeDonor(${d.id})">Hapus</button></td>
        </tr>`;
    }).join('');
}

function renderDonorSummary() {
    const container = document.getElementById('donorSummary');
    if (!container || donorsData.length === 0) {
        if (container) container.innerHTML = '';
        return;
    }

    const years = [...new Set(donorsData.map(d => d.year))].sort((a, b) => b - a);
    const totalAll = donorsData.reduce((sum, d) => sum + (d.amount || 0), 0);

    const yearSummaries = years.map(y => {
        const yearDonors = donorsData.filter(d => d.year === y);
        const total = yearDonors.reduce((sum, d) => sum + (d.amount || 0), 0);
        return `<div class="summary-year-card">
            <div class="summary-year">${y}</div>
            <div class="summary-amount">Rp ${total.toLocaleString('id-ID')}</div>
            <div class="summary-count">${yearDonors.length} transaksi</div>
        </div>`;
    }).join('');

    container.innerHTML = `
        <div class="donor-summary-wrap">
            <div class="summary-total-card">
                <div class="summary-total-label">Total Seluruh Dana</div>
                <div class="summary-total-amount">Rp ${totalAll.toLocaleString('id-ID')}</div>
                <div class="summary-total-sub">${donorsData.length} transaksi dari ${years.length} tahun</div>
            </div>
            <div class="summary-years">${yearSummaries}</div>
        </div>
    `;
}

// ============ TOP DONOR (Period-aware) ============
function renderTopDonor() {
    const card = document.getElementById('topDonorCard');
    if (!card) return;

    const { start, end } = getPeriodRange(currentPeriod);
    const periodDonors = donorsData.filter(d => d.date >= start && d.date <= end);

    if (periodDonors.length === 0) {
        card.style.display = 'none';
        return;
    }

    const sorted = [...periodDonors].sort((a, b) => b.amount - a.amount);
    const top = sorted[0];
    const totalAmount = periodDonors.reduce((s, d) => s + (d.amount || 0), 0);

    const categoryLabels = {
        donasi: 'Donasi', pembelian: 'Pembelian', wisata: 'Paket Wisata',
        pelatihan: 'Pelatihan', gathering: 'Gathering'
    };

    const dateStr = getPeriodLabel(currentPeriod);
    const totalStr = 'Rp' + totalAmount.toLocaleString('id-ID');

    document.getElementById('topDonorDate').textContent = dateStr + ' — ' + periodDonors.length + ' donatur';
    document.getElementById('topDonorAmount').textContent = totalStr;
    document.getElementById('topDonorName').textContent = top.name;
    document.getElementById('topDonorMeta').textContent =
        'Rp' + top.amount.toLocaleString('id-ID') + ' — ' + (categoryLabels[top.category] || top.category) +
        (top.notes ? ' — ' + top.notes : '');

    const listEl = document.getElementById('topDonorList');
    if (sorted.length > 1) {
        listEl.innerHTML = sorted.slice(1).map(d =>
            `<div class="td-row">
                <span class="td-row-name">${escapeHtml(d.name)}</span>
                <span class="td-row-cat">${categoryLabels[d.category] || d.category}</span>
                <span class="td-row-amount">Rp${d.amount.toLocaleString('id-ID')}</span>
            </div>`
        ).join('');
    } else {
        listEl.innerHTML = '';
    }

    card.style.display = 'flex';
}

// ============ NEW USERS ============
function renderNewUsers() {
    const countEl = document.getElementById('newUsersCount');
    const bodyEl = document.getElementById('newUsersBody');
    if (!countEl || !bodyEl) return;

    countEl.textContent = newUsersData.length;

    if (!newUsersData || newUsersData.length === 0) {
        bodyEl.innerHTML = '<div class="empty-state">Belum ada user baru.</div>';
        return;
    }

    bodyEl.innerHTML = newUsersData.slice(0, 10).map(u => {
        const date = new Date(u.time);
        const timeStr = date.toLocaleString('id-ID', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
        });
        const initial = (u.name || '?').charAt(0).toUpperCase();
        const phoneDisplay = u.id.length > 8 ? u.id.slice(0, 4) + '****' + u.id.slice(-3) : u.id;
        return `<div class="nu-item">
            <div class="nu-avatar">${escapeHtml(initial)}</div>
            <div class="nu-info">
                <div class="nu-name">${escapeHtml(u.name)}</div>
                <div class="nu-phone">${escapeHtml(phoneDisplay)}</div>
            </div>
            <div class="nu-time">${timeStr}</div>
        </div>`;
    }).join('');
}

// ============ UTILS ============
// ============ QR CODE MODAL ============
function updateWaBadge(status) {
    const btn  = document.getElementById('waBadge');
    const dot  = document.getElementById('waBadgeDot');
    const text = document.getElementById('waBadgeText');
    if (!btn) return;

    btn.classList.remove('wa-ready', 'wa-qr');

    if (status === 'ready') {
        dot.className = 'status-dot green';
        text.textContent = 'WhatsApp Online';
        btn.classList.add('wa-ready');
        btn.title = 'WhatsApp terhubung';
        waConnected = true;
    } else if (status === 'qr') {
        dot.className = 'status-dot orange';
        text.textContent = 'Scan QR';
        btn.classList.add('wa-qr');
        btn.title = 'Klik untuk scan QR WhatsApp';
        waConnected = false;
    } else {
        dot.className = 'status-dot red';
        text.textContent = 'WhatsApp Offline';
        btn.title = 'WhatsApp tidak terhubung';
        waConnected = false;
        showWaOfflineAlert();
    }
}

function showQrModal(qr) {
    const modal = document.getElementById('qrModal');
    const canvas = document.getElementById('qrCodeCanvas');
    const badge  = document.getElementById('qrStatusBadge');
    if (!modal || !canvas) return;

    canvas.innerHTML = '';
    new QRCode(canvas, {
        text: qr,
        width: 250,
        height: 250,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M,
    });

    if (badge) { badge.className = 'qr-status-badge qr-waiting'; badge.textContent = 'Menunggu scan...'; }
    modal.style.display = 'flex';
}

function openQrModal() {
    if (waConnected) return;
    if (currentQr) {
        showQrModal(currentQr);
    } else {
        const modal = document.getElementById('qrModal');
        const canvas = document.getElementById('qrCodeCanvas');
        if (!modal || !canvas) return;
        canvas.innerHTML = '<p style="color:#8b949e;font-size:13px;padding:80px 20px;">QR belum tersedia.<br>Bot sedang memulai...</p>';
        modal.style.display = 'flex';
    }
}

function closeQrModal() {
    const modal = document.getElementById('qrModal');
    if (modal) modal.style.display = 'none';
}

function handleQrOverlayClick(e) {
    if (e.target === document.getElementById('qrModal')) closeQrModal();
}

function renderDashboardQr(status, qr) {
    const card   = document.getElementById('dashQrCard');
    const canvas = document.getElementById('dashQrCanvas');
    const badge  = document.getElementById('dashQrBadge');
    if (!card) return;

    if (status === 'ready') {
        card.style.display = 'none';
        dashQrInstance = null;
        return;
    }

    card.style.display = 'flex';

    if (status === 'qr' && qr) {
        canvas.innerHTML = '';
        dashQrInstance = new QRCode(canvas, {
            text: qr,
            width: 220,
            height: 220,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M,
        });
        if (badge) { badge.className = 'dash-qr-badge dash-qr-ready'; badge.textContent = 'QR siap — arahkan kamera WhatsApp ke gambar ini'; }
    } else if (status === 'qr' && !qr) {
        canvas.innerHTML = '<div class="dash-qr-loading"><span>Memuat QR code...</span></div>';
        if (badge) { badge.className = 'dash-qr-badge'; badge.textContent = 'Memuat QR code...'; }
    } else {
        canvas.innerHTML = '<div class="dash-qr-loading"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"><rect x="3" y="3" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/><rect x="3" y="16" width="5" height="5"/><path d="M21 16h-3v3"/><path d="M21 21v.01"/><path d="M12 7v3h3"/><path d="M12 12v.01"/><path d="M12 21v-3"/><path d="M15 21h3v-3"/></svg><span>Bot sedang memulai...</span></div>';
        if (badge) { badge.className = 'dash-qr-badge dash-qr-offline'; badge.textContent = 'WhatsApp offline — menunggu koneksi...'; }
    }
}

function setQrConnected() {
    const badge = document.getElementById('qrStatusBadge');
    if (badge) { badge.className = 'qr-status-badge qr-connected'; badge.textContent = 'Terhubung! Menutup...'; }
    setTimeout(closeQrModal, 1500);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============ BLAST TAB ============
function switchBlastTab(tab, el) {
    document.querySelectorAll('#page-blast .faq-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('blast-panel-group').style.display = tab === 'group' ? 'block' : 'none';
    document.getElementById('blast-panel-personal').style.display = tab === 'personal' ? 'block' : 'none';
    if (tab === 'personal') { renderCampaigns(); renderCampaignStats(); }
}

// ============ CONTACTS ============
function updateContactPreview() {
    const name = (document.getElementById('contactName')?.value || '').trim();
    const phone = (document.getElementById('contactPhone')?.value || '').trim();
    const label = (document.getElementById('contactLabel')?.value || '').trim();

    document.getElementById('previewName').textContent = name || '—';
    document.getElementById('previewPhone').textContent = phone || '—';
    document.getElementById('previewLabel').textContent = label || '—';

    if (phone) {
        let p = phone.replace(/[\s\-\+\(\)]/g, '');
        if (p.startsWith('0')) p = '62' + p.slice(1);
        if (!p.startsWith('62')) p = '62' + p;
        document.getElementById('previewWaId').textContent = p + '@c.us';
    } else {
        document.getElementById('previewWaId').textContent = '—';
    }
}

function renderContacts() {
    const tbody = document.getElementById('contactsTableBody');
    if (!tbody) return;

    const search = (document.getElementById('contactSearch')?.value || '').toLowerCase();
    const labelFilter = document.getElementById('contactLabelFilter')?.value || 'all';

    const allLabels = [...new Set(contactsData.map(c => c.label).filter(Boolean))].sort();

    const labelSel = document.getElementById('contactLabelFilter');
    if (labelSel) {
        const cur = labelSel.value;
        labelSel.innerHTML = '<option value="all">Semua Label</option>' +
            allLabels.map(l => `<option value="${l}" ${cur === l ? 'selected' : ''}>${escapeHtml(l)}</option>`).join('');
    }

    // Update datalist for contactLabel input
    const dl = document.getElementById('existingLabelsList');
    if (dl) dl.innerHTML = allLabels.map(l => `<option value="${escapeHtml(l)}">`).join('');

    let filtered = contactsData;
    if (labelFilter !== 'all') filtered = filtered.filter(c => c.label === labelFilter);
    if (search) filtered = filtered.filter(c =>
        (c.name || '').toLowerCase().includes(search) ||
        (c.phone || '').includes(search) ||
        (c.label || '').toLowerCase().includes(search)
    );

    const totalEl = document.getElementById('contactsTotalCount');
    if (totalEl) totalEl.textContent = `${contactsData.length} kontak total`;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state">${contactsData.length === 0 ? 'Belum ada kontak. Klik "Tambah Nomor".' : 'Tidak ada kontak cocok.'}</td></tr>`;
        updateContactSelectionBar();
        return;
    }

    tbody.innerHTML = filtered.map(c => {
        const initial = (c.name || '?').charAt(0).toUpperCase();
        const checked = selectedContacts.has(c.id) ? 'checked' : '';
        const phoneDisplay = (c.phone || '').length > 8
            ? c.phone.slice(0, 5) + '****' + c.phone.slice(-3)
            : c.phone;
        return `<tr>
            <td><input type="checkbox" class="contact-checkbox" value="${c.id}" ${checked} onchange="toggleContact(${c.id})"></td>
            <td>
                <div class="group-name-cell">
                    <div class="group-avatar">${escapeHtml(initial)}</div>
                    <span>${escapeHtml(c.name)}</span>
                </div>
            </td>
            <td style="font-family:monospace;font-size:13px">${escapeHtml(phoneDisplay)}</td>
            <td>${c.label ? `<span class="faq-badge" style="font-size:11px">${escapeHtml(c.label)}</span>` : '<span style="color:var(--text-muted);font-size:12px">—</span>'}</td>
            <td style="display:flex;gap:6px;justify-content:flex-end">
                <button class="btn-outline-sm" onclick="openEditContactModal(${c.id})" title="Edit">✏️</button>
                <button class="btn-danger-sm" onclick="removeContact(${c.id})">Hapus</button>
            </td>
        </tr>`;
    }).join('');

    updateContactSelectionBar();
}

function filterContacts() { renderContacts(); }

function toggleContact(id) {
    if (selectedContacts.has(id)) selectedContacts.delete(id);
    else selectedContacts.add(id);
    updateContactSelectionBar();
    const allIds = contactsData.map(c => c.id);
    document.getElementById('selectAllContacts').checked = allIds.every(id => selectedContacts.has(id));
}

function toggleSelectAllContacts() {
    const checked = document.getElementById('selectAllContacts').checked;
    if (checked) contactsData.forEach(c => selectedContacts.add(c.id));
    else selectedContacts.clear();
    renderContacts();
}

function updateContactSelectionBar() {
    const bar = document.getElementById('contactSelectionBar');
    const count = selectedContacts.size;
    const el = document.getElementById('contactSelectedCount');
    if (el) el.textContent = count;
    if (bar) bar.classList.toggle('visible', count > 0);
}

function blastSelectedContacts() {
    if (selectedContacts.size === 0) return;
    navigateTo('blast');
    setTimeout(() => {
        const tab = document.querySelector('#page-blast .faq-tab:nth-child(2)');
        if (tab) switchBlastTab('personal', tab);
        openNewCampaignModal();
    }, 100);
}

// ============ CONTACT MODAL ============
function openAddContactModal() {
    document.getElementById('contactEditId').value = '';
    document.getElementById('contactName').value = '';
    document.getElementById('contactPhone').value = '';
    document.getElementById('contactLabel').value = '';
    document.getElementById('contactModalTitle').textContent = 'Tambah Nomor';
    document.getElementById('contactModalBtn').textContent = 'Tambah Nomor';
    updateContactPreview();
    document.getElementById('contactModal').style.display = 'flex';
    setTimeout(() => document.getElementById('contactName').focus(), 100);
}

function openEditContactModal(id) {
    const c = contactsData.find(x => x.id === id);
    if (!c) return;
    document.getElementById('contactEditId').value = id;
    document.getElementById('contactName').value = c.name || '';
    document.getElementById('contactPhone').value = c.phone || '';
    document.getElementById('contactLabel').value = c.label || '';
    document.getElementById('contactModalTitle').textContent = 'Edit Kontak';
    document.getElementById('contactModalBtn').textContent = 'Simpan Perubahan';
    updateContactPreview();
    document.getElementById('contactModal').style.display = 'flex';
}

function closeContactModal() {
    document.getElementById('contactModal').style.display = 'none';
}

function handleContactModalOverlay(e) {
    if (e.target === document.getElementById('contactModal')) closeContactModal();
}

function submitContact() {
    const editId = document.getElementById('contactEditId').value;
    const name = (document.getElementById('contactName').value || '').trim();
    const phone = (document.getElementById('contactPhone').value || '').trim();
    const label = (document.getElementById('contactLabel').value || '').trim();

    if (!name) { showToast('Validasi', 'Nama harus diisi', '⚠️'); return; }
    if (!phone) { showToast('Validasi', 'Nomor WA harus diisi', '⚠️'); return; }

    if (editId) {
        socket.emit('edit-contact', { id: parseInt(editId), name, phone, label });
        showToast('Kontak diperbarui', name, '✅');
    } else {
        socket.emit('add-contact', { name, phone, label });
        showToast('Kontak ditambahkan', name, '✅');
    }
    closeContactModal();
}

function removeContact(id) {
    const c = contactsData.find(x => x.id === id);
    if (confirm(`Hapus kontak "${c?.name || ''}"?`)) {
        socket.emit('remove-contact', id);
        selectedContacts.delete(id);
    }
}

// ============ CAMPAIGN (BLAST PERSONAL) ============
function renderCampaignStats() {
    const total = campaignsData.length;
    const scheduled = campaignsData.filter(c => c.status === 'scheduled').length;
    const done = campaignsData.filter(c => c.status === 'done').length;
    const recipients = campaignsData.reduce((s, c) => s + (c.sentCount || 0), 0);

    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    el('bpTotal', total);
    el('bpScheduled', scheduled);
    el('bpDone', done);
    el('bpRecipients', recipients);

    const info = document.getElementById('bpCountInfo');
    if (info) info.textContent = total > 0 ? `Menampilkan ${total} blasting` : '';
}

function renderCampaigns() {
    const tbody = document.getElementById('campaignTableBody');
    if (!tbody) return;

    const search = (document.getElementById('campaignSearch')?.value || '').toLowerCase();
    const filtered = search
        ? campaignsData.filter(c => (c.name || '').toLowerCase().includes(search))
        : campaignsData;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state">${campaignsData.length === 0 ? 'Belum ada blasting. Klik "Buat Blasting Baru".' : 'Tidak ada blasting cocok.'}</td></tr>`;
        return;
    }

    const statusBadge = (s) => {
        const map = {
            running:   '<span class="camp-badge camp-running">⏳ Berjalan</span>',
            done:      '<span class="camp-badge camp-done">✅ Selesai</span>',
            scheduled: '<span class="camp-badge camp-scheduled">⏰ Terjadwal</span>',
            failed:    '<span class="camp-badge camp-failed">❌ Gagal</span>',
        };
        return map[s] || `<span class="camp-badge">${s}</span>`;
    };

    tbody.innerHTML = filtered.map(c => {
        const created = c.createdAt ? new Date(c.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
        const schedule = c.scheduledAt
            ? new Date(c.scheduledAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
            : 'Terkirim langsung';
        const labelBadge = c.targetLabel
            ? `<span class="faq-badge" style="font-size:11px">${escapeHtml(c.targetLabel)}</span>`
            : '<span style="color:var(--text-muted);font-size:12px">Semua</span>';
        const progress = c.status === 'running' && c.totalTarget > 0
            ? `<div class="camp-progress-bar"><div class="camp-progress-fill" style="width:${Math.round((c.sentCount/c.totalTarget)*100)}%"></div></div>`
            : '';

        return `<tr>
            <td>
                <div style="font-weight:600;font-size:13px">${escapeHtml(c.name)}</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Dibuat ${created}</div>
                ${progress}
            </td>
            <td>${labelBadge}</td>
            <td style="font-size:12px;color:var(--text-muted)">${escapeHtml(schedule)}</td>
            <td>${statusBadge(c.status)}</td>
            <td style="text-align:center;font-weight:600;font-size:14px">${c.sentCount || 0}${c.totalTarget ? `<span style="font-size:11px;font-weight:400;color:var(--text-muted)"> /${c.totalTarget}</span>` : ''}</td>
            <td style="text-align:center">
                <div style="display:flex;gap:6px;justify-content:center">
                    ${c.status !== 'running' ? `<button class="btn-outline-sm" onclick="rerunCampaign(${c.id})" title="Kirim Ulang">▶</button>` : ''}
                    <button class="btn-danger-sm" onclick="deleteCampaign(${c.id})">🗑</button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function rerunCampaign(id) {
    if (!confirm('Kirim ulang blasting ini?')) return;
    socket.emit('run-campaign', id);
    showToast('Blast diulang', 'Proses pengiriman dimulai...', '🔄');
}

function deleteCampaign(id) {
    const c = campaignsData.find(x => x.id === id);
    if (c?.status === 'running') { showToast('Tidak bisa dihapus', 'Blasting sedang berjalan', '⚠️'); return; }
    if (confirm(`Hapus blasting "${c?.name || ''}"?`)) socket.emit('delete-campaign', id);
}

// ============ CAMPAIGN MODAL ============
function openNewCampaignModal() {
    cmSelectedLabel = null;
    document.getElementById('cmName').value = '';
    document.getElementById('cmMessage').value = '';
    document.getElementById('cmCharCount').textContent = '0';
    document.querySelector('input[name="cmSpeed"][value="8000"]').checked = true;
    document.querySelector('input[name="cmSchedule"][value="now"]').checked = true;
    document.getElementById('cmScheduleTimeWrap').style.display = 'none';
    renderCampaignLabelGrid();

    document.getElementById('campaignStep1').style.display = 'block';
    document.getElementById('campaignStep2').style.display = 'none';
    document.getElementById('cmStepDot1').classList.add('active');
    document.getElementById('cmStepDot2').classList.remove('active');
    document.getElementById('campaignModal').style.display = 'flex';
    setTimeout(() => document.getElementById('cmName').focus(), 100);
}

function closeCampaignModal() {
    document.getElementById('campaignModal').style.display = 'none';
}

function handleCampaignModalOverlay(e) {
    if (e.target === document.getElementById('campaignModal')) closeCampaignModal();
}

function renderCampaignLabelGrid() {
    const grid = document.getElementById('cmLabelGrid');
    if (!grid) return;
    const allLabels = [...new Set(contactsData.map(c => c.label).filter(Boolean))].sort();
    const allCount = contactsData.length;

    let html = `<div class="cm-label-chip ${cmSelectedLabel === null ? 'active' : ''}" onclick="selectCampaignLabel(null)">
        <div class="cm-label-chip-name">Semua Kontak</div>
        <div class="cm-label-chip-count">${allCount} kontak</div>
    </div>`;

    html += allLabels.map(l => {
        const cnt = contactsData.filter(c => c.label === l).length;
        return `<div class="cm-label-chip ${cmSelectedLabel === l ? 'active' : ''}" onclick="selectCampaignLabel('${escapeHtml(l)}')">
            <div class="cm-label-chip-name">${escapeHtml(l)}</div>
            <div class="cm-label-chip-count">${cnt} kontak</div>
        </div>`;
    }).join('');

    if (allLabels.length === 0) {
        html += `<div style="font-size:12px;color:var(--text-muted);padding:8px;grid-column:1/-1">
            Belum ada label. <a href="#" onclick="navigateTo('contacts');closeCampaignModal();return false;" style="color:var(--primary)">Tambah kontak dengan label</a>
        </div>`;
    }

    grid.innerHTML = html;
}

function selectCampaignLabel(label) {
    cmSelectedLabel = label;
    renderCampaignLabelGrid();
}

function campaignNextStep() {
    const name = (document.getElementById('cmName').value || '').trim();
    const msg = (document.getElementById('cmMessage').value || '').trim();
    if (!name) { showToast('Validasi', 'Nama blasting harus diisi', '⚠️'); return; }
    if (!msg) { showToast('Validasi', 'Pesan blast harus diisi', '⚠️'); return; }

    document.getElementById('campaignStep1').style.display = 'none';
    document.getElementById('campaignStep2').style.display = 'block';
    document.getElementById('cmStepDot1').classList.remove('active');
    document.getElementById('cmStepDot2').classList.add('active');
}

function campaignPrevStep() {
    document.getElementById('campaignStep2').style.display = 'none';
    document.getElementById('campaignStep1').style.display = 'block';
    document.getElementById('cmStepDot2').classList.remove('active');
    document.getElementById('cmStepDot1').classList.add('active');
}

function toggleCampaignSchedule() {
    const val = document.querySelector('input[name="cmSchedule"]:checked')?.value;
    document.getElementById('cmScheduleTimeWrap').style.display = val === 'later' ? 'block' : 'none';
    const nowCard = document.getElementById('cmSchedNowCard');
    const laterCard = document.getElementById('cmSchedLaterCard');
    if (nowCard) nowCard.style.borderColor = val === 'now' ? 'var(--primary)' : 'var(--border)';
    if (laterCard) laterCard.style.borderColor = val === 'later' ? 'var(--primary)' : 'var(--border)';
}

function submitCampaign() {
    const name = (document.getElementById('cmName').value || '').trim();
    const message = (document.getElementById('cmMessage').value || '').trim();
    const speedDelay = parseInt(document.querySelector('input[name="cmSpeed"]:checked')?.value || '8000');
    const scheduleMode = document.querySelector('input[name="cmSchedule"]:checked')?.value || 'now';
    const scheduledAt = scheduleMode === 'later'
        ? (document.getElementById('cmScheduleTime').value ? new Date(document.getElementById('cmScheduleTime').value).toISOString() : null)
        : null;

    if (scheduleMode === 'later' && !scheduledAt) {
        showToast('Validasi', 'Pilih waktu penjadwalan', '⚠️');
        return;
    }

    const targetLabel = cmSelectedLabel;
    const count = targetLabel ? contactsData.filter(c => c.label === targetLabel).length : contactsData.length;
    if (count === 0) {
        showToast('Tidak ada penerima', 'Tambah kontak terlebih dahulu di halaman Kontak', '⚠️');
        return;
    }

    const label = targetLabel ? `label "${targetLabel}"` : 'semua kontak';

    // Tutup modal dulu agar confirm() tidak tertutup backdrop blur
    closeCampaignModal();
    setTimeout(() => {
        if (!confirm(`Mulai blasting "${name}" ke ${count} kontak (${label})?`)) return;
        socket.emit('create-campaign', { name, message, targetLabel, speedDelay, scheduledAt });
    }, 180);
}

// ============ MONITORING CHAT ============
function getLabelChipHtml(label) {
    if (!label) return '';
    const colors = [
        'background:rgba(99,102,241,.15);color:#a78bfa',
        'background:rgba(239,68,68,.13);color:#f87171',
        'background:rgba(245,158,11,.13);color:#fbbf24',
        'background:rgba(16,185,129,.13);color:#34d399',
        'background:rgba(59,130,246,.13);color:#60a5fa',
        'background:rgba(236,72,153,.13);color:#f472b6',
    ];
    let h = 0;
    for (let i = 0; i < label.length; i++) h = label.charCodeAt(i) + ((h << 5) - h);
    const s = colors[Math.abs(h) % colors.length];
    return `<span class="mc-chip" style="${s}">${escapeHtml(label)}</span>`;
}

function renderConvList() {
    const container = document.getElementById('monitorConvList');
    if (!container) return;

    const search = (document.getElementById('monitorSearch')?.value || '').toLowerCase();
    const labelFilter = document.getElementById('monitorLabelFilter')?.value || 'all';

    const convArr = Object.values(conversationsData)
        .sort((a, b) => (b.lastTime || '') > (a.lastTime || '') ? 1 : -1);

    // Update stats
    const allIds = new Set(convArr.map(c => c.id));
    const contactedCount = convArr.length;
    const pendingCount = contactsData.filter(c => !allIds.has(c.id)).length;
    const el1 = document.getElementById('monitorStatsContacted');
    const el2 = document.getElementById('monitorStatsPending');
    const el3 = document.getElementById('monitorPendingCount');
    if (el1) el1.textContent = contactedCount;
    if (el2) el2.textContent = pendingCount;
    if (el3) el3.textContent = pendingCount;
    const pendingRow = document.getElementById('monitorPendingRow');
    if (pendingRow) pendingRow.style.display = pendingCount > 0 ? 'block' : 'none';

    // Update label filter options
    const labelSel = document.getElementById('monitorLabelFilter');
    if (labelSel && labelSel.options.length <= 1) {
        const labels = [...new Set(contactsData.map(c => c.label).filter(Boolean))];
        labels.forEach(l => {
            if (![...labelSel.options].some(o => o.value === l)) {
                const opt = document.createElement('option');
                opt.value = l; opt.textContent = l;
                labelSel.appendChild(opt);
            }
        });
    }

    // Normalize phone for comparison (0895→62895, strip symbols)
    const normPhone = (p) => String(p || '').replace(/[\s\-\+\(\)\.]/g, '').replace(/^0/, '62');

    // Filter
    let filtered = convArr;
    if (search) filtered = filtered.filter(c =>
        (c.name || '').toLowerCase().includes(search) ||
        (c.lastMsg || '').toLowerCase().includes(search) ||
        normPhone(c.phone || c.id).includes(search.replace(/\D/g, '')));
    if (labelFilter !== 'all') {
        const labelIds = new Set(
            contactsData.filter(c => c.label === labelFilter)
                .map(c => normPhone(c.id || c.phone))
        );
        filtered = filtered.filter(c =>
            labelIds.has(normPhone(c.id)) || labelIds.has(normPhone(c.phone))
        );
    }

    if (filtered.length === 0) {
        const msg = convArr.length > 0
            ? `<div class="empty-state" style="padding:20px 14px;font-size:12px">
                Tidak ditemukan.<br>
                <a href="#" onclick="clearMonitorFilter()" style="color:var(--primary);font-size:11px">Hapus filter</a>
               </div>`
            : `<div class="empty-state" style="padding:28px 16px;font-size:13px">Belum ada percakapan masuk.</div>`;
        container.innerHTML = msg;
        return;
    }

    container.innerHTML = filtered.map(c => {
        const initial = (c.name || '?').charAt(0).toUpperCase();
        const isSelected = c.id === selectedConvId;
        const isBlocked = blockedData.some(b => b.id === c.id);
        const time = c.lastTime ? formatConvTime(c.lastTime) : '';
        const unread = c.unread > 0 ? `<span class="mc-unread-badge">${c.unread}</span>` : '';
        const normP = (p) => String(p||'').replace(/[\s\-\+\(\)\.]/g,'').replace(/^0/,'62');
        const contact = contactsData.find(ct =>
            normP(ct.id||ct.phone) === normP(c.id) || normP(ct.id||ct.phone) === normP(c.phone)
        );
        const labelChip = contact?.label ? getLabelChipHtml(contact.label) : '';
        const statusChip = isBlocked
            ? `<span class="mc-chip mc-chip-block">Diblokir</span>`
            : (c.isHandover ? `<span class="mc-chip mc-chip-cs">CS</span>` : `<span class="mc-chip mc-chip-bot">Bot</span>`);
        const displayName = c.name && c.name !== c.id ? escapeHtml(c.name) : `<span style="color:var(--text-muted);font-style:italic">+${escapeHtml(c.id || '')}</span>`;
        const phoneDisplay = c.phone && c.phone !== c.id ? `<div class="mc-conv-phone">+${escapeHtml(c.phone)}</div>` : '';

        return `<div class="mc-conv-item ${isSelected ? 'active' : ''} ${isBlocked ? 'mc-conv-blocked' : ''}" onclick="selectConversation('${c.id}')">
            <div class="mc-conv-avatar">${escapeHtml(initial)}</div>
            <div class="mc-conv-body">
                <div class="mc-conv-top">
                    <span class="mc-conv-name">${displayName}</span>
                    <span class="mc-conv-time">${time}</span>
                </div>
                ${phoneDisplay}
                <div class="mc-conv-tags">${statusChip}${labelChip}</div>
                <div class="mc-conv-preview">
                    <span class="mc-conv-lastmsg">${escapeHtml((c.lastMsg || 'Belum ada pesan').substring(0, 52))}</span>
                    ${unread}
                </div>
            </div>
        </div>`;
    }).join('');
}

function filterConversations() { renderConvList(); }

function clearMonitorFilter() {
    const s = document.getElementById('monitorSearch'); if (s) s.value = '';
    const l = document.getElementById('monitorLabelFilter'); if (l) l.value = 'all';
    renderConvList();
}

function selectConversation(userId) {
    selectedConvId = userId;
    renderConvList();
    socket.emit('get-conversation', userId);
}

function openConversation(userId) {
    const conv = conversationsData[userId];
    if (!conv) return;

    document.getElementById('mcEmpty').style.display = 'none';
    document.getElementById('mcChatView').style.display = 'flex';

    const initial = (conv.name || '?').charAt(0).toUpperCase();
    document.getElementById('mcAvatar').textContent = initial;
    document.getElementById('mcName').textContent = conv.name || userId;

    const phoneEl = document.getElementById('mcPhone');
    if (phoneEl) phoneEl.textContent = '+' + (conv.phone || userId);

    const csEl = document.getElementById('mcCsAgent');
    if (csEl) csEl.textContent = conv.isHandover ? 'CS Agt: Admin' : 'CS Agt: Bot';

    renderChatMessages(conv.messages || []);
    renderBlastHistory(userId);
    scrollChatToBottom();
    const input = document.getElementById('mcReplyInput');
    if (input) input.focus();
}

function renderBlastHistory(userId) {
    const container = document.getElementById('mcBlastHistory');
    if (!container) return;
    const normPhone = (p) => String(p || '').replace(/[\s\-\+\(\)\.]/g, '').replace(/^0/, '62');
    const conv = conversationsData[userId] || {};
    const convNorm = normPhone(conv.phone || userId);

    const blasts = campaignsData.filter(c => {
        if (!c.targetLabel) return true;
        const targets = contactsData.filter(ct => ct.label === c.targetLabel);
        return targets.some(ct => normPhone(ct.id || ct.phone) === convNorm);
    });

    if (blasts.length === 0) {
        container.innerHTML = '';
        const bar = document.getElementById('mcBlastBar');
        if (bar) bar.style.display = 'none';
        return;
    }

    const bar = document.getElementById('mcBlastBar');
    const toggle = document.getElementById('mcBlastToggle');
    if (bar) bar.style.display = 'flex';
    if (toggle) toggle.textContent = `Riwayat Blast (${blasts.length})`;

    container.innerHTML = blasts.map(b => `
        <div class="mc-blast-item">
            <div class="mc-blast-msg">${escapeHtml((b.message || '').substring(0, 120))}${b.message && b.message.length > 120 ? '...' : ''}</div>
            <div class="mc-blast-meta">
                <span class="mc-blast-name">${escapeHtml(b.name)}</span>
                <span class="camp-badge ${b.status === 'done' ? 'camp-done' : b.status === 'running' ? 'camp-running' : 'camp-scheduled'}">${b.status === 'done' ? 'Selesai' : b.status === 'running' ? 'Berjalan' : 'Terjadwal'}</span>
                <span style="font-size:11px;color:var(--text-muted)">${b.sentCount || 0}/${b.totalTarget || 0} terkirim</span>
            </div>
        </div>`).join('');
}

function toggleMcBlast() {
    const hist = document.getElementById('mcBlastHistory');
    const chev = document.getElementById('mcBlastChevron');
    if (!hist) return;
    const open = hist.style.display !== 'none';
    hist.style.display = open ? 'none' : 'block';
    if (chev) chev.style.transform = open ? '' : 'rotate(180deg)';
}

function filterPendingContacts(e) {
    if (e) e.preventDefault();
    const allIds = new Set(Object.keys(conversationsData));
    // highlight contacts not yet in conv — navigate to Kontak page with filter
    navigateTo('contacts');
    setTimeout(() => {
        const searchEl = document.getElementById('contactSearch');
        if (searchEl) { searchEl.value = ''; }
        showToast('Filter Aktif', 'Menampilkan kontak yang belum dihubungi', 'ℹ️');
    }, 100);
}

function renderChatMessages(messages) {
    const container = document.getElementById('mcMessages');
    if (!container) return;

    if (!messages || messages.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding:40px">Belum ada pesan dalam percakapan ini.</div>';
        return;
    }

    let html = '';
    let lastDate = '';
    messages.forEach(msg => {
        const d = new Date(msg.time);
        const dateStr = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        if (dateStr !== lastDate) {
            html += `<div class="mc-date-divider"><span>${dateStr}</span></div>`;
            lastDate = dateStr;
        }
        const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const isBot = msg.from === 'bot';
        html += `<div class="mc-msg-row ${isBot ? 'mc-msg-bot' : 'mc-msg-user'}">
            <div class="mc-bubble ${isBot ? 'mc-bubble-bot' : 'mc-bubble-user'}">
                <div class="mc-bubble-text">${escapeHtml(msg.content)}</div>
                <div class="mc-bubble-time">${timeStr}</div>
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

function appendChatMessage(msg) {
    if (!msg) return;
    const container = document.getElementById('mcMessages');
    if (!container) return;
    const d = new Date(msg.time);
    const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const isBot = msg.from === 'bot';
    const div = document.createElement('div');
    div.className = `mc-msg-row ${isBot ? 'mc-msg-bot' : 'mc-msg-user'}`;
    div.innerHTML = `<div class="mc-bubble ${isBot ? 'mc-bubble-bot' : 'mc-bubble-user'}">
        <div class="mc-bubble-text">${escapeHtml(msg.content)}</div>
        <div class="mc-bubble-time">${timeStr}</div>
    </div>`;
    container.appendChild(div);
}

function scrollChatToBottom() {
    const container = document.getElementById('mcMessages');
    if (container) setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
}

function sendCsReply() {
    const input = document.getElementById('mcReplyInput');
    const msg = (input?.value || '').trim();
    if (!msg) { showToast('Pesan kosong', 'Ketik pesan dulu ya', '✏️'); return; }
    if (!selectedConvId) { showToast('Pilih kontak', 'Pilih percakapan dulu', '👤'); return; }
    const btn = document.getElementById('mcSendBtn');
    if (btn) btn.disabled = true;
    socket.emit('send-cs-reply', { userId: selectedConvId, message: msg });
    // Auto-recover: aktifkan button lagi setelah 15 detik jika ga ada respon
    setTimeout(() => { const b = document.getElementById('mcSendBtn'); if (b) b.disabled = false; }, 15000);
}

function blockCurrentContact() {
    if (!selectedConvId) return;
    const conv = conversationsData[selectedConvId];
    if (!conv) return;
    if (!confirm(`Blokir kontak "${conv.name || selectedConvId}"? Pesan dari nomor ini tidak akan diproses bot.`)) return;
    socket.emit('block-contact', { id: selectedConvId, name: conv.name, phone: conv.phone, reason: 'Diblokir dari Monitoring Chat' });
    showToast('Kontak diblokir', conv.name || selectedConvId, '🚫');
    renderConvList();
}

function formatConvTime(isoStr) {
    const d = new Date(isoStr);
    const now = new Date();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Kemarin';
    if (diffDays < 7) return d.toLocaleDateString('id-ID', { weekday: 'short' });
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

// ============ BLOCKED CONTACTS ============
function renderBlocked() {
    const tbody = document.getElementById('blockedTableBody');
    if (!tbody) return;

    const search = (document.getElementById('blockedSearch')?.value || '').toLowerCase();
    const filtered = search
        ? blockedData.filter(c => (c.name || '').toLowerCase().includes(search) || (c.phone || '').includes(search))
        : blockedData;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state">${blockedData.length === 0 ? 'Belum ada kontak yang diblokir.' : 'Tidak ditemukan.'}</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(c =>
        `<tr>
            <td><strong>${escapeHtml(c.name || '—')}</strong></td>
            <td style="font-family:monospace;font-size:13px">${escapeHtml(c.phone || c.id)}</td>
            <td style="font-size:13px;color:var(--text-muted)">${escapeHtml(c.blockedAt || '—')}</td>
            <td style="font-size:13px;color:var(--text-muted)">${escapeHtml(c.reason || '—')}</td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="unblockContact('${c.id}')">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>
                    Buka Blokir
                </button>
            </td>
        </tr>`
    ).join('');
}

function filterBlocked() { renderBlocked(); }

function unblockContact(id) {
    const c = blockedData.find(x => x.id === id);
    if (confirm(`Buka blokir "${c?.name || id}"?`)) {
        socket.emit('unblock-contact', id);
        showToast('Blokir dibuka', c?.name || id, '✅');
    }
}
