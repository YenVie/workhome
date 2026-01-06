// ===== Application State =====
const APP_VERSION = '1.0.0';
const STORAGE_KEY = 'householdChoreManager';
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6'];

// Firestore collection references
const membersCollection = db.collection('members');
const tasksCollection = db.collection('tasks');
const historyCollection = db.collection('history');
const assignmentsCollection = db.collection('assignments');

let appData = {
    version: APP_VERSION,
    currentMonth: getCurrentMonth(),
    members: [],
    tasks: [],
    history: [],
    assignments: {},
    settings: {
        autoResetMonthly: true
    }
};

// ===== Utility Functions =====
function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatDate(date) {
    if (typeof date === 'string') date = new Date(date);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function formatTime(date) {
    if (typeof date === 'string') date = new Date(date);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function formatDateTime(date) {
    return `${formatDate(date)} - ${formatTime(date)}`;
}

function isToday(date) {
    if (typeof date === 'string') date = new Date(date);
    const today = new Date();
    return date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();
}

function generateId() {
    return Date.now() + Math.random().toString(36).substr(2, 9);
}

function getColorForMember(index) {
    return COLORS[index % COLORS.length];
}

// ===== Data Management =====
// ===== Data Management (Real-time) =====
function setupFirestoreListeners() {
    console.log('📡 Setting up Firestore listeners...');

    // Members Listener
    membersCollection.onSnapshot(snapshot => {
        appData.members = [];
        snapshot.forEach(doc => {
            appData.members.push(doc.data());
        });
        // Sort by ID or name if needed, or keep insertion order
        renderAll();
    });

    // Tasks Listener
    tasksCollection.onSnapshot(snapshot => {
        appData.tasks = [];
        snapshot.forEach(doc => {
            appData.tasks.push(doc.data());
        });
        // Recalculate 'completedToday' based on 'lastCompleted'
        appData.tasks.forEach(task => {
            if (task.lastCompleted && isToday(task.lastCompleted)) {
                task.completedToday = true;
            } else {
                task.completedToday = false;
            }
        });
        renderAll();
    });

    // History Listener (descending order)
    historyCollection.orderBy('completedAt', 'desc').limit(100).onSnapshot(snapshot => {
        appData.history = [];
        snapshot.forEach(doc => {
            appData.history.push(doc.data());
        });
        renderAll();
    });

    // Assignments Listener
    assignmentsCollection.onSnapshot(snapshot => {
        appData.assignments = {};
        snapshot.forEach(doc => {
            appData.assignments[doc.id] = doc.data().memberId;
        });
        renderAll();
    });
}

// Deprecated functions (kept to prevent errors during refactor)
function saveData() { console.log('saveData called - ignored (using Firestore)'); }
function loadData() { return false; }

function exportData() {
    const dataStr = JSON.stringify(appData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `household-chore-backup-${getCurrentMonth()}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

function importData() {
    const input = document.getElementById('importFileInput');
    input.click();

    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target.result);
                if (confirm('⚠️ Import dữ liệu sẽ ghi đè toàn bộ dữ liệu hiện tại. Bạn có chắc chắn?')) {
                    appData = imported;
                    saveData();
                    renderAll();
                    alert('✅ Import dữ liệu thành công!');
                }
            } catch (error) {
                alert('❌ File không hợp lệ!');
            }
        };
        reader.readAsText(file);
    };
}

function resetAllData() {
    try {
        console.log('🔍 Resetting all data...');

        // Clear localStorage
        localStorage.removeItem(STORAGE_KEY);
        console.log('✅ LocalStorage cleared');

        // Reset appData
        appData = {
            version: APP_VERSION,
            currentMonth: getCurrentMonth(),
            members: [],
            tasks: [],
            history: [],
            assignments: {},
            settings: { autoResetMonthly: true }
        };
        console.log('✅ AppData reset');

        // Force reload
        console.log('🔄 Reloading page...');
        window.location.href = window.location.href;
    } catch (error) {
        console.error('❌ Reset error:', error);
    }
}

// ===== Member Management =====
async function addMember(name, emoji = '👤') {
    const id = generateId();
    const member = {
        id: id,
        name: name.trim(),
        emoji: emoji || '👤',
        color: getColorForMember(appData.members.length) // This might be inconsistent if multiple adds happen, but OK for now
    };
    try {
        await membersCollection.doc(id).set(member);
        console.log('Member added to Firestore');
        return member;
    } catch (e) {
        console.error('Error adding member:', e);
        alert('Lỗi thêm thành viên');
    }
}

async function editMember(id, name, emoji) {
    try {
        await membersCollection.doc(id).update({
            name: name.trim(),
            emoji: emoji || '👤'
        });
    } catch (e) {
        console.error('Error editing member:', e);
        alert('Lỗi sửa thành viên');
    }
}

async function deleteMember(id) {
    // Check if member is in any task queue (using local data is instant)
    const inUse = appData.tasks.some(task => task.queue.includes(id));
    if (inUse) {
        alert('❌ Không thể xóa! Thành viên này đang được phân công việc nhà.');
        return false;
    }

    if (confirm('Bạn có chắc chắn muốn xóa thành viên này?')) {
        try {
            await membersCollection.doc(id).delete();
            return true;
        } catch (e) {
            console.error('Error deleting member:', e);
            alert('Lỗi xóa thành viên');
        }
    }
    return false;
}

function getMember(id) {
    return appData.members.find(m => m.id === id);
}

// ===== Task Management =====
async function addTask(name, icon, cycle) {
    const id = generateId();
    const task = {
        id: id,
        name: name.trim(),
        icon: icon || '✅',
        cycle: cycle || 'daily',
        queue: [...appData.members.map(m => m.id)], // All members by default
        currentIndex: 0,
        lastCompleted: null,
        completedToday: false
    };
    try {
        await tasksCollection.doc(id).set(task);
        return task;
    } catch (e) {
        console.error('Error adding task:', e);
        alert('Lỗi thêm công việc');
    }
}

async function editTask(id, name, icon, cycle) {
    try {
        await tasksCollection.doc(id).update({
            name: name.trim(),
            icon: icon || '✅',
            cycle: cycle || 'daily'
        });
    } catch (e) {
        console.error('Error editing task:', e);
        alert('Lỗi sửa công việc');
    }
}

async function handleDeleteAssignment(key) {
    console.log('🔍 Deleting assignment:', key);
    try {
        await assignmentsCollection.doc(key).delete();
        console.log('✅ Assignment deleted');
    } catch (e) {
        console.error('Error deleting assignment:', e);
    }
}

async function deleteTask(id) {
    if (confirm('Bạn có chắc chắn muốn xóa công việc này?')) {
        try {
            await tasksCollection.doc(id).delete();
            return true;
        } catch (e) {
            console.error('Error deleting task:', e);
            alert('Lỗi xóa công việc');
        }
    }
    return false;
}

// ===== Task Completion =====
async function completeTask(taskId, photoUrl = null) {
    const task = appData.tasks.find(t => t.id === taskId);
    if (!task) return;

    if (task.completedToday && !photoUrl) return; // Allow if adding photo? Or just block.
    // If we want to allow taking photo for already completed task, we need different logic.
    // But for now, assume photo check-in IS the completion action.
    if (task.completedToday) return;

    const currentMemberId = task.queue[task.currentIndex];
    const now = new Date().toISOString();
    const historyId = generateId();

    try {
        const batch = db.batch();

        // 1. Add to history
        const historyRef = historyCollection.doc(historyId);
        batch.set(historyRef, {
            id: historyId,
            taskId: task.id,
            taskName: task.name,
            taskIcon: task.icon,
            memberId: currentMemberId,
            completedAt: now,
            photoUrl: photoUrl
        });

        // 2. Update task
        const taskRef = tasksCollection.doc(taskId);
        batch.update(taskRef, {
            lastCompleted: now,
            currentIndex: (task.currentIndex + 1) % task.queue.length
            // 'completedToday' is calculated on client side locally, not stored permanently if we use lastCompleted check
        });

        await batch.commit();
        console.log('Task completed via Firestore');
    } catch (e) {
        console.error('Error completing task:', e);
        alert('Lỗi hoàn thành công việc');
    }
}

async function undoCompleteTask(taskId) {
    const task = appData.tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
        // Find today's history entries for this task
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // Firestore query (client side filter might be easier if small data, but let's try query)
        // Since we store string ISO, string comparison works for YYYY-MM-DD
        // easier: get all history for task, filter in memory (since we limit 100)

        const historySnapshot = await historyCollection
            .where('taskId', '==', taskId)
            .get();

        const batch = db.batch();
        let deletedCount = 0;

        historySnapshot.forEach(doc => {
            const data = doc.data();
            if (data.completedAt && isToday(data.completedAt)) {
                batch.delete(historyCollection.doc(doc.id));
                deletedCount++;
            }
        });

        if (deletedCount > 0) {
            // Update task: rotate back
            const newIndex = (task.currentIndex - 1 + task.queue.length) % task.queue.length;

            // We need to set lastCompleted to null OR previous date. 
            // Simplifying: set to null if only completed today. 
            // Ideally we find the previous completion, but for minimal scope, null or just leaving it is fine 
            // as long as completedToday logic checks Date.
            // If we undo a completion, 'lastCompleted' should probably revert. 
            // Hard to revert to exact previous date without querying history.
            // Workaround: Set lastCompleted to null. If completed yesterday, it will show uncompleted today (Correct).

            const taskRef = tasksCollection.doc(taskId);
            batch.update(taskRef, {
                lastCompleted: null, // Resetting to null forces 'completedToday' to be false
                currentIndex: newIndex
            });

            await batch.commit();
            console.log('Undo complete via Firestore');
        }
    } catch (e) {
        console.error('Error undoing task:', e);
        alert('Lỗi hoàn tác');
    }
}

function getCycleText(cycle) {
    const cycles = {
        daily: 'Hàng ngày',
        every2days: '2 ngày/lần',
        weekly: 'Hàng tuần'
    };
    return cycles[cycle] || cycle;
}

function getCurrentPerson(task) {
    if (!task.queue || task.queue.length === 0) return null;

    // Get today's date
    const today = new Date();
    const todayDateKey = formatDateKey(today);

    // Check if there's a manual assignment for this task today
    const manualMemberId = getManualAssignment(task.id, todayDateKey);
    if (manualMemberId) {
        return getMember(manualMemberId);
    }

    // Fallback to queue rotation if no manual assignment
    return getMember(task.queue[task.currentIndex]);
}

function getNextPerson(task) {
    if (!task.queue || task.queue.length === 0) return null;
    const nextIndex = (task.currentIndex + 1) % task.queue.length;
    return getMember(task.queue[nextIndex]);
}

// ===== Statistics =====
function getMemberStats() {
    const stats = {};

    // Initialize stats for all members
    appData.members.forEach(member => {
        stats[member.id] = {
            member: member,
            count: 0
        };
    });

    // Count completions from history
    if (appData.history && appData.history.length > 0) {
        appData.history.forEach(entry => {
            if (stats[entry.memberId]) {
                stats[entry.memberId].count++;
            }
        });
    }

    // Convert to array and sort by count
    return Object.values(stats).sort((a, b) => b.count - a.count);
}

// ===== Rendering Functions =====
function renderTasksList() {
    const container = document.getElementById('tasksList');

    if (appData.tasks.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <div class="empty-state-text">Chưa có công việc nào.<br>Vào phần Cài Đặt để thêm!</div>
            </div>
        `;
        return;
    }

    container.innerHTML = appData.tasks.map(task => {
        const currentPerson = getCurrentPerson(task);
        const isCompleted = task.completedToday && task.lastCompleted && isToday(task.lastCompleted);
        const taskPhotos = getTaskPhotos(task.id);

        return `
            <div class="task-card ${isCompleted ? 'completed' : ''}">
                <div class="task-header">
                    <div class="task-icon">${task.icon}</div>
                    <div class="task-title">
                        <h3>${task.name}</h3>
                        <div class="task-cycle">${getCycleText(task.cycle)}</div>
                    </div>
                </div>
                
                <div class="task-info">
                    ${currentPerson ? `
                        <div class="task-person">
                            <div class="person-avatar" style="background: ${currentPerson.color}">
                                ${currentPerson.emoji}
                            </div>
                            <span>Người phụ trách: <strong>${currentPerson.name}</strong></span>
                        </div>
                    ` : '<div class="task-person">Chưa có người phụ trách</div>'}
                </div>
                
                <div class="task-actions">
                    <button class="btn btn-secondary" onclick="openCamera('${task.id}')">
                        📷 Chụp ảnh
                    </button>
                    <button class="btn btn-primary" onclick="handleCompleteTask('${task.id}')" 
                            ${isCompleted ? 'disabled' : ''}>
                        ${isCompleted ? '✓ Đã Hoàn Thành' : '✓ Hoàn Thành'}
                    </button>
                    ${isCompleted ? `
                        <button class="btn btn-warning" onclick="handleUndoComplete('${task.id}')">
                            ↩️ Hoàn tác
                        </button>
                    ` : ''}
                </div>
                
                ${task.lastCompleted ? `
                    <div class="task-status ${isCompleted ? 'completed-today' : ''}">
                        ${isCompleted ? '🎉 Đã hoàn thành hôm nay!' : `Lần cuối: ${formatDateTime(task.lastCompleted)}`}
                    </div>
                ` : `
                    <div class="task-status">Chưa hoàn thành lần nào</div>
                `}
                
                ${taskPhotos.length > 0 ? `
                    <div class="task-photos">
                        <h4>📸 Ảnh Check-in (${taskPhotos.length})</h4>
                        <div class="photo-gallery">
                            ${taskPhotos.map(photo => `
                                <div class="photo-item">
                                    <img src="${photo.photoUrl}" alt="Check-in photo" />
                                    <div class="photo-date">${formatDateTime(photo.completedAt)}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function renderStats() {
    const memberStatsContainer = document.getElementById('memberStats');
    const historyContainer = document.getElementById('historyList');

    // Render member statistics
    const stats = getMemberStats();
    const maxCount = Math.max(...stats.map(s => s.count), 1);

    if (stats.length === 0) {
        memberStatsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📊</div>
                <div class="empty-state-text">Chưa có dữ liệu thống kê</div>
            </div>
        `;
    } else {
        memberStatsContainer.innerHTML = stats.map(stat => `
            <div class="stat-bar">
                <div class="stat-header">
                    <div class="stat-name">
                        <div class="person-avatar" style="background: ${stat.member.color}">
                            ${stat.member.emoji}
                        </div>
                        <span>${stat.member.name}</span>
                    </div>
                    <div class="stat-count">${stat.count} lần</div>
                </div>
                <div class="stat-progress">
                    <div class="stat-fill" style="width: ${(stat.count / maxCount) * 100}%"></div>
                </div>
            </div>
        `).join('');
    }

    // Render history
    if (appData.history.length === 0) {
        historyContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📜</div>
                <div class="empty-state-text">Chưa có lịch sử</div>
            </div>
        `;
    } else {
        historyContainer.innerHTML = appData.history.slice(0, 20).map(entry => {
            const member = getMember(entry.memberId);
            return `
                <div class="history-item">
                    <div class="history-icon">${entry.taskIcon}</div>
                    <div class="history-details">
                        <div class="history-task">${entry.taskName}</div>
                        <div class="history-meta">
                            ${member ? `${member.emoji} ${member.name}` : 'Người dùng đã xóa'} • 
                            ${formatDateTime(entry.completedAt)}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

function renderSettings() {
    const membersContainer = document.getElementById('membersList');
    const tasksContainer = document.getElementById('tasksSettingsList');

    // Render members
    if (appData.members.length === 0) {
        membersContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-text">Chưa có thành viên nào</div>
            </div>
        `;
    } else {
        membersContainer.innerHTML = appData.members.map(member => `
            <div class="member-item">
                <div class="person-avatar" style="background: ${member.color}">
                    ${member.emoji}
                </div>
                <div class="item-info">
                    <div class="item-name">${member.name}</div>
                </div>
                <div class="item-actions">
                    <button class="btn-icon assign" onclick="handleAssignTask('${member.id}')" title="Gán công việc">
                        📌
                    </button>
                    <button class="btn-icon" onclick="handleEditMember('${member.id}')" title="Sửa">
                        ✏️
                    </button>
                    <button class="btn-icon delete" onclick="handleDeleteMember('${member.id}')" title="Xóa">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Render tasks
    if (appData.tasks.length === 0) {
        tasksContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-text">Chưa có công việc nào</div>
            </div>
        `;
    } else {
        tasksContainer.innerHTML = appData.tasks.map(task => `
            <div class="task-setting-item">
                <div class="task-icon" style="font-size: 1.5rem">${task.icon}</div>
                <div class="item-info">
                    <div class="item-name">${task.name}</div>
                    <div class="item-meta">${getCycleText(task.cycle)}</div>
                </div>
                <div class="item-actions">
                    <button class="btn-icon" onclick="handleEditTask('${task.id}')" title="Sửa">
                        ✏️
                    </button>
                    <button class="btn-icon delete" onclick="handleDeleteTask('${task.id}')" title="Xóa">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Update data info
    document.getElementById('currentMonth').textContent = appData.currentMonth;
    document.getElementById('totalCompletions').textContent = appData.history.length;

    // Render assignments list
    renderAssignmentsList();
}

function renderAssignmentsList() {
    const assignmentsList = document.getElementById('assignmentsList');

    // Get all assignments
    const assignments = Object.entries(appData.assignments).map(([key, memberId]) => {
        // Key format: "taskId-YYYY-MM-DD"
        const lastDashIndex = key.lastIndexOf('-');
        const secondLastDashIndex = key.lastIndexOf('-', lastDashIndex - 1);
        const thirdLastDashIndex = key.lastIndexOf('-', secondLastDashIndex - 1);

        const taskId = key.substring(0, thirdLastDashIndex);
        const dateStr = key.substring(thirdLastDashIndex + 1);

        const task = appData.tasks.find(t => t.id === taskId);
        const member = getMember(memberId);

        if (!task || !member) return null;

        // Parse date
        const date = new Date(dateStr + 'T00:00:00');
        // Convert day: JavaScript's getDay() returns 0=Sunday, 1=Monday, etc.
        // Our getDayName expects 0=Monday, 1=Tuesday, ..., 6=Sunday
        const jsDay = date.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
        const ourDayIndex = jsDay === 0 ? 6 : jsDay - 1; // Convert to 0=Monday, ..., 6=Sunday
        const dayName = getDayName(ourDayIndex);
        const dateFormatted = formatDate(date);

        return {
            key,
            taskId,
            dateStr,
            task,
            member,
            dayName,
            dateFormatted
        };
    }).filter(a => a !== null);

    // Sort by date
    assignments.sort((a, b) => new Date(a.dateStr) - new Date(b.dateStr));

    if (assignments.length === 0) {
        assignmentsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <div class="empty-state-text">Chưa có phân công nào.<br>Click 📌 bên cạnh thành viên để gán công việc!</div>
            </div>
        `;
        return;
    }

    assignmentsList.innerHTML = assignments.map(a => `
        <div class="assignment-item">
            <div class="person-avatar" style="background: ${a.member.color}">
                ${a.member.emoji}
            </div>
            <div class="assignment-info">
                <div class="assignment-main">
                    <strong>${a.member.name}</strong> · ${a.task.icon} ${a.task.name}
                </div>
                <div class="assignment-meta">
                    ${a.dayName}, ${a.dateFormatted}
                </div>
            </div>
            <button class="btn-icon delete" onclick="handleDeleteAssignment('${a.key}')" title="Xóa">
                🗑️
            </button>
        </div>
    `).join('');
}


// ===== Calendar Functions =====
let selectedWeekDate = null;

function getWeekDays(selectedDate = null) {
    const baseDate = selectedDate ? new Date(selectedDate) : new Date();
    const dayOfWeek = baseDate.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Calculate Monday of the week containing baseDate
    const monday = new Date(baseDate);
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    monday.setDate(baseDate.getDate() + diff);

    // Generate 7 days starting from Monday
    const days = [];
    for (let i = 0; i < 7; i++) {
        const day = new Date(monday);
        day.setDate(monday.getDate() + i);
        days.push(day);
    }

    return days;
}

function getDayName(dayIndex) {
    const names = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    return names[dayIndex];
}

function getAssignedMemberForDay(task, dayIndex, weekStartDate) {
    // Calculate actual date from dayIndex + weekStartDate
    const actualDate = new Date(weekStartDate);
    actualDate.setDate(actualDate.getDate() + dayIndex);
    const dateKey = formatDateKey(actualDate);

    // Check if manual assignment exists
    const manualMemberId = getManualAssignment(task.id, dateKey);
    if (manualMemberId) {
        return getMember(manualMemberId);
    }

    // Return null if no manual assignment (cell will show "-")
    return null;
}

function renderOverview() {
    const weekDays = getWeekDays(selectedWeekDate);
    const weekInfoElement = document.getElementById('weekInfo');
    const calendarGrid = document.getElementById('calendarGrid');
    const weekPicker = document.getElementById('weekPicker');

    // Set week picker value to Monday of displayed week
    if (weekPicker && weekDays[0]) {
        const monday = weekDays[0];
        weekPicker.value = monday.toISOString().split('T')[0];
    }

    // Update week info
    const startDate = weekDays[0];
    const endDate = weekDays[6];
    weekInfoElement.textContent = `${formatDate(startDate)} - ${formatDate(endDate)}`;

    // Check if we have data
    if (appData.tasks.length === 0) {
        calendarGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📅</div>
                <div class="empty-state-text">Chưa có công việc nào.<br>Vào phần Cài Đặt để thêm!</div>
            </div>
        `;
        return;
    }

    // Build calendar table
    let tableHTML = `<table class="calendar-table">`;

    // Header row
    tableHTML += `<tr>`;
    tableHTML += `<th class="task-col">Công việc</th>`;
    weekDays.forEach((day, index) => {
        const isTodayFlag = isToday(day);
        tableHTML += `
            <th class="day-col ${isTodayFlag ? 'today-marker' : ''}">
                <div class="day-header">
                    <div class="day-name">${getDayName(index)}</div>
                    <div class="day-date">${day.getDate()}/${day.getMonth() + 1}</div>
                </div>
            </th>
        `;
    });
    tableHTML += `</tr>`;

    // Task rows
    appData.tasks.forEach(task => {
        tableHTML += `<tr>`;

        // Task name cell
        tableHTML += `
            <td class="task-name">
                <div class="task-name-inner">
                    <span class="task-name-icon">${task.icon}</span>
                    <span>${task.name}</span>
                </div>
            </td>
        `;

        // Member cells for each day
        weekDays.forEach((day, dayIndex) => {
            const member = getAssignedMemberForDay(task, dayIndex, weekDays[0]);

            tableHTML += `<td>`;
            if (member) {
                tableHTML += `
                    <div class="calendar-cell">
                        <div class="calendar-cell-content" style="background: ${member.color}; color: white;">
                            <span>${member.emoji}</span>
                            <span>${member.name}</span>
                        </div>
                    </div>
                `;
            } else {
                tableHTML += `<div class="calendar-cell">-</div>`;
            }
            tableHTML += `</td>`;
        });

        tableHTML += `</tr>`;
    });

    tableHTML += `</table>`;
    calendarGrid.innerHTML = tableHTML;
}

function renderAll() {
    renderOverview();
    renderTasksList();
    renderStats();
    renderSettings();
}

// ===== Event Handlers =====
function handleCompleteTask(taskId) {
    completeTask(taskId);
    renderAll();
}

function handleUndoComplete(taskId) {
    undoCompleteTask(taskId);
    renderAll();
}

function handleDeleteMember(memberId) {
    if (deleteMember(memberId)) {
        renderAll();
    }
}

function handleDeleteTask(taskId) {
    if (deleteTask(taskId)) {
        renderAll();
    }
}

// ===== Tab Management =====
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');

    // Re-render current tab
    if (tabName === 'overview') renderOverview();
    else if (tabName === 'tasks') renderTasksList();
    else if (tabName === 'stats') renderStats();
    else if (tabName === 'settings') renderSettings();
}

// ===== Modal Management =====
let currentModal = null;
let editingMemberId = null;
let editingTaskId = null;

function openMemberModal(memberId = null) {
    currentModal = document.getElementById('memberModal');
    editingMemberId = memberId;

    let member = null;
    if (memberId) {
        member = getMember(memberId);
        document.getElementById('memberModalTitle').textContent = 'Sửa Thành Viên';
        document.getElementById('memberIdInput').value = memberId;
        document.getElementById('memberNameInput').value = member.name;
        document.getElementById('memberEmojiInput').value = member.emoji;
    } else {
        document.getElementById('memberModalTitle').textContent = 'Thêm Thành Viên';
        document.getElementById('memberIdInput').value = '';
        document.getElementById('memberNameInput').value = '';
        document.getElementById('memberEmojiInput').value = '👤';
    }

    // Update selected emoji in picker
    updateEmojiSelection('memberEmojiPicker', memberId && member ? member.emoji : '👤');

    currentModal.classList.add('active');
    document.getElementById('memberNameInput').focus();
}

function openTaskModal(taskId = null) {
    currentModal = document.getElementById('taskModal');
    editingTaskId = taskId;

    let task = null;
    if (taskId) {
        task = appData.tasks.find(t => t.id === taskId);
        document.getElementById('taskModalTitle').textContent = 'Sửa Công Việc';
        document.getElementById('taskIdInput').value = taskId;
        document.getElementById('taskNameInput').value = task.name;
        document.getElementById('taskIconInput').value = task.icon;
        document.getElementById('taskCycleInput').value = task.cycle;
    } else {
        document.getElementById('taskModalTitle').textContent = 'Thêm Công Việc';
        document.getElementById('taskIdInput').value = '';
        document.getElementById('taskNameInput').value = '';
        document.getElementById('taskIconInput').value = '✅';
        document.getElementById('taskCycleInput').value = 'daily';
    }

    // Update selected emoji in picker
    updateEmojiSelection('taskEmojiPicker', taskId && task ? task.icon : '✅');

    currentModal.classList.add('active');
    document.getElementById('taskNameInput').focus();
}

function updateEmojiSelection(pickerId, selectedEmoji) {
    const picker = document.getElementById(pickerId);
    if (!picker) return;

    // Remove previous selection
    picker.querySelectorAll('.emoji-btn').forEach(btn => {
        btn.classList.remove('selected');
    });

    // Set new selection
    const selectedBtn = picker.querySelector(`[data-emoji="${selectedEmoji}"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('selected');
    }
}

function closeModal() {
    if (currentModal) {
        currentModal.classList.remove('active');
        currentModal = null;
        editingMemberId = null;
        editingTaskId = null;
    }
}

function handleEditMember(memberId) {
    openMemberModal(memberId);
}

function handleEditTask(taskId) {
    openTaskModal(taskId);
}

function saveMember() {
    const name = document.getElementById('memberNameInput').value.trim();
    const emoji = document.getElementById('memberEmojiInput').value.trim();

    if (!name) {
        alert('❌ Vui lòng nhập tên!');
        return;
    }

    if (editingMemberId) {
        editMember(editingMemberId, name, emoji);
    } else {
        addMember(name, emoji);
    }

    closeModal();
    renderAll();
}

function saveTask() {
    const name = document.getElementById('taskNameInput').value.trim();
    const icon = document.getElementById('taskIconInput').value.trim();
    const cycle = document.getElementById('taskCycleInput').value;

    if (!name) {
        alert('❌ Vui lòng nhập tên công việc!');
        return;
    }

    if (appData.members.length === 0) {
        alert('❌ Vui lòng thêm thành viên trước!');
        closeModal();
        switchTab('settings');
        return;
    }

    if (editingTaskId) {
        editTask(editingTaskId, name, icon, cycle);
    } else {
        addTask(name, icon, cycle);
    }

    closeModal();
    renderAll();
}

// ===== Assignment Modal Handlers =====
let editingAssignmentMemberId = null;

function handleAssignTask(memberId) {
    editingAssignmentMemberId = memberId;
    openAssignmentModal(memberId);
}

function openAssignmentModal(memberId, taskId = null, dateStr = null) {
    const modal = document.getElementById('assignmentModal');
    const member = getMember(memberId);

    if (!member) return;

    // Show member info
    document.getElementById('assignmentMemberDisplay').innerHTML = `
        <div style="display: flex; align-items: center;">
            <div class="person-avatar" style="background: ${member.color}; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 50%; margin-right: 0.75rem;">
                ${member.emoji}
            </div>
            <span style="font-weight: 600;">${member.name}</span>
        </div>
    `;

    // Populate task dropdown
    const taskSelect = document.getElementById('assignmentTaskSelect');
    taskSelect.innerHTML = '<option value="">-- Chọn công việc --</option>' +
        appData.tasks.map(task => `
            <option value="${task.id}">${task.icon} ${task.name}</option>
        `).join('');

    // Set values
    document.getElementById('assignmentMemberId').value = memberId;

    if (taskId) {
        document.getElementById('assignmentTaskId').value = taskId;
        taskSelect.value = taskId;
    }

    if (dateStr) {
        document.getElementById('assignmentDate').value = dateStr;
        // Parse dateStr to get day of week
        const date = new Date(dateStr + 'T00:00:00');
        document.getElementById('assignmentDaySelect').value = date.getDay();
        document.getElementById('clearAssignmentBtn').style.display = 'inline-block';
    } else {
        document.getElementById('clearAssignmentBtn').style.display = 'none';
    }

    currentModal = modal;
    modal.classList.add('active');
}

function saveAssignment() {
    const memberId = document.getElementById('assignmentMemberId').value;
    const taskId = document.getElementById('assignmentTaskSelect').value;
    const dayOfWeek = parseInt(document.getElementById('assignmentDaySelect').value);

    if (!taskId) {
        alert('Vui lòng chọn công việc!');
        return;
    }

    // Get next occurrence of selected day
    const targetDate = getNextDayOfWeek(dayOfWeek);
    const dateStr = formatDateKey(targetDate);

    // Save assignment
    setManualAssignment(taskId, dateStr, memberId);

    closeModal();
    renderAll();
}

function clearAssignment() {
    const taskId = document.getElementById('assignmentTaskId').value;
    const dateStr = document.getElementById('assignmentDate').value;

    if (!taskId || !dateStr) return;

    clearManualAssignment(taskId, dateStr);
    closeModal();
    renderAll();
}

// ===== Theme Management =====
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        updateThemeIcon();
    }
}

function toggleTheme() {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    updateThemeIcon();
}

function updateThemeIcon() {
    const themeToggle = document.getElementById('themeToggle');
    const isLight = document.body.classList.contains('light-mode');
    themeToggle.textContent = isLight ? '🌙' : '🌞';
}

// ===== Camera Photo Check-in =====
let cameraStream = null;

function openCamera(taskId) {
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraVideo');
    const capturedImage = document.getElementById('capturedImage');
    const canvas = document.getElementById('cameraCanvas');

    // Store task ID
    document.getElementById('cameraTaskId').value = taskId;

    // Reset UI
    video.style.display = 'block';
    capturedImage.style.display = 'none';
    document.getElementById('capturePhotoBtn').style.display = 'inline-block';
    document.getElementById('savePhotoBtn').style.display = 'none';
    document.getElementById('retakePhotoBtn').style.display = 'none';

    // Request camera access
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
            cameraStream = stream;
            video.srcObject = stream;
            modal.classList.add('active');
        })
        .catch(error => {
            console.error('Camera access error:', error);
            alert('❌ Không thể truy cập camera! Vui lòng cấp quyền camera cho trình duyệt.');
        });
}

function capturePhoto() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCanvas');
    const capturedImage = document.getElementById('capturedImage');

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Add timestamp overlay
    const timestamp = new Date();
    addTimestampToImage(ctx, canvas.width, canvas.height, timestamp);

    // Get image data URL
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);

    // Display captured image
    capturedImage.src = imageDataUrl;
    capturedImage.style.display = 'block';
    video.style.display = 'none';

    // Update buttons
    document.getElementById('capturePhotoBtn').style.display = 'none';
    document.getElementById('savePhotoBtn').style.display = 'inline-block';
    document.getElementById('retakePhotoBtn').style.display = 'inline-block';
}

function addTimestampToImage(ctx, width, height, timestamp) {
    const dateStr = formatDate(timestamp);
    const timeStr = formatTime(timestamp);
    const text = `${dateStr} ${timeStr}`;

    // Set text style
    const fontSize = Math.max(12, Math.min(width / 20, 24));
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';

    // Measure text
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = fontSize;

    // Position (bottom-right with padding)
    const padding = fontSize * 0.5;
    const x = width - padding;
    const y = height - padding;

    // Draw background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(
        x - textWidth - padding,
        y - textHeight - padding,
        textWidth + padding * 2,
        textHeight + padding * 2
    );

    // Draw text
    ctx.fillStyle = 'white';
    ctx.fillText(text, x, y);
}

async function savePhoto() {
    const taskId = document.getElementById('cameraTaskId').value;
    const capturedImage = document.getElementById('capturedImage');
    const photoUrl = capturedImage.src;

    if (!photoUrl || !taskId) return;

    // Use completeTask to handle Firestore write (and task rotation)
    await completeTask(taskId, photoUrl);

    closeCameraModal();
}

function retakePhoto() {
    const video = document.getElementById('cameraVideo');
    const capturedImage = document.getElementById('capturedImage');

    video.style.display = 'block';
    capturedImage.style.display = 'none';

    document.getElementById('capturePhotoBtn').style.display = 'inline-block';
    document.getElementById('savePhotoBtn').style.display = 'none';
    document.getElementById('retakePhotoBtn').style.display = 'none';
}

function closeCameraModal() {
    const modal = document.getElementById('cameraModal');

    // Stop camera stream
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }

    modal.classList.remove('active');
}

function getTaskPhotos(taskId) {
    return appData.history
        .filter(entry => entry.taskId === taskId && entry.photoUrl)
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
}

// ===== Data Management =====
function exportData() {
    const dataStr = JSON.stringify(appData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `household-chores-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    alert('✅ Dữ liệu đã được export thành công!');
}

function importData() {
    const fileInput = document.getElementById('importFileInput');
    fileInput.click();
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target.result);
                if (confirm('⚠️ Import sẽ ghi đè toàn bộ dữ liệu hiện tại. Tiếp tục?')) {
                    appData = imported;
                    saveData();
                    renderAll();
                    alert('✅ Import dữ liệu thành công!');
                }
            } catch (error) {
                alert('❌ File không hợp lệ!');
            }
        };
        reader.readAsText(file);
        fileInput.value = '';
    };
}

function resetAllData() {
    if (confirm('⚠️ CẢNH BÁO: Bạn có chắc muốn xóa toàn bộ dữ liệu?\n\nĐiều này sẽ xóa:\n- Tất cả thành viên\n- Tất cả công việc\n- Lịch sử hoàn thành\n\nHành động này KHÔNG THỂ hoàn tác!')) {
        if (confirm('🔴 Xác nhận lần cuối: Bạn THỰC SỰ muốn xóa toàn bộ?')) {
            appData = {
                version: APP_VERSION,
                members: [],
                tasks: [],
                history: [],
                assignments: {},
                currentMonth: getCurrentMonth(),
                settings: {
                    autoResetMonthly: true
                }
            };
            saveData();
            renderAll();
            alert('✅ Đã reset toàn bộ dữ liệu!');
        }
    }
}

// ===== Assignment Management =====
function formatDateKey(date) {
    // Convert Date object to YYYY-MM-DD string
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function setManualAssignment(taskId, dateStr, memberId) {
    const key = `${taskId}-${dateStr}`;
    try {
        if (memberId) {
            await assignmentsCollection.doc(key).set({
                memberId: memberId,
                taskId: taskId,
                date: dateStr
            });
        } // Else delete logic handled by set? No, clearManualAssignment handles delete.
        // If we want to support unsetting by passing null, we should add delete here.
        // But original logic deleted if !memberId.
        else {
            await assignmentsCollection.doc(key).delete();
        }
        console.log('Manual assignment set/cleared via Firestore');
    } catch (e) {
        console.error('Error setting assignment:', e);
        alert('Lỗi phân công');
    }
}

async function clearManualAssignment(taskId, dateStr) {
    const key = `${taskId}-${dateStr}`;
    try {
        await assignmentsCollection.doc(key).delete();
    } catch (e) {
        console.error('Error clearing assignment:', e);
    }
}

function getManualAssignment(taskId, dateStr) {
    const key = `${taskId}-${dateStr}`;
    return appData.assignments[key];
}

function getNextDayOfWeek(dayOfWeek) {
    // Get next occurrence of a specific day (0=Sunday, 1=Monday, etc.)
    const today = new Date();
    const currentDay = today.getDay();
    let daysUntil = dayOfWeek - currentDay;
    if (daysUntil <= 0) daysUntil += 7; // Go to next week if today or past

    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysUntil);
    return targetDate;
}

// ===== Initialization =====
function initializeApp() {
    // Initialize theme first
    initializeTheme();

    // Start Real-time Sync (replaces loadData)
    setupFirestoreListeners();

    // No sample data needed - will sync from Cloud

    // Setup tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });

    // Setup modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    // Setup modal background click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    });

    // Setup member modal buttons
    document.getElementById('addMemberBtn').addEventListener('click', () => openMemberModal());
    document.getElementById('cancelMemberBtn').addEventListener('click', closeModal);
    document.getElementById('saveMemberBtn').addEventListener('click', saveMember);

    // Setup task modal buttons
    document.getElementById('addTaskBtn').addEventListener('click', () => openTaskModal());
    document.getElementById('cancelTaskBtn').addEventListener('click', closeModal);
    document.getElementById('saveTaskBtn').addEventListener('click', saveTask);

    // Setup assignment modal buttons
    document.getElementById('cancelAssignmentBtn').addEventListener('click', closeModal);
    document.getElementById('saveAssignmentBtn').addEventListener('click', saveAssignment);
    document.getElementById('clearAssignmentBtn').addEventListener('click', clearAssignment);

    // Setup camera modal buttons
    document.getElementById('cancelCameraBtn').addEventListener('click', closeCameraModal);
    document.getElementById('capturePhotoBtn').addEventListener('click', capturePhoto);
    document.getElementById('savePhotoBtn').addEventListener('click', savePhoto);
    document.getElementById('retakePhotoBtn').addEventListener('click', retakePhoto);

    // Setup data management buttons
    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('importBtn').addEventListener('click', importData);
    document.getElementById('resetBtn').addEventListener('click', resetAllData);

    // Setup Enter key handlers in modals
    document.getElementById('memberNameInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveMember();
    });
    document.getElementById('taskNameInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveTask();
    });

    // Setup week picker
    const weekPickerInput = document.getElementById('weekPicker');
    if (weekPickerInput) {
        weekPickerInput.addEventListener('change', (e) => {
            selectedWeekDate = e.target.value ? new Date(e.target.value) : null;
            renderOverview();
        });
    }

    // Setup theme toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    // Setup emoji pickers
    document.querySelectorAll('.emoji-btn').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            const emoji = this.getAttribute('data-emoji');
            const picker = this.closest('.emoji-picker');
            const pickerId = picker.id;

            // Update hidden input
            if (pickerId === 'taskEmojiPicker') {
                document.getElementById('taskIconInput').value = emoji;
            } else if (pickerId === 'memberEmojiPicker') {
                document.getElementById('memberEmojiInput').value = emoji;
            }

            // Update visual selection
            updateEmojiSelection(pickerId, emoji);
        });
    });

    // Initial render
    renderAll();

    // Check for month change every hour
    setInterval(() => {
        const currentMonth = getCurrentMonth();
        if (appData.currentMonth !== currentMonth) {
            loadData(); // This will trigger auto-reset
            renderAll();
        }
    }, 3600000); // Check every hour

    console.log('✅ App initialized successfully!');
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
