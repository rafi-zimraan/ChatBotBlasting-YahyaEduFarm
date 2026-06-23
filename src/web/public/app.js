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
    if (data.user) renderProfile(data.user);

    if (data.waStatus) updateWaBadge(data.waStatus);
    if (data.qrCode) { currentQr = data.qrCode; }

    updateStatus(data);
    renderGroups();
    renderStats(data);
    renderBlastHistory();
    renderHoloCards();
});

socket.on('qr', (qr) => {
    currentQr = qr;
    updateWaBadge('qr');
    showQrModal(qr);
});

socket.on('wa-status', (status) => {
    updateWaBadge(status);
    if (status === 'ready') {
        currentQr = null;
        setQrConnected();
        showToast('WhatsApp Terhubung', 'Bot siap menerima pesan', '✅');
    } else if (status === 'disconnected') {
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
        groups: 'Groups',
        blast: 'Blast',
        schedule: 'Jadwal',
        faq: 'FAQ Bot',
        donors: 'Donatur Tetap'
    };
    document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';

    if (page === 'groups') renderGroups();
    if (page === 'schedule') socket.emit('request-schedules');
    if (page === 'faq') socket.emit('request-state');
    if (page === 'dashboard') { setTimeout(() => { renderChart(); renderTodayStats(); renderTopDonor(); renderHoloCards(); renderNewUsers(); }, 50); }
    if (page === 'donors') { renderDonors(); renderDonorSummary(); }
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
}

function isDateInRange(dateStr, start, end) {
    return dateStr >= start && dateStr <= end;
}

function computePeriodSum(period, field) {
    const { start, end } = getPeriodRange(period);
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
    if (!time) { alert('Pilih waktu jadwal!'); return; }
    if (!message) { alert('Tulis pesan untuk jadwal!'); return; }
    socket.emit('add-schedule', { time, message });
    document.getElementById('scheduleMessage').value = '';
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
    container.innerHTML = schedules.map(s =>
        `<div class="schedule-item">
            <div class="schedule-time">${s.time}</div>
            <div class="schedule-msg">
                <span class="msg-text">${escapeHtml(s.message)}</span>
                <span class="schedule-meta">${s.enabled ? 'Aktif' : 'Nonaktif'}</span>
            </div>
            <div class="schedule-actions">
                <label class="toggle-switch">
                    <input type="checkbox" ${s.enabled ? 'checked' : ''} onchange="toggleSchedule('${s.id}', this.checked)">
                    <span class="toggle-slider"></span>
                </label>
                <button class="btn-danger-sm" onclick="removeSchedule('${s.id}')">Hapus</button>
            </div>
        </div>`
    ).join('');

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
