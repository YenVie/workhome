// Firebase Hybrid Sync Functions
// This file adds manual sync capability between localStorage and Firestore

// Upload local data to Firebase
async function uploadToFirebase() {
    try {
        console.log('📤 Uploading to Firebase...');

        // Get current localStorage data
        const data = JSON.parse(localStorage.getItem('householdChoreManager') || '{}');
        if (!data.members && !data.tasks) {
            console.log('No data to upload');
            return false;
        }

        const { members = [], tasks = [], history = [], assignments = {} } = data;

        // Upload members
        for (const member of members) {
            await db.collection('members').doc(member.id).set(member, { merge: true });
        }

        // Upload tasks
        for (const task of tasks) {
            await db.collection('tasks').doc(task.id).set(task, { merge: true });
        }

        // Upload history (batch in chunks of 500)
        for (let i = 0; i < history.length; i += 500) {
            const batch = db.batch();
            const chunk = history.slice(i, i + 500);
            for (const entry of chunk) {
                const ref = db.collection('history').doc(entry.id);
                batch.set(ref, entry, { merge: true });
            }
            await batch.commit();
        }

        // Upload assignments
        for (const [key, memberId] of Object.entries(assignments)) {
            await db.collection('assignments').doc(key).set({ memberId }, { merge: true });
        }

        console.log('✅ Upload complete!');
        return true;
    } catch (error) {
        console.error('❌ Upload error:', error);
        return false;
    }
}

// Download data from Firebase to localStorage
async function downloadFromFirebase() {
    try {
        console.log('📥 Downloading from Firebase...');

        const data = {
            version: '1.0.0',
            currentMonth: getCurrentMonth(),
            members: [],
            tasks: [],
            history: [],
            assignments: {},
            settings: { autoResetMonthly: true }
        };

        // Download members
        const membersSnapshot = await db.collection('members').get();
        membersSnapshot.forEach(doc => {
            data.members.push({ id: doc.id, ...doc.data() });
        });

        // Download tasks
        const tasksSnapshot = await db.collection('tasks').get();
        tasksSnapshot.forEach(doc => {
            data.tasks.push({ id: doc.id, ...doc.data() });
        });

        // Download history (last 100)
        const historySnapshot = await db.collection('history')
            .orderBy('completedAt', 'desc')
            .limit(100)
            .get();
        historySnapshot.forEach(doc => {
            data.history.push({ id: doc.id, ...doc.data() });
        });

        // Download assignments
        const assignmentsSnapshot = await db.collection('assignments').get();
        assignmentsSnapshot.forEach(doc => {
            data.assignments[doc.id] = doc.data().memberId;
        });

        // Save to localStorage
        localStorage.setItem('householdChoreManager', JSON.stringify(data));

        console.log('✅ Download complete!');
        return true;
    } catch (error) {
        console.error('❌ Download error:', error);
        return false;
    }
}

// Bi-directional sync
async function syncWithFirebase() {
    const syncBtn = document.getElementById('syncBtn');
    if (syncBtn) {
        syncBtn.disabled = true;
        syncBtn.innerHTML = '🔄 Đang sync...';
    }

    try {
        // Step 1: Upload local changes
        await uploadToFirebase();

        // Step 2: Download remote updates
        await downloadFromFirebase();

        // Step 3: Reload page to apply changes
        if (syncBtn) {
            syncBtn.innerHTML = '✅ Đã sync!';
        }

        setTimeout(() => {
            window.location.reload();
        }, 1000);

        return true;
    } catch (error) {
        console.error('❌ Sync error:', error);
        if (syncBtn) {
            syncBtn.innerHTML = '❌ Lỗi sync';
            setTimeout(() => {
                syncBtn.innerHTML = '🔄 Sync';
                syncBtn.disabled = false;
            }, 2000);
        }
        alert('Không thể sync với Firebase. Vui lòng kiểm tra kết nối internet!');
        return false;
    }
}

// Auto-download on first visit
window.addEventListener('DOMContentLoaded', async () => {
    const hasLocalData = localStorage.getItem('householdChoreManager');
    if (!hasLocalData) {
        console.log('First visit - downloading from Firebase...');
        const downloaded = await downloadFromFirebase();
        if (downloaded) {
            window.location.reload();
        }
    }
});

function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
