import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDVOFcPfc4Bc4gAEdwZQ-i9VV0KIR1Sudc",
  authDomain: "web-cham-cong-2dfd8.firebaseapp.com",
  databaseURL: "https://web-cham-cong-2dfd8-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "web-cham-cong-2dfd8",
  storageBucket: "web-cham-cong-2dfd8.firebasestorage.app",
  messagingSenderId: "100405631566",
  appId: "1:100405631566:web:0baed9a71a22248c69c11f",
  measurementId: "G-KLTK5C9ETQ"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);



const dNow = new Date();
const todayStr = dNow.getFullYear() + '-' + String(dNow.getMonth() + 1).padStart(2, '0') + '-' + String(dNow.getDate()).padStart(2, '0');
const firstDayStr = todayStr.slice(0, 8) + '01';

const state = {
    role: null, 
    currentDate: todayStr, 
    summaryStartDate: firstDayStr,
    summaryEndDate: todayStr,
    history: {},
    workers: []
};

function ensureDateData(dateStr) {
    if (!state.history[dateStr]) {
        state.history[dateStr] = {
            dailyData: {},
            otData: {},
            dailyStatus: 'NOT_SUBMITTED',
            otStatus: 'NOT_SUBMITTED'
        };
        state.workers.forEach(w => {
            state.history[dateStr].dailyData[w.id] = 0;
            state.history[dateStr].otData[w.id] = 0;
        });
    } else {
        state.workers.forEach(w => {
            if(state.history[dateStr].dailyData[w.id] === undefined) {
                state.history[dateStr].dailyData[w.id] = 0;
            }
            if(state.history[dateStr].otData[w.id] === undefined) {
                state.history[dateStr].otData[w.id] = 0;
            }
        });
    }
}

const app = {
    login() {
        const role = document.getElementById('login-role').value;
        const pin = document.getElementById('login-pin').value;
        
        let valid = false;
        if(role === 'LEADER' && pin === '1111') valid = true;
        if(role === 'SUPERVISOR' && pin === '2222') valid = true;
        if(role === 'PM' && pin === '3333') valid = true;
        
        if(!valid) {
            alert('Mã PIN không đúng!');
            return;
        }
        
        state.role = role;
        document.body.setAttribute('data-role', role);
        document.getElementById('login-overlay').classList.remove('active');
        document.getElementById('app').style.display = 'block';
        
        this.init();
    },

    logout() {
        if(confirm("Bạn muốn đăng xuất?")) {
            location.reload();
        }
    },

    init() {
        document.getElementById('date-picker-daily').value = state.currentDate;
        document.getElementById('summary-start').value = state.summaryStartDate;
        document.getElementById('summary-end').value = state.summaryEndDate;

        const workersRef = ref(db, 'workers');
        onValue(workersRef, (snapshot) => {
            const data = snapshot.val();
            if (!data || data.length === 0) {
                const mockWorkers = [
                    { id: 'W01', name: 'Nguyễn Văn A', role: 'Thợ chính', wage: 60000, isActive: true },
                    { id: 'W02', name: 'Trần Văn B', role: 'Thợ phụ', wage: 45000, isActive: true },
                    { id: 'W03', name: 'Lê Thị C', role: 'Thợ phụ', wage: 45000, isActive: true },
                    { id: 'W04', name: 'Phạm Văn D', role: 'Thợ chính', wage: 60000, isActive: true },
                    { id: 'W05', name: 'Hoàng Văn E', role: 'Thợ phụ', wage: 45000, isActive: true }
                ];
                set(ref(db, 'workers'), mockWorkers);
            } else {
                state.workers = data.filter(w => w !== null); 
                ensureDateData(state.currentDate);
                this.renderDaily();
                this.renderOT();
                this.renderSummary();
                this.renderWorkerSettings();
            }
        });

        const historyRef = ref(db, 'history');
        onValue(historyRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                for (let dateStr in data) {
                    if (!state.history[dateStr]) {
                        state.history[dateStr] = { dailyData: {}, otData: {}, dailyStatus: 'NOT_SUBMITTED', otStatus: 'NOT_SUBMITTED' };
                    }
                    if (data[dateStr].dailyData) state.history[dateStr].dailyData = data[dateStr].dailyData;
                    if (data[dateStr].otData) state.history[dateStr].otData = data[dateStr].otData;
                    if (data[dateStr].dailyStatus) state.history[dateStr].dailyStatus = data[dateStr].dailyStatus;
                    if (data[dateStr].otStatus) state.history[dateStr].otStatus = data[dateStr].otStatus;
                }
            }
            ensureDateData(state.currentDate);
            this.renderDaily();
            this.renderOT();
            this.renderSummary();
            this.updateStatusUI();
        });
    },

    openWorkerModal() {
        document.getElementById('worker-modal').classList.add('active');
        this.renderWorkerSettings();
    },

    closeWorkerModal() {
        document.getElementById('worker-modal').classList.remove('active');
    },

    renderWorkerSettings() {
        const container = document.getElementById('settings-worker-list');
        if(!container) return;
        container.innerHTML = '';
        state.workers.forEach((w, index) => {
            const isInactive = w.isActive === false;
            const opacity = isInactive ? '0.5' : '1';
            const btnHtml = isInactive 
                ? `<button class="btn btn-success" style="padding: 4px 10px; font-size:0.8rem;" onclick="app.restoreWorker(${index})">Khôi phục</button>`
                : `<button class="btn btn-danger" style="padding: 4px 10px; font-size:0.8rem;" onclick="app.deleteWorker(${index})">Cho nghỉ</button>`;

            container.innerHTML += `
                <div class="worker-row-settings" style="opacity: ${opacity};">
                    <div>
                        <strong>${w.name} ${isInactive ? '<span style="color:#ef4444; font-size:0.8rem;">(Đã nghỉ)</span>' : ''}</strong><br>
                        <small style="color:#64748b">${w.role} - ${(w.wage || 50000).toLocaleString('vi-VN')} đ/h</small>
                    </div>
                    ${btnHtml}
                </div>
            `;
        });
    },

    addWorker() {
        const name = document.getElementById('new-worker-name').value.trim();
        const role = document.getElementById('new-worker-role').value;
        const wage = parseInt(document.getElementById('new-worker-wage').value) || 50000;
        if(!name) { alert('Vui lòng nhập tên!'); return; }
        
        const newId = 'W' + new Date().getTime(); 
        const newWorkers = [...state.workers, { id: newId, name: name, role: role, wage: wage, isActive: true }];
        set(ref(db, 'workers'), newWorkers);
        
        document.getElementById('new-worker-name').value = '';
        document.getElementById('new-worker-wage').value = '50000';
    },

    deleteWorker(index) {
        if(!confirm(`Báo nghỉ việc đối với công nhân ${state.workers[index].name}? (Vẫn sẽ được tính lương trong quá khứ)`)) return;
        const newWorkers = [...state.workers];
        newWorkers[index].isActive = false;
        set(ref(db, 'workers'), newWorkers);
    },

    restoreWorker(index) {
        if(!confirm(`Khôi phục làm việc đối với công nhân ${state.workers[index].name}?`)) return;
        const newWorkers = [...state.workers];
        newWorkers[index].isActive = true;
        set(ref(db, 'workers'), newWorkers);
    },

    downloadTemplate() {
        if(!window.XLSX) { alert("Đang tải thư viện Excel, vui lòng thử lại sau."); return; }
        const data = [
            ["Họ và Tên", "Chức danh", "Lương"],
            ["Nguyễn Văn A", "Thợ chính", 60000],
            ["Trần Văn B", "Thợ phụ", 45000]
        ];
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "DanhSach");
        XLSX.writeFile(wb, `Mau_Nhap_Cong_Nhan.xlsx`);
    },

    importExcel(event) {
        const file = event.target.files[0];
        if(!file) return;
        
        if(!window.XLSX) { alert("Thư viện Excel chưa sẵn sàng!"); return; }

        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target.result;
            const wb = XLSX.read(data, {type: 'binary'});
            const ws = wb.Sheets[wb.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(ws);
            
            if(json.length === 0) { alert("File trống!"); return; }
            if(json[0]['Họ và Tên'] === undefined || json[0]['Chức danh'] === undefined || json[0]['Lương'] === undefined) {
                alert("File Excel không đúng định dạng. Vui lòng tải file mẫu và nhập theo đúng tên cột!");
                return;
            }

            if(!confirm(`Phát hiện ${json.length} người trong file Excel. Tiến hành đồng bộ? (Những người trên hệ thống không có trong file này sẽ bị chuyển sang trạng thái Đã Nghỉ Việc)`)) return;

            let newWorkers = [...state.workers];
            // Đặt tất cả thành Inactive tạm thời
            newWorkers.forEach(w => w.isActive = false);

            json.forEach(row => {
                const name = row['Họ và Tên'] ? row['Họ và Tên'].toString().trim() : '';
                if(!name) return;
                const role = row['Chức danh'] ? row['Chức danh'].toString().trim() : 'Thợ phụ';
                const wage = parseInt(row['Lương']) || 50000;
                
                const existingIndex = newWorkers.findIndex(w => w.name.toLowerCase() === name.toLowerCase());
                if(existingIndex >= 0) {
                    newWorkers[existingIndex].isActive = true;
                    newWorkers[existingIndex].role = role;
                    newWorkers[existingIndex].wage = wage;
                } else {
                    const newId = 'W' + new Date().getTime() + Math.floor(Math.random() * 1000);
                    newWorkers.push({ id: newId, name: name, role: role, wage: wage, isActive: true });
                }
            });

            set(ref(db, 'workers'), newWorkers);
            alert("Đã đồng bộ danh sách nhân sự thành công!");
            document.getElementById('excel-upload').value = '';
        };
        reader.readAsBinaryString(file);
    },

    exportExcel() {
        if(!window.XLSX) {
            alert("Đang tải thư viện Excel, vui lòng thử lại sau 2 giây...");
            return;
        }

        const startStr = document.getElementById('summary-start').value;
        const endStr = document.getElementById('summary-end').value;
        
        let totalReg = 0;
        let totalOT = 0;
        const aggregated = {};
        state.workers.forEach(w => aggregated[w.id] = { reg: 0, ot: 0, name: w.name, role: w.role, wage: w.wage || 50000 });

        let current = new Date(startStr);
        let end = new Date(endStr);
        while (current <= end) {
            let dStr = current.toISOString().split('T')[0];
            if (state.history[dStr]) {
                const dayData = state.history[dStr];
                state.workers.forEach(w => {
                    aggregated[w.id].reg += (dayData.dailyData[w.id] || 0);
                    aggregated[w.id].ot += (dayData.otData[w.id] || 0);
                });
            }
            current.setDate(current.getDate() + 1);
        }

        const data = [
            ["BẢNG TỔNG HỢP CHẤM CÔNG VÀ THANH TOÁN LƯƠNG"],
            [`Từ ngày: ${startStr} - Đến ngày: ${endStr}`],
            [],
            ["STT", "Họ và Tên", "Chức danh", "Công Hành chính (Giờ)", "Tăng ca (Giờ)", "Tổng công (Giờ)", "Đơn giá (VNĐ/h)", "Tiền Hành chính", "Tiền Tăng ca (x1.5)", "Tổng cộng (VNĐ)"]
        ];

        let stt = 1;
        let sumMoney = 0;
        state.workers.forEach(w => {
            const rowData = aggregated[w.id];
            if(rowData.reg > 0 || rowData.ot > 0) {
                const totalHours = rowData.reg + rowData.ot;
                const moneyReg = rowData.reg * rowData.wage;
                const moneyOT = rowData.ot * rowData.wage * 1.5;
                const money = moneyReg + moneyOT;
                sumMoney += money;
                data.push([
                    stt++,
                    rowData.name,
                    rowData.role,
                    rowData.reg,
                    rowData.ot,
                    totalHours,
                    rowData.wage,
                    moneyReg,
                    moneyOT,
                    money
                ]);
            }
        });

        data.push([]);
        data.push(["", "", "", "", "", "", "", "", "TỔNG CỘNG:", sumMoney]);

        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Bang_Cong");
        
        const wscols = [{wch:5}, {wch:25}, {wch:15}, {wch:20}, {wch:15}, {wch:15}, {wch:15}, {wch:18}, {wch:18}, {wch:20}];
        ws['!cols'] = wscols;

        XLSX.writeFile(wb, `BangCong_${startStr}_${endStr}.xlsx`);
    },

    saveToFirebase(dateStr) {
        set(ref(db, 'history/' + dateStr), state.history[dateStr]);
    },

    switchTab(pageId, navElement) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        navElement.classList.add('active');

        if (pageId === 'page-daily') this.renderDaily();
        if (pageId === 'page-overtime') this.renderOT();
        if (pageId === 'page-summary') this.renderSummary();
        
        this.updateStatusUI();
    },

    changeDate(newDate) {
        if (!newDate) return;
        state.currentDate = newDate;
        ensureDateData(state.currentDate);
        this.renderDaily();
        this.renderOT();
        this.updateStatusUI();
    },

    renderDaily() {
        const container = document.getElementById('daily-list');
        if(!container) return;
        container.innerHTML = '';
        
        const dateData = state.history[state.currentDate];
        const parts = state.currentDate.split('-');
        document.getElementById('current-date-display-ot').innerText = `${parts[2]}/${parts[1]}/${parts[0]}`;

        let totalPresent = 0;

        state.workers.forEach(w => {
            const currentVal = dateData.dailyData[w.id] || 0;
            // Ẩn nếu đã nghỉ việc VÀ không có chấm công ngày hôm đó
            if (w.isActive === false && currentVal === 0) return;
            
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
        
        document.getElementById('daily-stats').innerHTML = `Sĩ số: <strong>${totalPresent}/${state.workers.length}</strong> đi làm`;
        this.updateStatusUI();
    },

    updateDaily(workerId, hours) {
        const d = state.history[state.currentDate];
        if(d.dailyStatus === 'PM_APPROVED' || d.dailyStatus === 'SUPERVISOR_APPROVED' || d.dailyStatus === 'PENDING') {
            alert('Bảng công đang chờ duyệt hoặc đã duyệt, không thể sửa! Hãy yêu cầu Giám sát trả về nếu cần.');
            this.renderDaily();
            return;
        }
        d.dailyData[workerId] = hours;
        if (hours === 0) d.otData[workerId] = 0;
        this.saveToFirebase(state.currentDate);
    },

    selectAllDaily(hours) {
        const d = state.history[state.currentDate];
        if(d.dailyStatus === 'PM_APPROVED' || d.dailyStatus === 'SUPERVISOR_APPROVED' || d.dailyStatus === 'PENDING') return;
        
        state.workers.forEach(w => {
            d.dailyData[w.id] = hours;
            if(hours === 0) d.otData[w.id] = 0;
        });
        this.saveToFirebase(state.currentDate);
    },

    submitDaily() {
        const d = state.history[state.currentDate];
        if(d.dailyStatus === 'PM_APPROVED' || d.dailyStatus === 'SUPERVISOR_APPROVED') return;
        if(!confirm("Bạn có chắc chắn muốn GỬI bảng công hôm nay cho Giám sát?")) return;
        
        d.dailyStatus = 'PENDING';
        this.saveToFirebase(state.currentDate);
        alert('Đã gửi bảng chấm công ngày ' + state.currentDate + ' cho Giám sát!');
    },

    renderOT() {
        const container = document.getElementById('ot-list');
        if(!container) return;
        container.innerHTML = '';
        
        const d = state.history[state.currentDate];
        let hasWorkers = false;
        
        state.workers.forEach(w => {
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
        if(d.otStatus === 'PM_APPROVED' || d.otStatus === 'SUPERVISOR_APPROVED' || d.otStatus === 'PENDING') {
            alert('Bảng tăng ca đang chờ duyệt hoặc đã duyệt, không thể sửa!');
            return;
        }
        let current = d.otData[workerId] || 0;
        current += delta;
        if (current < 0) current = 0;
        if (current > 12) current = 12; 
        
        d.otData[workerId] = current;
        this.saveToFirebase(state.currentDate);
    },

    submitOT() {
        const d = state.history[state.currentDate];
        if(d.otStatus === 'PM_APPROVED' || d.otStatus === 'SUPERVISOR_APPROVED') return;
        if(!confirm("Bạn có chắc chắn muốn CẬP NHẬT TĂNG CA hôm nay cho Giám sát?")) return;
        
        d.otStatus = 'PENDING';
        this.saveToFirebase(state.currentDate);
        alert('Đã cập nhật giờ tăng ca ngày ' + state.currentDate);
    },

    undoSubmit(type) {
        const d = state.history[state.currentDate];
        if (type === 'daily' && d.dailyStatus === 'PENDING') {
            d.dailyStatus = 'NOT_SUBMITTED'; 
            this.saveToFirebase(state.currentDate);
            alert('Đã THU HỒI bảng công hành chính!');
        } else if (type === 'ot' && d.otStatus === 'PENDING') {
            d.otStatus = 'NOT_SUBMITTED'; 
            this.saveToFirebase(state.currentDate);
            alert('Đã THU HỒI bảng công tăng ca!');
        }
    },

    renderSummary() {
        const startStr = document.getElementById('summary-start').value;
        const endStr = document.getElementById('summary-end').value;
        state.summaryStartDate = startStr;
        state.summaryEndDate = endStr;

        const container = document.getElementById('summary-list');
        if(!container) return;

        if (!startStr || !endStr || startStr > endStr) {
            container.innerHTML = '<p style="text-align:center; padding: 20px;">Vui lòng chọn khoảng thời gian hợp lệ.</p>';
            return;
        }

        let totalReg = 0;
        let totalOT = 0;
        
        const aggregated = {};
        state.workers.forEach(w => aggregated[w.id] = { reg: 0, ot: 0, name: w.name, wage: w.wage || 50000 });

        let current = new Date(startStr);
        let end = new Date(endStr);
        
        while (current <= end) {
            let dStr = current.toISOString().split('T')[0];
            if (state.history[dStr]) {
                const dayData = state.history[dStr];
                state.workers.forEach(w => {
                    aggregated[w.id].reg += (dayData.dailyData[w.id] || 0);
                    aggregated[w.id].ot += (dayData.otData[w.id] || 0);
                });
            }
            current.setDate(current.getDate() + 1);
        }

        container.innerHTML = '';

        state.workers.forEach(w => {
            const data = aggregated[w.id];
            totalReg += data.reg;
            totalOT += data.ot;

            const moneyReg = data.reg * data.wage;
            const moneyOT = data.ot * data.wage * 1.5;
            const personalTotal = moneyReg + moneyOT;
            
            if (data.reg > 0 || data.ot > 0) {
                container.innerHTML += `
                    <div class="worker-card" style="flex-direction:row; align-items:center; background: white; border-bottom: 1px solid var(--border-color); padding: 12px; display: flex; justify-content: space-between;">
                        <div style="flex:1;">
                            <div class="worker-name" style="font-weight:600;">${data.name}</div>
                            <div class="subtitle" style="font-size:0.8rem; color:var(--text-muted);">Thường: ${data.reg}h | Tăng ca: ${data.ot}h</div>
                        </div>
                        <div style="font-weight:700; color:#2563eb;">
                            ${personalTotal.toLocaleString('vi-VN')} đ
                        </div>
                    </div>
                `;
            }
        });

        let totalMoney = 0;
        state.workers.forEach(w => {
            const rowData = aggregated[w.id];
            totalMoney += (rowData.reg * rowData.wage) + (rowData.ot * rowData.wage * 1.5);
        });
        
        document.getElementById('sum-regular-hours').innerText = totalReg;
        document.getElementById('sum-ot-hours').innerText = totalOT;
        document.getElementById('sum-total-amount').innerText = totalMoney.toLocaleString('vi-VN') + ' đ';
        
        this.updateStatusUI();
    },

    rejectBySupervisor() {
        const d = state.history[state.currentDate];
        let changed = false;
        if(d.dailyStatus === 'PENDING') { d.dailyStatus = 'REJECTED'; changed = true; }
        if(d.otStatus === 'PENDING') { d.otStatus = 'REJECTED'; changed = true; }
        
        if (changed) {
            this.saveToFirebase(state.currentDate);
            alert('Đã trả về cho Đội trưởng để sửa lại.');
        } else {
            alert('Không có bảng công nào đang "Chờ Duyệt" để trả về.');
        }
    },

    approveBySupervisor() {
        const d = state.history[state.currentDate];
        let changed = false;
        if(d.dailyStatus === 'PENDING' || d.dailyStatus === 'REJECTED') { d.dailyStatus = 'SUPERVISOR_APPROVED'; changed = true; }
        if(d.otStatus === 'PENDING' || d.otStatus === 'REJECTED') { d.otStatus = 'SUPERVISOR_APPROVED'; changed = true; }
        
        if (changed) {
            this.saveToFirebase(state.currentDate);
            alert('Đã duyệt bảng công ngày ' + state.currentDate);
        } else {
            alert('Không có bảng công nào cần duyệt cho ngày này.');
        }
    },

    approveByPM() {
        const d = state.history[state.currentDate];
        let changed = false;
        if(d.dailyStatus === 'SUPERVISOR_APPROVED') { d.dailyStatus = 'PM_APPROVED'; changed = true; }
        if(d.otStatus === 'SUPERVISOR_APPROVED') { d.otStatus = 'PM_APPROVED'; changed = true; }
        
        if (changed) {
            this.saveToFirebase(state.currentDate);
            alert('Đã chốt thanh toán ngày ' + state.currentDate + '!');
        } else {
            alert('Phải chờ Giám sát duyệt trước, hoặc đã chốt rồi.');
        }
    },

    updateStatusUI() {
        if(!state.role) return;
        
        const d = state.history[state.currentDate];
        if (!d) return;

        const banner = document.getElementById('daily-status-banner');
        const text = document.getElementById('daily-status-text');
        const sumBox = document.getElementById('summary-status-text');
        
        const activeTab = document.querySelector('.page.active');
        const activeTabId = activeTab ? activeTab.id : 'page-daily';

        const applyStatusToBox = (status, boxId, typeStr, submitFn, undoFn) => {
            const box = document.getElementById(boxId);
            if (!box) return;
            
            const isTabActive = (boxId === 'daily-action-box' && activeTabId === 'page-daily') || (boxId === 'ot-action-box' && activeTabId === 'page-overtime');
            
            if (isTabActive) banner.className = 'status-banner'; 

            switch(status) {
                case 'NOT_SUBMITTED':
                    if (isTabActive) { text.innerText = 'Chưa gửi'; }
                    box.innerHTML = `
                        <button class="btn btn-primary large shadow-glow" onclick="app.${submitFn}()">
                            Gửi ${typeStr}
                        </button>`;
                    break;
                case 'PENDING':
                    if (isTabActive) { banner.className = 'status-banner pending'; text.innerText = 'Chờ Giám sát duyệt'; }
                    box.innerHTML = `<button class="btn btn-danger large shadow-glow" onclick="${undoFn}">Thu hồi ${typeStr} (Để sửa)</button>`;
                    break;
                case 'REJECTED':
                    if (isTabActive) { banner.className = 'status-banner pending'; banner.style.background = '#fee2e2'; banner.style.color = '#b91c1c'; text.innerText = 'Bị trả về (Cần sửa lại)'; }
                    box.innerHTML = `
                        <button class="btn btn-primary large shadow-glow" onclick="app.${submitFn}()">
                            Gửi lại ${typeStr}
                        </button>`;
                    break;
                case 'SUPERVISOR_APPROVED':
                    if (isTabActive) { banner.className = 'status-banner supervisor_approved'; text.innerText = 'Giám sát đã duyệt'; }
                    box.innerHTML = `<button class="btn large" disabled style="background:#e2e8f0; color:#94a3b8">Đã khóa (Giám sát đã duyệt)</button>`;
                    break;
                case 'PM_APPROVED':
                    if (isTabActive) { banner.className = 'status-banner pm_approved'; text.innerText = 'Đã chốt thanh toán'; }
                    box.innerHTML = `<button class="btn large" disabled style="background:#e2e8f0; color:#94a3b8">Đã khóa (Đã chốt thanh toán)</button>`;
                    break;
            }
        };

        applyStatusToBox(d.dailyStatus, 'daily-action-box', 'Bảng Hành Chính', 'submitDaily', "app.undoSubmit('daily')");
        applyStatusToBox(d.otStatus, 'ot-action-box', 'Tăng Ca', 'submitOT', "app.undoSubmit('ot')");

        if (d.dailyStatus === 'PENDING' || d.otStatus === 'PENDING') sumBox.innerText = 'Chờ Giám sát duyệt';
        else if (d.dailyStatus === 'REJECTED' || d.otStatus === 'REJECTED') sumBox.innerText = 'Bị trả về (Cần sửa lại)';
        else if (d.dailyStatus === 'SUPERVISOR_APPROVED' || d.otStatus === 'SUPERVISOR_APPROVED') sumBox.innerText = 'Giám sát đã duyệt';
        else if (d.dailyStatus === 'PM_APPROVED' || d.otStatus === 'PM_APPROVED') sumBox.innerText = 'ĐÃ CHỐT';
        else sumBox.innerText = 'Chưa gửi';

        const btnReject = document.getElementById('btn-reject-supervisor');
        const btnSup = document.getElementById('btn-approve-supervisor');
        const btnPM = document.getElementById('btn-approve-pm');
        
        const hasPending = (d.dailyStatus === 'PENDING' || d.otStatus === 'PENDING');
        const hasSupApprove = (d.dailyStatus === 'SUPERVISOR_APPROVED' || d.otStatus === 'SUPERVISOR_APPROVED');
        
        if(state.role === 'SUPERVISOR') {
            btnReject.style.display = hasPending ? 'inline-block' : 'none';
            btnSup.style.display = hasPending ? 'inline-block' : 'none';
        } else {
            btnReject.style.display = 'none';
            btnSup.style.display = 'none';
        }

        if(state.role === 'PM') {
            btnPM.style.display = hasSupApprove ? 'inline-block' : 'none';
        } else {
            btnPM.style.display = 'none';
        }
    }
};

window.app = app;
