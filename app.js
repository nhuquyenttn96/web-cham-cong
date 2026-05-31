import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, set, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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
    accounts: [],
    teams: [],
    currentUser: null,
    currentTeam: null,
    
    currentDate: todayStr, 
    summaryStartDate: firstDayStr,
    summaryEndDate: todayStr,
    history: {},
    workers: [],
    payments: [],

    unsubscribeWorkers: null,
    unsubscribeHistory: null,
    unsubscribePayments: null
};

function ensureDateData(dateStr) {
    if (!state.history[dateStr]) {
        state.history[dateStr] = {
            dailyData: {},
            otData: {},
            dailyStatus: 'NOT_SUBMITTED',
            otStatus: 'NOT_SUBMITTED',
            approvedBy: '',
            approvedAt: ''
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
    boot() {
        const accRef = ref(db, 'accounts');
        onValue(accRef, (snapshot) => {
            const data = snapshot.val();
            if (!data) {
                const defaultAccounts = [
                    { id: 'acc_pm', name: 'Quản lý Nguyễn Quang Luận', role: 'PM', pin: '4444' },
                    { id: 'acc_sup', name: 'Giám sát Phạm Anh Võ', role: 'SUPERVISOR', pin: '3333' },
                    { id: 'acc_teamA', name: 'Đội Nguyễn Văn A', role: 'LEADER', pin: '111', teamId: 'teamA' },
                    { id: 'acc_teamB', name: 'Đội Nguyễn Văn B', role: 'LEADER', pin: '222', teamId: 'teamB' }
                ];
                set(ref(db, 'accounts'), defaultAccounts);
            } else {
                state.accounts = Array.isArray(data) ? data.filter(d=>d) : Object.values(data);
                state.teams = state.accounts.filter(a => a.role === 'LEADER');
                this.renderLoginAccounts();
                if(state.currentUser && state.currentUser.role === 'PM') {
                    this.renderAccountSettings();
                }
                if(state.currentUser && state.currentUser.role !== 'LEADER') {
                    this.renderTeamSwitcher();
                }
                if(state.currentUser) {
                    const updatedUser = state.accounts.find(a => a.id === state.currentUser.id);
                    if (updatedUser) state.currentUser = updatedUser;
                    
                    const ud = document.getElementById('user-display');
                    if (ud) ud.innerText = state.currentUser.name;
                    
                    const rd = document.getElementById('role-display');
                    if (rd) rd.innerText = state.currentUser.name;

                    if (state.currentUser.role === 'PM') {
                        this.renderPMWorkerTeamSelector();
                    }
                }
            }
        });
    },

    renderLoginAccounts() {
        const select = document.getElementById('login-account');
        if(!select) return;
        select.innerHTML = '<option value="">-- Chọn Tên của bạn --</option>';
        state.accounts.forEach(acc => {
            select.innerHTML += `<option value="${acc.id}">${acc.name}</option>`;
        });
    },

    login() {
        const accId = document.getElementById('login-account').value;
        const pin = document.getElementById('login-pin').value;
        
        if(!accId) { alert('Vui lòng chọn Tên Tài khoản!'); return; }
        
        const acc = state.accounts.find(a => a.id === accId);
        if(!acc || acc.pin !== pin) {
            alert('Mật khẩu (PIN) không đúng!');
            return;
        }
        
        state.currentUser = acc;
        document.body.setAttribute('data-role', acc.role);
        
        if (acc.role === 'LEADER') {
            state.currentTeam = acc.teamId;
            document.getElementById('team-switcher').style.display = 'none';
        } else {
            state.currentTeam = state.teams.length > 0 ? state.teams[0].teamId : null;
            document.getElementById('team-switcher').style.display = 'block';
            this.renderTeamSwitcher();
        }

        document.getElementById('role-display').innerText = acc.name;
        document.getElementById('login-overlay').classList.remove('active');
        document.getElementById('app').style.display = 'block';
        
        this.initTeamData();
    },

    logout() {
        if(confirm("Bạn muốn đăng xuất?")) {
            location.reload();
        }
    },

    renderTeamSwitcher() {
        const select = document.getElementById('team-switcher');
        if(!select) return;
        select.innerHTML = '';
        state.teams.forEach(t => {
            select.innerHTML += `<option value="${t.teamId}" ${t.teamId === state.currentTeam ? 'selected' : ''}>${t.name}</option>`;
        });
    },

    switchTeam(teamId) {
        state.currentTeam = teamId;
        this.initTeamData();
    },

    initTeamData() {
        if (!state.currentTeam) return;

        if (state.unsubscribeWorkers) state.unsubscribeWorkers();
        if (state.unsubscribeHistory) state.unsubscribeHistory();
        if (state.unsubscribePayments) state.unsubscribePayments();

        state.history = {};
        state.workers = [];
        state.payments = [];

        document.getElementById('date-picker-daily').value = state.currentDate;
        document.getElementById('summary-start').value = state.summaryStartDate;
        document.getElementById('summary-end').value = state.summaryEndDate;

        const workersRef = ref(db, `teams/${state.currentTeam}/workers`);
        state.unsubscribeWorkers = onValue(workersRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                state.workers = data.filter(w => w !== null); 
            } else {
                state.workers = [];
            }
            ensureDateData(state.currentDate);
            this.renderDaily();
            this.renderOT();
            this.renderSummary();
            this.renderWorkerSettings();
            this.renderPaymentTab();
        });

        const historyRef = ref(db, `teams/${state.currentTeam}/history`);
        state.unsubscribeHistory = onValue(historyRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                for (let dateStr in data) {
                    if (!state.history[dateStr]) {
                        state.history[dateStr] = { dailyData: {}, otData: {}, dailyStatus: 'NOT_SUBMITTED', otStatus: 'NOT_SUBMITTED', approvedBy: '', approvedAt: '' };
                    }
                    if (data[dateStr].dailyData) state.history[dateStr].dailyData = data[dateStr].dailyData;
                    if (data[dateStr].otData) state.history[dateStr].otData = data[dateStr].otData;
                    if (data[dateStr].dailyStatus) state.history[dateStr].dailyStatus = data[dateStr].dailyStatus;
                    if (data[dateStr].otStatus) state.history[dateStr].otStatus = data[dateStr].otStatus;
                    if (data[dateStr].approvedBy) state.history[dateStr].approvedBy = data[dateStr].approvedBy;
                    if (data[dateStr].approvedAt) state.history[dateStr].approvedAt = data[dateStr].approvedAt;
                }
            }
            ensureDateData(state.currentDate);
            this.renderDaily();
            this.renderOT();
            this.renderSummary();
            this.updateStatusUI();
            this.renderPaymentTab();
        });

        const paymentsRef = ref(db, `teams/${state.currentTeam}/payments`);
        state.unsubscribePayments = onValue(paymentsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                state.payments = Array.isArray(data) ? data.filter(p=>p) : Object.values(data);
                state.payments.sort((a,b) => b.createdAt - a.createdAt);
            } else {
                state.payments = [];
            }
            this.renderPaymentTab();
        });
    },

    // ACCOUNT MANAGEMENT FOR PM
    showAddAccountModal() {
        document.getElementById('add-account-modal').classList.add('active');
    },

    saveNewAccount() {
        const name = document.getElementById('new-acc-name').value.trim();
        const role = document.getElementById('new-acc-role').value;
        const pin = document.getElementById('new-acc-pin').value.trim();
        if(!name || !pin) { alert("Vui lòng nhập Tên và Mật khẩu!"); return; }

        const id = 'acc_' + new Date().getTime();
        const newAcc = { id, name, role, pin };
        if (role === 'LEADER') {
            newAcc.teamId = 'team_' + new Date().getTime();
        }

        const newAccounts = [...state.accounts, newAcc];
        set(ref(db, 'accounts'), newAccounts).then(() => {
            alert("Đã thêm tài khoản thành công!");
            document.getElementById('add-account-modal').classList.remove('active');
            document.getElementById('new-acc-name').value = '';
            document.getElementById('new-acc-pin').value = '';
        });
    },

    renderAccountSettings() {
        const container = document.getElementById('settings-account-list');
        if(!container) return;
        container.innerHTML = '';
        state.accounts.forEach((acc, index) => {
            container.innerHTML += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding: 10px 0; border-bottom: 1px solid #fdf4ff;">
                    <div>
                        <strong>${acc.name}</strong><br>
                        <small style="color:#64748b">${acc.role === 'PM' ? 'Quản lý' : acc.role === 'SUPERVISOR' ? 'Giám sát' : 'Đội trưởng'} | PIN: <span style="font-family:monospace; background:#e2e8f0; padding:2px 4px; border-radius:4px;">${acc.pin}</span></small>
                    </div>
                    <div style="display:flex; gap: 5px;">
                        <button class="btn btn-warning" style="padding: 4px 8px; font-size:0.75rem;" onclick="app.editAccount(${index})">Sửa</button>
                        ${acc.role !== 'PM' ? `<button class="btn btn-danger" style="padding: 4px 8px; font-size:0.75rem;" onclick="app.deleteAccount(${index})">Xóa</button>` : ''}
                    </div>
                </div>
            `;
        });
    },

    editAccount(index) {
        const acc = state.accounts[index];
        const newName = prompt("Nhập Tên mới cho tài khoản:", acc.name);
        if (newName === null) return;
        const newPin = prompt("Nhập Mã PIN mới (Mật khẩu):", acc.pin);
        if (newPin === null) return;
        
        if (newName.trim() === '' || newPin.trim() === '') {
            alert("Tên và PIN không được để trống!");
            return;
        }

        const newAccounts = [...state.accounts];
        newAccounts[index].name = newName.trim();
        newAccounts[index].pin = newPin.trim();
        
        set(ref(db, 'accounts'), newAccounts).then(() => {
            alert('Cập nhật tài khoản thành công!');
        }).catch(e => {
            alert('Lỗi cập nhật: ' + e.message);
        });
    },

    deleteAccount(index) {
        if(!confirm(`Bạn muốn xóa tài khoản ${state.accounts[index].name}?`)) return;
        const newAccounts = state.accounts.filter((_, i) => i !== index);
        set(ref(db, 'accounts'), newAccounts);
    },

    // WORKER MANAGEMENT
    openWorkerModal() {
        document.getElementById('worker-modal').classList.add('active');
        this.renderWorkerSettings();
        if(state.currentUser && state.currentUser.role === 'PM') {
            document.getElementById('account-management-section').style.display = 'block';
            this.renderAccountSettings();
            this.renderPMWorkerTeamSelector();
        } else {
            document.getElementById('account-management-section').style.display = 'none';
            if(document.getElementById('pm-team-selector-container')) {
                document.getElementById('pm-team-selector-container').style.display = 'none';
            }
        }
    },

    closeWorkerModal() {
        document.getElementById('worker-modal').classList.remove('active');
    },

    renderPMWorkerTeamSelector() {
        const pmTeamSel = document.getElementById('pm-worker-team');
        if(pmTeamSel) {
            const currentVal = pmTeamSel.value || state.currentTeam;
            pmTeamSel.innerHTML = '';
            state.accounts.filter(a => a.role === 'LEADER').forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.teamId;
                opt.textContent = t.name;
                if(t.teamId === currentVal) opt.selected = true;
                pmTeamSel.appendChild(opt);
            });
            document.getElementById('pm-team-selector-container').style.display = 'block';
        }
    },

    renderWorkerSettings() {
        const container = document.getElementById('settings-worker-list');
        if(!container) return;
        container.innerHTML = '';
        state.workers.forEach((w, index) => {
            const isInactive = w.isActive === false;
            const opacity = isInactive ? '0.5' : '1';
            const btnHtml = isInactive 
                ? `<div style="display:flex; gap: 5px;"><button class="btn btn-warning" style="padding: 4px 8px; font-size:0.8rem;" onclick="app.editWorker(${index})">Sửa</button><button class="btn btn-success" style="padding: 4px 8px; font-size:0.8rem;" onclick="app.restoreWorker(${index})">Khôi phục</button><button class="btn" style="padding: 4px 8px; font-size:0.8rem; background:#64748b; color:#fff; border:none;" onclick="app.hardDeleteWorker(${index})">Xóa</button></div>`
                : `<div style="display:flex; gap: 5px;"><button class="btn btn-warning" style="padding: 4px 8px; font-size:0.8rem;" onclick="app.editWorker(${index})">Sửa</button><button class="btn btn-danger" style="padding: 4px 8px; font-size:0.8rem;" onclick="app.deleteWorker(${index})">Cho nghỉ</button><button class="btn" style="padding: 4px 8px; font-size:0.8rem; background:#64748b; color:#fff; border:none;" onclick="app.hardDeleteWorker(${index})">Xóa</button></div>`;

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
        const nameInput = document.getElementById('worker-name');
        const roleInput = document.getElementById('worker-role');
        const wageInput = document.getElementById('worker-wage');
        
        if (!nameInput || !wageInput) {
            alert('Lỗi giao diện thêm người!');
            return;
        }

        const name = nameInput.value.trim();
        const role = roleInput.value;
        const wage = parseInt(wageInput.value) || 500000;
        if(!name) { alert('Vui lòng nhập tên!'); return; }
        
        let targetTeamId = state.currentTeam;
        if(state.currentUser && state.currentUser.role === 'PM') {
            const pmSel = document.getElementById('pm-worker-team');
            if(pmSel && pmSel.value) targetTeamId = pmSel.value;
        }

        const newId = 'W' + new Date().getTime(); 
        
        // Push direct to Firebase to avoid state sync issues across teams
        const workersRef = ref(db, `teams/${targetTeamId}/workers`);
        
        get(workersRef).then((snapshot) => {
            const currentWorkers = snapshot.val() || [];
            const newWorkers = [...currentWorkers, { id: newId, name: name, role: role, wage: wage, isActive: true }];
            set(workersRef, newWorkers).then(() => {
                alert('Thêm công nhân thành công!');
                nameInput.value = '';
                wageInput.value = '';
            });
        });
    },

    deleteWorker(index) {
        if(!confirm(`Báo nghỉ việc đối với công nhân ${state.workers[index].name}? (Vẫn sẽ được tính lương trong quá khứ)`)) return;
        const newWorkers = [...state.workers];
        newWorkers[index].isActive = false;
        set(ref(db, `teams/${state.currentTeam}/workers`), newWorkers);
    },

    restoreWorker(index) {
        if(!confirm(`Khôi phục làm việc đối với công nhân ${state.workers[index].name}?`)) return;
        const newWorkers = [...state.workers];
        newWorkers[index].isActive = true;
        set(ref(db, `teams/${state.currentTeam}/workers`), newWorkers);
    },

    hardDeleteWorker(index) {
        if(!confirm(`Bạn có CHẮC CHẮN muốn XÓA HẲN công nhân ${state.workers[index].name}? (Mất vĩnh viễn dữ liệu của người này!)`)) return;
        const newWorkers = state.workers.filter((_, i) => i !== index);
        set(ref(db, `teams/${state.currentTeam}/workers`), newWorkers);
    },

    editWorker(index) {
        const w = state.workers[index];
        const newName = prompt("Sửa Tên công nhân:", w.name);
        if (newName === null) return;
        const newRole = prompt("Sửa Chức danh (VD: Thợ chính, Thợ phụ):", w.role);
        if (newRole === null) return;
        const newWageStr = prompt("Sửa Lương/ngày (VD: 500000):", w.wage);
        if (newWageStr === null) return;
        
        if (newName.trim() === '' || newRole.trim() === '') {
            alert("Tên và chức danh không được để trống!");
            return;
        }

        const newWorkers = [...state.workers];
        newWorkers[index].name = newName.trim();
        newWorkers[index].role = newRole.trim();
        newWorkers[index].wage = parseInt(newWageStr.trim().replace(/\D/g, '')) || w.wage;
        
        set(ref(db, `teams/${state.currentTeam}/workers`), newWorkers);
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

    async seedWorkers() {
        try {
            const dummyA = [
                { id: 'W1', name: 'Trần Văn Phụ', role: 'Thợ phụ', wage: 300000, isActive: true },
                { id: 'W2', name: 'Lê Văn Chính', role: 'Thợ chính', wage: 500000, isActive: true }
            ];
            const dummyB = [
                { id: 'W3', name: 'Phạm Thị Thợ', role: 'Thợ chính', wage: 550000, isActive: true },
                { id: 'W4', name: 'Hoàng Văn Hồ', role: 'Thợ phụ', wage: 350000, isActive: true }
            ];
            const leaders = state.accounts.filter(a => a.role === 'LEADER');
            if(leaders.length === 0) {
                alert("Không tìm thấy Đội khoán nào để thêm dữ liệu mẫu!");
                return;
            }
            const teamA = leaders[0];
            const teamB = leaders.length > 1 ? leaders[1] : leaders[0];
            
            console.log("Seeding data for:", teamA.name, teamB.name);
            const p1 = teamA ? set(ref(db, `teams/${teamA.teamId}/workers`), dummyA) : Promise.resolve();
            const p2 = teamB ? set(ref(db, `teams/${teamB.teamId}/workers`), dummyB) : Promise.resolve();
            
            await Promise.all([p1, p2]);
            alert("Đã thêm dữ liệu mẫu thành công! Đang tải lại dữ liệu...");
            
            // Re-render
            if (app.renderWorkerSettingsList) app.renderWorkerSettingsList();
            if (app.renderMainList) app.renderMainList();
            
        } catch (err) {
            console.error("Seed Error: ", err);
            alert("Lỗi tạo mẫu: " + err.message);
        }
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

            if(!confirm(`Phát hiện ${json.length} người trong file Excel. Tiến hành đồng bộ cho đội này?`)) return;

            let newWorkers = [...state.workers];
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

            set(ref(db, `teams/${state.currentTeam}/workers`), newWorkers);
            alert("Đã đồng bộ danh sách nhân sự thành công!");
            document.getElementById('excel-upload').value = '';
        };
        reader.readAsBinaryString(file);
    },

    async exportExcel() {
        if(!window.ExcelJS) {
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

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Tong_Hop_Thang');

        // Styles
        const titleStyle = { font: { name: 'Arial', size: 16, bold: true }, alignment: { vertical: 'middle', horizontal: 'center' } };
        const subtitleStyle = { font: { name: 'Arial', size: 11, bold: true, italic: true } };
        const headerStyle = {
            font: { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } },
            alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
            border: {
                top: { style: 'thin' }, left: { style: 'thin' },
                bottom: { style: 'thin' }, right: { style: 'thin' }
            }
        };
        const cellStyle = {
            font: { name: 'Arial', size: 11 },
            alignment: { vertical: 'middle', horizontal: 'center' },
            border: {
                top: { style: 'thin' }, left: { style: 'thin' },
                bottom: { style: 'thin' }, right: { style: 'thin' }
            }
        };
        const moneyStyle = { ...cellStyle, numFmt: '#,##0', alignment: { vertical: 'middle', horizontal: 'right' } };

        // 1. Titles
        ws.mergeCells('A1:J1');
        ws.getCell('A1').value = "BẢNG TỔNG HỢP CHẤM CÔNG VÀ THANH TOÁN LƯƠNG";
        ws.getCell('A1').style = titleStyle;

        ws.mergeCells('A2:J2');
        ws.getCell('A2').value = `Đội: ${state.teams.find(t=>t.teamId === state.currentTeam)?.name || ''}`;
        ws.getCell('A2').style = subtitleStyle;

        ws.mergeCells('A3:J3');
        ws.getCell('A3').value = `Từ ngày: ${startStr} - Đến ngày: ${endStr}`;
        ws.getCell('A3').style = subtitleStyle;
        ws.addRow([]); // Empty row 4

        // 2. Headers
        const headers = ["STT", "Họ và Tên", "Chức danh", "Công Hành chính", "Tăng ca (Giờ)", "Tổng công (Giờ)", "Đơn giá (VNĐ/h)", "Tiền Hành chính", "Tiền Tăng ca", "Tổng cộng (VNĐ)"];
        const headerRow = ws.addRow(headers);
        headerRow.height = 30;
        headerRow.eachCell((cell) => {
            cell.style = headerStyle;
        });

        // 3. Data
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
                
                const dataRow = ws.addRow([
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

                dataRow.eachCell((cell, colNumber) => {
                    cell.style = (colNumber >= 7) ? moneyStyle : cellStyle;
                    if(colNumber === 2 || colNumber === 3) cell.alignment = { vertical: 'middle', horizontal: 'left' }; // Name left align
                });
            }
        });

        // 4. Footer
        const footerRow = ws.addRow(["", "", "", "", "", "", "", "", "TỔNG CỘNG:", sumMoney]);
        footerRow.eachCell((cell, colNumber) => {
            if (colNumber === 9 || colNumber === 10) {
                cell.style = {
                    font: { name: 'Arial', size: 12, bold: true, color: { argb: 'FF9C0006' } },
                    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } },
                    alignment: { vertical: 'middle', horizontal: 'right' },
                    numFmt: '#,##0',
                    border: {
                        top: { style: 'thin' }, left: { style: 'thin' },
                        bottom: { style: 'thin' }, right: { style: 'thin' }
                    }
                };
            }
        });

        // Columns width
        ws.columns = [
            { width: 6 },  // STT
            { width: 25 }, // Name
            { width: 15 }, // Role
            { width: 18 }, // Reg
            { width: 15 }, // OT
            { width: 15 }, // Total hours
            { width: 15 }, // Wage
            { width: 18 }, // Money Reg
            { width: 18 }, // Money OT
            { width: 20 }  // Total
        ];

        // SHEET 2: Chi tiết
        const ws2 = wb.addWorksheet('Chi_Tiet_Ngay');
        
        ws2.mergeCells('A1:G1');
        ws2.getCell('A1').value = "BẢNG KÊ CHI TIẾT HẰNG NGÀY";
        ws2.getCell('A1').style = titleStyle;

        ws2.mergeCells('A2:G2');
        ws2.getCell('A2').value = `Đội: ${state.teams.find(t=>t.teamId === state.currentTeam)?.name || ''}`;
        ws2.getCell('A2').style = subtitleStyle;

        ws2.mergeCells('A3:G3');
        ws2.getCell('A3').value = `Từ ngày: ${startStr} - Đến ngày: ${endStr}`;
        ws2.getCell('A3').style = subtitleStyle;
        ws2.addRow([]);

        const headers2 = ["Ngày", "Họ và Tên", "Chức danh", "Công HC (h)", "Tăng ca (h)", "Người duyệt", "Thời gian duyệt"];
        const headerRow2 = ws2.addRow(headers2);
        headerRow2.height = 30;
        headerRow2.eachCell((cell) => cell.style = headerStyle);

        current = new Date(startStr);
        end = new Date(endStr);
        while (current <= end) {
            let dStr = current.toISOString().split('T')[0];
            if (state.history[dStr]) {
                const dayData = state.history[dStr];
                state.workers.forEach(w => {
                    const r = dayData.dailyData[w.id] || 0;
                    const o = dayData.otData[w.id] || 0;
                    if(r > 0 || o > 0) {
                        const dr = ws2.addRow([
                            dStr,
                            w.name,
                            w.role,
                            r,
                            o,
                            dayData.approvedBy || '',
                            dayData.approvedAt || ''
                        ]);
                        dr.eachCell((cell, colNum) => {
                            cell.style = cellStyle;
                            if(colNum === 2 || colNum === 3) cell.alignment = { vertical: 'middle', horizontal: 'left' };
                        });
                    }
                });
            }
            current.setDate(current.getDate() + 1);
        }

        ws2.columns = [
            { width: 15 }, // Ngay
            { width: 25 }, // Ho ten
            { width: 15 }, // Chuc danh
            { width: 15 }, // Cong HC
            { width: 15 }, // Tang ca
            { width: 25 }, // Nguoi duyet
            { width: 25 }  // Tgian duyet
        ];

        const teamNameStr = state.teams.find(t=>t.teamId === state.currentTeam)?.name || 'Doi';
        const buffer = await wb.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `BangCong_${teamNameStr}_${startStr}_${endStr}.xlsx`);
    },

    saveToFirebase(dateStr) {
        set(ref(db, `teams/${state.currentTeam}/history/${dateStr}`), state.history[dateStr]);
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
            d.approvedBy = state.currentUser.name;
            d.approvedAt = new Date().toLocaleString('vi-VN');
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
            alert('Quản lý đã duyệt bảng công ngày ' + state.currentDate + '!');
        } else {
            alert('Phải chờ Giám sát duyệt trước, hoặc đã duyệt rồi.');
        }
    },

    resetDayData() {
        if(!confirm(`CẢNH BÁO: Hành động này sẽ XÓA SẠCH toàn bộ số giờ làm và trả bảng công ngày ${state.currentDate} về trạng thái Chưa Gửi. Bạn có chắc chắn muốn Reset không?`)) return;
        
        const d = state.history[state.currentDate];
        if (d) {
            d.dailyStatus = 'NOT_SUBMITTED';
            d.otStatus = 'NOT_SUBMITTED';
            d.approvedBy = '';
            d.approvedAt = '';
            for (let wId in d.dailyData) {
                d.dailyData[wId] = 0;
            }
            for (let wId in d.otData) {
                d.otData[wId] = 0;
            }
            this.saveToFirebase(state.currentDate);
            alert("Đã reset toàn bộ dữ liệu ngày này thành công!");
        }
    },

    updateStatusUI() {
        if(!state.currentUser) return;
        
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
                    if (isTabActive) { banner.className = 'status-banner pm_approved'; text.innerText = 'Quản lý đã duyệt'; }
                    box.innerHTML = `<button class="btn large" disabled style="background:#e2e8f0; color:#94a3b8">Đã khóa (Quản lý đã duyệt)</button>`;
                    break;
            }
        };

        applyStatusToBox(d.dailyStatus, 'daily-action-box', 'Bảng Hành Chính', 'submitDaily', "app.undoSubmit('daily')");
        applyStatusToBox(d.otStatus, 'ot-action-box', 'Tăng Ca', 'submitOT', "app.undoSubmit('ot')");

        if (d.dailyStatus === 'PENDING' || d.otStatus === 'PENDING') sumBox.innerText = 'Chờ Giám sát duyệt';
        else if (d.dailyStatus === 'REJECTED' || d.otStatus === 'REJECTED') sumBox.innerText = 'Bị trả về (Cần sửa lại)';
        else if (d.dailyStatus === 'SUPERVISOR_APPROVED' || d.otStatus === 'SUPERVISOR_APPROVED') sumBox.innerText = 'Giám sát đã duyệt';
        else if (d.dailyStatus === 'PM_APPROVED' || d.otStatus === 'PM_APPROVED') sumBox.innerText = 'QUẢN LÝ DUYỆT';
        else sumBox.innerText = 'Chưa gửi';

        const btnReject = document.getElementById('btn-reject-supervisor');
        const btnSup = document.getElementById('btn-approve-supervisor');
        const btnPM = document.getElementById('btn-approve-pm');
        
        const hasPending = (d.dailyStatus === 'PENDING' || d.otStatus === 'PENDING');
        const hasSupApprove = (d.dailyStatus === 'SUPERVISOR_APPROVED' || d.otStatus === 'SUPERVISOR_APPROVED');
        
        if(state.currentUser.role === 'SUPERVISOR') {
            btnReject.style.display = hasPending ? 'inline-block' : 'none';
            btnSup.style.display = hasPending ? 'inline-block' : 'none';
        } else {
            btnReject.style.display = 'none';
            btnSup.style.display = 'none';
        }

        const btnResetPM = document.getElementById('btn-reset-pm');
        
        if(state.currentUser.role === 'PM') {
            btnPM.style.display = hasSupApprove ? 'inline-block' : 'none';
            if (btnResetPM) btnResetPM.style.display = 'inline-block';
        } else {
            btnPM.style.display = 'none';
            if (btnResetPM) btnResetPM.style.display = 'none';
        }
    },

    renderPaymentTab() {
        if (!state.currentTeam) return;

        let totalEarned = 0;
        let totalRegHours = 0;
        let totalOTHours = 0;
        
        for (let dateStr in state.history) {
            const d = state.history[dateStr];
            
            // Tính tiền Hành chính
            if (d.dailyData) {
                for (let wId in d.dailyData) {
                    const w = state.workers.find(x => x.id === wId);
                    if (w && d.dailyData[wId]) {
                        totalEarned += d.dailyData[wId] * w.wage;
                        totalRegHours += d.dailyData[wId];
                    }
                }
            }
            
            // Tính tiền Tăng ca
            if (d.otData) {
                for (let wId in d.otData) {
                    const w = state.workers.find(x => x.id === wId);
                    if (w && d.otData[wId]) {
                        totalEarned += d.otData[wId] * (w.wage * 1.5);
                        totalOTHours += d.otData[wId];
                    }
                }
            }
        }
        
        const regDays = (totalRegHours / 8);
        const otDays = (totalOTHours / 8);
        const totalDays = regDays + otDays;
        
        document.getElementById('pay-total-days').innerText = totalDays.toLocaleString('vi-VN') + " ngày";
        document.getElementById('pay-reg-days').innerText = regDays.toLocaleString('vi-VN');
        document.getElementById('pay-ot-days').innerText = otDays.toLocaleString('vi-VN');

        let totalRequested = 0;
        let totalPaid = 0;

        const listDiv = document.getElementById('payment-list');
        listDiv.innerHTML = '';

        if (state.payments.length === 0) {
            listDiv.innerHTML = '<div class="empty-state">Chưa có đợt trình thanh toán nào.</div>';
        } else {
            state.payments.forEach(p => {
                totalRequested += (Number(p.requestedAmount) || 0);
                totalPaid += (Number(p.paidAmount) || 0);
                
                const owed = (Number(p.requestedAmount) || 0) - (Number(p.paidAmount) || 0);
                const isPaidFull = owed <= 0 && p.requestedAmount > 0;

                const card = document.createElement('div');
                card.className = 'worker-card';
                card.innerHTML = `
                    <div style="flex:1;">
                        <div style="font-weight:bold; font-size:1.05rem;">${p.note || 'Không có ghi chú'}</div>
                        <div style="font-size:0.85rem; color:#64748b; margin-top:2px;">Tạo ngày: ${new Date(p.createdAt).toLocaleDateString('vi-VN')}</div>
                        <div style="margin-top:8px; display:grid; grid-template-columns: 1fr 1fr; gap:5px; font-size:0.9rem;">
                            <div>Trình lên: <strong style="color:#2563eb">${Number(p.requestedAmount).toLocaleString('vi-VN')}</strong></div>
                            <div>Đã nhận: <strong style="color:#16a34a">${Number(p.paidAmount).toLocaleString('vi-VN')}</strong></div>
                        </div>
                        <div style="margin-top:4px; font-size:0.9rem;">
                            Còn nợ: <strong style="color:${isPaidFull ? '#16a34a' : '#dc2626'}">${owed.toLocaleString('vi-VN')}</strong>
                        </div>
                        ${p.paidDate ? `<div style="margin-top:4px; font-size:0.85rem; color:#64748b;">Ngày thanh toán: ${p.paidDate}</div>` : ''}
                        ${p.paidTo ? `<div style="margin-top:2px; font-size:0.85rem; color:#64748b;">Thanh toán cho: ${p.paidTo}</div>` : ''}
                    </div>
                    ${state.currentUser.role === 'PM' ? `
                    <div style="display:flex; flex-direction:row; gap:8px; margin-top:8px;">
                        <button class="btn btn-success" style="padding:6px 12px; font-size:0.85rem;" onclick="app.editPayment('${p.id}')">Cập nhật thanh toán</button>
                        <button class="btn btn-danger" style="padding:6px 16px; font-size:0.85rem;" onclick="app.deletePayment('${p.id}')">Xóa</button>
                    </div>
                    ` : ''}
                `;
                listDiv.appendChild(card);
            });
        }

        const totalOwed = totalRequested - totalPaid;

        document.getElementById('pay-total-earned').innerText = Math.round(totalEarned).toLocaleString('vi-VN');
        document.getElementById('pay-total-requested').innerText = totalRequested.toLocaleString('vi-VN');
        document.getElementById('pay-total-paid').innerText = totalPaid.toLocaleString('vi-VN');
        document.getElementById('pay-total-owed').innerText = totalOwed.toLocaleString('vi-VN');
    },

    openPaymentModal() {
        document.getElementById('pay-req-id').value = '';
        document.getElementById('pay-req-note').value = '';
        document.getElementById('pay-req-amount').value = '';
        document.getElementById('pay-paid-amount').value = '0';
        document.getElementById('pay-paid-date').value = '';
        document.getElementById('pay-paid-to').value = '';
        document.getElementById('pay-paid-group').style.display = 'none';
        document.getElementById('payment-modal-title').innerText = 'Trình Thanh Toán Mới';
        document.getElementById('payment-modal').classList.add('active');
    },

    editPayment(id) {
        const p = state.payments.find(x => x.id === id);
        if (!p) return;
        document.getElementById('pay-req-id').value = p.id;
        document.getElementById('pay-req-note').value = p.note || '';
        document.getElementById('pay-req-amount').value = p.requestedAmount || 0;
        document.getElementById('pay-paid-amount').value = p.paidAmount || 0;
        document.getElementById('pay-paid-date').value = p.paidDate || '';
        document.getElementById('pay-paid-to').value = p.paidTo || '';
        document.getElementById('pay-paid-group').style.display = 'block';
        document.getElementById('payment-modal-title').innerText = 'Cập nhật Thanh Toán';
        document.getElementById('payment-modal').classList.add('active');
    },

    savePaymentRequest() {
        const id = document.getElementById('pay-req-id').value;
        const note = document.getElementById('pay-req-note').value.trim();
        const reqAmountStr = document.getElementById('pay-req-amount').value.replace(/[,.]/g, '');
        const paidAmountStr = document.getElementById('pay-paid-amount').value.replace(/[,.]/g, '');
        const paidDate = document.getElementById('pay-paid-date').value;
        const paidTo = document.getElementById('pay-paid-to').value.trim();
        const reqAmount = parseInt(reqAmountStr) || 0;
        const paidAmount = parseInt(paidAmountStr) || 0;

        if (reqAmount <= 0) {
            alert('Số tiền trình phải lớn hơn 0!');
            return;
        }

        const payId = id || ('pay_' + Date.now());
        const obj = {
            id: payId,
            note: note,
            requestedAmount: reqAmount,
            paidAmount: paidAmount,
            paidDate: paidDate,
            paidTo: paidTo,
            createdAt: id ? state.payments.find(x=>x.id===id).createdAt : Date.now()
        };

        set(ref(db, `teams/${state.currentTeam}/payments/${payId}`), obj).then(() => {
            document.getElementById('payment-modal').classList.remove('active');
        }).catch(err => {
            alert('Lỗi: ' + err.message);
        });
    },

    deletePayment(id) {
        if(confirm('Bạn có chắc chắn muốn xóa đợt thanh toán này không?')) {
            set(ref(db, `teams/${state.currentTeam}/payments/${id}`), null);
        }
    }
};

window.app = app;
app.boot();
