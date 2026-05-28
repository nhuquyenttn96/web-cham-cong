const WAGE_PER_HOUR = 50000; // 50,000 VNĐ / giờ

const mockWorkers = [
    { id: 'W01', name: 'Nguyễn Văn A', role: 'Thợ chính' },
    { id: 'W02', name: 'Trần Văn B', role: 'Thợ phụ' },
    { id: 'W03', name: 'Lê Thị C', role: 'Thợ phụ' },
    { id: 'W04', name: 'Phạm Văn D', role: 'Thợ chính' },
    { id: 'W05', name: 'Hoàng Văn E', role: 'Thợ phụ' }
];

// Lấy ngày hiện tại
const todayStr = new Date().toISOString().split('T')[0];
// Lấy ngày đầu tháng
const firstDayStr = todayStr.slice(0, 8) + '01';

// Global State
const state = {
    role: 'LEADER', // LEADER | SUPERVISOR | PM
    currentDate: todayStr, 
    summaryStartDate: firstDayStr,
    summaryEndDate: todayStr,
    
    // Lưu trữ theo ngày: 'YYYY-MM-DD': { dailyData, otData, status }
    history: {}
};

// Hàm tiện ích: Đảm bảo dữ liệu của 1 ngày đã được khởi tạo
function ensureDateData(dateStr) {
    if (!state.history[dateStr]) {
        state.history[dateStr] = {
            dailyData: {},
            otData: {},
            status: 'NOT_SUBMITTED' // NOT_SUBMITTED, PENDING, SUPERVISOR_APPROVED, PM_APPROVED, REJECTED
        };
        // Mặc định công nhân 0 tiếng
        mockWorkers.forEach(w => {
            state.history[dateStr].dailyData[w.id] = 0;
            state.history[dateStr].otData[w.id] = 0;
        });
    }
}

// --- CORE APP LOGIC ---
const app = {
    init() {
        // Cài đặt giá trị mặc định cho ô chọn ngày
        document.getElementById('date-picker-daily').value = state.currentDate;
        document.getElementById('summary-start').value = state.summaryStartDate;
        document.getElementById('summary-end').value = state.summaryEndDate;
        
        ensureDateData(state.currentDate);

        this.changeRole(document.getElementById('role-select').value);
        this.renderDaily();
        this.renderOT();
        this.renderSummary();
    },

    changeRole(newRole) {
        state.role = newRole;
        document.body.setAttribute('data-role', newRole);
        this.updateStatusUI();
    },

    switchTab(pageId, navElement) {
        // Hide all pages
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        // Show target
        document.getElementById(pageId).classList.add('active');
        
        // Update nav icons
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        navElement.classList.add('active');

        // Re-render
        if (pageId === 'page-daily') this.renderDaily();
        if (pageId === 'page-overtime') this.renderOT();
        if (pageId === 'page-summary') this.renderSummary();
    },

    changeDate(newDate) {
        if (!newDate) return;
        state.currentDate = newDate;
        ensureDateData(state.currentDate);
        
        // Cập nhật lại UI
        this.renderDaily();
        this.renderOT();
        this.updateStatusUI();
    },

    // --- DAILY ATTENDANCE ---
    renderDaily() {
        const container = document.getElementById('daily-list');
        container.innerHTML = '';
        
        const dateData = state.history[state.currentDate];
        const parts = state.currentDate.split('-');
        document.getElementById('current-date-display-ot').innerText = `${parts[2]}/${parts[1]}/${parts[0]}`;

        let totalPresent = 0;

        mockWorkers.forEach(w => {
            const currentVal = dateData.dailyData[w.id] || 0;
            if(currentVal > 0) totalPresent++;
            
            const initials = w.name.split(' ').map(n=>n[0]).join('').substring(0,2);
            
            const html = `
                <div class="worker-row">
                    <div class="worker-avatar">${initials}</div>
                    <div class="worker-info-compact">
                        <span class="w-name">${w.name}</span>
                        <span class="w-role">${w.role}</span>
                    </div>
                    <div class="segmented-control">
                        <input type="radio" name="daily_${w.id}" id="daily_${w.id}_8" value="8" ${currentVal === 8 ? 'checked' : ''} onchange="app.updateDaily('${w.id}', 8)">
                        <label for="daily_${w.id}_8">8h</label>
                        
                        <input type="radio" name="daily_${w.id}" id="daily_${w.id}_4" value="4" ${currentVal === 4 ? 'checked' : ''} onchange="app.updateDaily('${w.id}', 4)">
                        <label for="daily_${w.id}_4">4h</label>
                        
                        <input type="radio" name="daily_${w.id}" id="daily_${w.id}_0" value="0" ${currentVal === 0 ? 'checked' : ''} onchange="app.updateDaily('${w.id}', 0)">
                        <label for="daily_${w.id}_0">0h</label>
                    </div>
                </div>
            `;
            container.innerHTML += html;
        });
        
        document.getElementById('daily-stats').innerHTML = `Sĩ số: <strong>${totalPresent}/${mockWorkers.length}</strong> đi làm`;
        this.updateStatusUI();
    },

    updateDaily(workerId, hours) {
        const d = state.history[state.currentDate];
        if(d.status === 'PM_APPROVED' || d.status === 'SUPERVISOR_APPROVED' || d.status === 'PENDING') {
            alert('Bảng công đang chờ duyệt hoặc đã duyệt, không thể sửa! Hãy yêu cầu Giám sát trả về nếu cần.');
            this.renderDaily(); // revert UI
            return;
        }
        d.dailyData[workerId] = hours;
        if (hours === 0) d.otData[workerId] = 0;
        this.renderDaily(); // update stats
    },

    selectAllDaily(hours) {
        const d = state.history[state.currentDate];
        if(d.status === 'PM_APPROVED' || d.status === 'SUPERVISOR_APPROVED' || d.status === 'PENDING') return;
        
        mockWorkers.forEach(w => {
            d.dailyData[w.id] = hours;
            if(hours === 0) d.otData[w.id] = 0;
        });
        this.renderDaily();
    },

    submitDaily() {
        const d = state.history[state.currentDate];
        if(d.status === 'PM_APPROVED' || d.status === 'SUPERVISOR_APPROVED') return;
        
        d.status = 'PENDING';
        this.updateStatusUI();
        alert('Đã gửi bảng chấm công ngày ' + state.currentDate + ' cho Giám sát!');
    },

    // --- OVERTIME ---
    renderOT() {
        const container = document.getElementById('ot-list');
        container.innerHTML = '';
        
        const d = state.history[state.currentDate];
        let hasWorkers = false;
        
        mockWorkers.forEach(w => {
            if (d.dailyData[w.id] > 0) {
                hasWorkers = true;
                const currentOT = d.otData[w.id] || 0;
                const initials = w.name.split(' ').map(n=>n[0]).join('').substring(0,2);
                const html = `
                    <div class="worker-row">
                        <div class="worker-avatar">${initials}</div>
                        <div class="worker-info-compact">
                            <span class="w-name">${w.name}</span>
                            <span class="w-role">Hành chính: ${d.dailyData[w.id]}h</span>
                        </div>
                        <div class="ot-control">
                            <button class="ot-btn" onclick="app.updateOT('${w.id}', -0.5)">-</button>
                            <span class="ot-val" id="ot_val_${w.id}">${currentOT}</span>
                            <button class="ot-btn" onclick="app.updateOT('${w.id}', 0.5)">+</button>
                        </div>
                    </div>
                `;
                container.innerHTML += html;
            }
        });

        if (!hasWorkers) {
            container.innerHTML = '<p style="text-align:center; color:#6b7280; padding:20px;">Không có ai đi làm hôm nay để tăng ca.</p>';
        }
    },

    updateOT(workerId, delta) {
        const d = state.history[state.currentDate];
        if(d.status === 'PM_APPROVED' || d.status === 'SUPERVISOR_APPROVED' || d.status === 'PENDING') {
            alert('Bảng công đang chờ duyệt hoặc đã duyệt, không thể sửa!');
            return;
        }
        let current = d.otData[workerId] || 0;
        current += delta;
        if (current < 0) current = 0;
        if (current > 12) current = 12; // sanity check max OT
        
        d.otData[workerId] = current;
        document.getElementById(`ot_val_${workerId}`).innerText = current;
    },

    submitOT() {
        this.submitDaily(); // Tăng ca và Hành chính chung 1 trạng thái ngày
    },

    // --- SUMMARY & APPROVAL ---
    renderSummary() {
        const startStr = document.getElementById('summary-start').value;
        const endStr = document.getElementById('summary-end').value;
        state.summaryStartDate = startStr;
        state.summaryEndDate = endStr;

        if (!startStr || !endStr || startStr > endStr) {
            document.getElementById('summary-list').innerHTML = '<p style="text-align:center; padding: 20px;">Vui lòng chọn khoảng thời gian hợp lệ.</p>';
            return;
        }

        let totalReg = 0;
        let totalOT = 0;
        
        // Gom dữ liệu theo từng công nhân
        const aggregated = {};
        mockWorkers.forEach(w => aggregated[w.id] = { reg: 0, ot: 0, name: w.name });

        // Lặp qua từng ngày trong khoảng
        let current = new Date(startStr);
        let end = new Date(endStr);
        
        while (current <= end) {
            let dStr = current.toISOString().split('T')[0];
            if (state.history[dStr]) {
                const dayData = state.history[dStr];
                mockWorkers.forEach(w => {
                    aggregated[w.id].reg += (dayData.dailyData[w.id] || 0);
                    aggregated[w.id].ot += (dayData.otData[w.id] || 0);
                });
            }
            current.setDate(current.getDate() + 1);
        }

        const container = document.getElementById('summary-list');
        container.innerHTML = '';

        mockWorkers.forEach(w => {
            const data = aggregated[w.id];
            totalReg += data.reg;
            totalOT += data.ot;

            const personalTotal = (data.reg + data.ot) * WAGE_PER_HOUR;
            
            if (data.reg > 0 || data.ot > 0) {
                container.innerHTML += `
                    <div class="worker-card" style="flex-direction:row; align-items:center;">
                        <div style="flex:1;">
                            <div class="worker-name">${data.name}</div>
                            <div class="subtitle">Thường: ${data.reg}h | Tăng ca: ${data.ot}h</div>
                        </div>
                        <div style="font-weight:700; color:#2563eb;">
                            ${personalTotal.toLocaleString('vi-VN')} đ
                        </div>
                    </div>
                `;
            }
        });

        const totalMoney = (totalReg + totalOT) * WAGE_PER_HOUR;
        
        document.getElementById('sum-regular-hours').innerText = totalReg;
        document.getElementById('sum-ot-hours').innerText = totalOT;
        document.getElementById('sum-total-amount').innerText = totalMoney.toLocaleString('vi-VN') + ' đ';
        
        this.updateStatusUI();
    },

    rejectBySupervisor() {
        const d = state.history[state.currentDate];
        if (d.status !== 'PENDING') {
            alert('Chỉ có thể trả về các bảng công đang "Chờ Duyệt".');
            return;
        }
        const confirm = window.confirm('Bạn có chắc muốn TRẢ VỀ bảng công ngày ' + state.currentDate + ' để Đội trưởng sửa lại không?');
        if (confirm) {
            d.status = 'REJECTED';
            this.updateStatusUI();
            alert('Đã trả về cho Đội trưởng.');
        }
    },

    approveBySupervisor() {
        const d = state.history[state.currentDate];
        if (d.status !== 'PENDING') {
            alert('Bảng công chưa được Đội trưởng gửi, hoặc đã duyệt rồi.');
            return;
        }
        d.status = 'SUPERVISOR_APPROVED';
        this.updateStatusUI();
    },

    approveByPM() {
        const d = state.history[state.currentDate];
        if (d.status !== 'SUPERVISOR_APPROVED') {
            alert('Phải chờ Giám sát duyệt trước, hoặc đã chốt rồi.');
            return;
        }
        d.status = 'PM_APPROVED';
        this.updateStatusUI();
        alert('Đã chốt thanh toán ngày ' + state.currentDate + '!');
    },

    updateStatusUI() {
        const d = state.history[state.currentDate];
        if (!d) return;

        const banner = document.getElementById('daily-status-banner');
        const text = document.getElementById('daily-status-text');
        const sumBox = document.getElementById('summary-status-text');
        
        banner.className = 'status-banner'; // reset
        
        switch(d.status) {
            case 'NOT_SUBMITTED':
                text.innerText = 'Chưa gửi';
                sumBox.innerText = 'Đội trưởng chưa gửi';
                break;
            case 'REJECTED':
                banner.classList.add('pending');
                banner.style.background = '#fee2e2';
                banner.style.color = '#b91c1c';
                text.innerText = 'Bị trả về (Cần sửa lại)';
                sumBox.innerText = 'Bị trả về';
                break;
            case 'PENDING':
                banner.classList.add('pending');
                text.innerText = 'Đang chờ duyệt (Giám sát)';
                sumBox.innerText = 'Chờ Giám sát duyệt';
                break;
            case 'SUPERVISOR_APPROVED':
                banner.classList.add('supervisor_approved');
                text.innerText = 'Giám sát đã duyệt. Chờ QLDA chốt.';
                sumBox.innerText = 'Chờ Quản lý chốt';
                break;
            case 'PM_APPROVED':
                banner.classList.add('pm_approved');
                text.innerText = 'Đã chốt lương / Đã thanh toán';
                sumBox.innerText = 'ĐÃ CHỐT THANH TOÁN';
                break;
        }

        // Hide/Show approval buttons based on status & role
        const btnReject = document.getElementById('btn-reject-supervisor');
        const btnSup = document.getElementById('btn-approve-supervisor');
        const btnPM = document.getElementById('btn-approve-pm');
        
        if(state.role === 'SUPERVISOR') {
            btnReject.style.display = (d.status === 'PENDING') ? 'inline-block' : 'none';
            btnSup.style.display = (d.status === 'PENDING') ? 'inline-block' : 'none';
        } else {
            btnReject.style.display = 'none';
            btnSup.style.display = 'none';
        }

        if(state.role === 'PM') {
            btnPM.style.display = (d.status === 'SUPERVISOR_APPROVED') ? 'inline-block' : 'none';
        } else {
            btnPM.style.display = 'none';
        }
    }
};

// Initialize when DOM loads
window.onload = () => {
    app.init();
};
