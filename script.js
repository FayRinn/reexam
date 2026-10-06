// ============================================================
// ============ КОНФИГУРАЦИЯ ==================================
// ============================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbwuvHN3m_qBZwO-IGgdSM1WFDqugJxkkSWqXpu-jcbtEVT2ka6MP0VHKIIL_WA2VFwaAg/exec';

// ============================================================
// ============ ПЕРЕМЕННЫЕ ====================================
// ============================================================

let allData = {
    disciplines: [],
    activeDisciplines: [],
    groups: [],
    announcements: [],
    counts: {},
    currentDate: ''
};

let userData = {
    fio: '',
    group: ''
};

let currentDiscipline = null;

// ============================================================
// ============ ЗАГРУЗКА ДАННЫХ ===============================
// ============================================================

async function loadData() {
    try {
        const response = await fetch(API_URL + '?action=getData');
        const text = await response.text();
        
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('Сервер вернул не JSON:', text.substring(0, 300));
            throw new Error('Сервер временно недоступен. Обновите страницу.');
        }
        
        if (data.error) throw new Error(data.error);
        
        allData = data;
        
        // ⚠️ sessionStorage — данные живут до закрытия вкладки
        const saved = sessionStorage.getItem('pereeks_user');
        if (saved) {
            try {
                userData = JSON.parse(saved);
            } catch (e) {}
        }
        
        document.getElementById('loading').style.display = 'none';
        document.getElementById('step1').style.display = 'block';
        
        showAnnouncements();
        populateGroups();
        restoreUserData();
        
        if (userData.fio && userData.group) {
            goToStep2();
        }
        
    } catch (err) {
        document.getElementById('loading').innerHTML = 
            '❌ ' + err.message + 
            '<br><br>' +
            '<button onclick="location.reload()">Обновить страницу</button>';
        console.error(err);
    }
}

// ============================================================
// ============ ОБЪЯВЛЕНИЯ ====================================
// ============================================================

function showAnnouncements() {
    const container = document.getElementById('announcements');
    if (!container) return;
    
    const general = allData.announcements.filter(a => !a.discipline);
    
    general.forEach(a => {
        const div = document.createElement('div');
        div.className = 'announcement';
        div.textContent = '📢 ' + a.text;
        container.appendChild(div);
    });
}

function showDisciplineAnnouncements(discipline) {
    const container = document.getElementById('disciplineAnnouncements');
    if (!container) return;
    container.innerHTML = '';
    
    const list = allData.announcements.filter(a => a.discipline === discipline);
    
    list.forEach(a => {
        const div = document.createElement('div');
        div.className = 'announcement';
        div.textContent = '📢 ' + a.text;
        container.appendChild(div);
    });
}

// ============================================================
// ============ ГРУППЫ ========================================
// ============================================================

function populateGroups() {
    const select = document.getElementById('groupSelect');
    
    allData.groups.forEach(g => {
        const option = document.createElement('option');
        option.value = g;
        option.textContent = g;
        select.appendChild(option);
    });
}

function restoreUserData() {
    if (userData.fio) document.getElementById('fio').value = userData.fio;
    if (userData.group) {
        document.getElementById('groupSelect').value = userData.group;
    }
    updateContinueBtn();
}

function getSelectedGroup() {
    const select = document.getElementById('groupSelect');
    const other = document.getElementById('groupOther');
    
    if (select.value === 'Другая' && other.value.trim()) {
        return other.value.trim();
    }
    return select.value;
}

// ============================================================
// ============ ШАГ 1: ФИО + ГРУППА ===========================
// ============================================================

document.getElementById('fio').addEventListener('input', updateContinueBtn);
document.getElementById('groupSelect').addEventListener('change', function() {
    const other = document.getElementById('groupOther');
    if (this.value === 'Другая') {
        other.style.display = 'block';
    } else {
        other.style.display = 'none';
        other.value = '';
    }
    updateContinueBtn();
});
document.getElementById('groupOther').addEventListener('input', updateContinueBtn);

function updateContinueBtn() {
    const fio = document.getElementById('fio').value.trim();
    const group = getSelectedGroup();
    document.getElementById('continueBtn').disabled = !fio || !group;
}

document.getElementById('continueBtn').addEventListener('click', function() {
    const fio = document.getElementById('fio').value.trim();
    const group = getSelectedGroup();
    
    if (!fio || !group) {
        showMessage('❌ Заполните все поля', 'error');
        return;
    }
    
    userData.fio = fio;
    userData.group = group;
    
    // ⚠️ sessionStorage вместо localStorage
    sessionStorage.setItem('pereeks_user', JSON.stringify(userData));
    
    goToStep2();
});

// ⚠️ НОВАЯ КНОПКА: посмотреть записи без записи
document.getElementById('checkOnlyBtn').addEventListener('click', function() {
    const fio = document.getElementById('fio').value.trim();
    
    if (!fio) {
        showMessage('❌ Введите ФИО', 'error');
        return;
    }
    
    findRecordsByFio(fio);
});

// ============================================================
// ============ ШАГ 2: ДИСЦИПЛИНА =============================
// ============================================================

function goToStep2() {
    document.getElementById('step1').style.display = 'none';
    document.getElementById('step3').style.display = 'none';
    document.getElementById('step4').style.display = 'none';
    document.getElementById('step2').style.display = 'block';
    
    document.getElementById('userInfo').textContent = 
        userData.fio + ' | ' + userData.group;
    
    populateDisciplines();
}

function populateDisciplines() {
    const select = document.getElementById('disciplineSelect');
    select.innerHTML = '<option value="">— Выберите —</option>';
    
    allData.disciplines.forEach(d => {
        const option = document.createElement('option');
        option.value = d.name;
        option.textContent = d.name;
        select.appendChild(option);
    });
}

document.getElementById('disciplineSelect').addEventListener('change', function() {
    const discipline = this.value;
    currentDiscipline = discipline;
    
    if (!discipline) {
        hideDisciplineInfo();
        return;
    }
    
    const disc = allData.disciplines.find(d => d.name === discipline);
    if (!disc) {
        hideDisciplineInfo();
        return;
    }
    
    const isActive = allData.activeDisciplines.some(d => d.name === discipline);
    
    if (isActive) {
        showActiveDiscipline(disc);
    } else {
        showClosedDiscipline(disc);
    }
});

function showActiveDiscipline(disc) {
    const infoBlock = document.getElementById('disciplineInfo');
    infoBlock.innerHTML = 
        '🕐 <b>Время:</b> ' + (disc.time || '—') + '<br>' +
        '📅 <b>Дни:</b> ' + (disc.days && disc.days.length ? disc.days.join(', ') : '—') + '<br>' +
        '📌 <b>Запись открыта до:</b> ' + disc.endDate;
    infoBlock.style.display = 'block';
    
    showDisciplineAnnouncements(disc.name);
    
    const btn = document.getElementById('registerBtn');
    btn.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Записаться';
    
    document.getElementById('closedMessage').style.display = 'none';
}

function showClosedDiscipline(disc) {
    const infoBlock = document.getElementById('disciplineInfo');
    infoBlock.style.display = 'none';
    
    const closedBlock = document.getElementById('closedMessage');
    closedBlock.innerHTML = 
        '<div class="closed-title">✅ Запись завершена ' + disc.endDate + '</div>' +
        '<div>Ожидайте распределения.<br>Следите за объявлениями.</div>';
    closedBlock.style.display = 'block';
    
    document.getElementById('registerBtn').style.display = 'none';
    document.getElementById('disciplineAnnouncements').innerHTML = '';
}

function hideDisciplineInfo() {
    document.getElementById('disciplineInfo').style.display = 'none';
    document.getElementById('disciplineAnnouncements').innerHTML = '';
    document.getElementById('closedMessage').style.display = 'none';
    document.getElementById('registerBtn').style.display = 'none';
}

// ============================================================
// ============ РЕГИСТРАЦИЯ ===================================
// ============================================================

document.getElementById('registerBtn').addEventListener('click', async function() {
    if (!currentDiscipline) {
        showMessage('❌ Выберите дисциплину', 'error');
        return;
    }
    
    const btn = this;
    btn.disabled = true;
    btn.textContent = 'Отправка...';
    
    showMessage('⏳ Отправляем запись...', 'info');
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify({
                action: 'register',
                fio: userData.fio,
                group: userData.group,
                discipline: currentDiscipline
            })
        });
        
        const text = await response.text();
        let result;
        
        try {
            result = JSON.parse(text);
        } catch (e) {
            console.error('Ответ не JSON:', text.substring(0, 300));
            throw new Error('Сервер временно недоступен. Попробуйте через минуту.');
        }
        
        if (result.success) {
            document.getElementById('step2').style.display = 'none';
            document.getElementById('step3').style.display = 'block';
            
            document.getElementById('successFio').textContent = userData.fio;
            document.getElementById('successGroup').textContent = userData.group;
            document.getElementById('successDiscipline').textContent = currentDiscipline;
            
        } else if (result.duplicate) {
            showMessage('⚠️ Вы уже записаны на эту дисциплину', 'info');
            btn.disabled = false;
            btn.textContent = 'Записаться';
        } else {
            showMessage('❌ ' + result.error, 'error');
            btn.disabled = false;
            btn.textContent = 'Записаться';
        }
        
    } catch (err) {
        console.error('Ошибка:', err);
        showMessage('❌ ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Записаться';
    }
});

// ============================================================
// ============ ШАГ 3: КНОПКИ =================================
// ============================================================

document.getElementById('anotherBtn').addEventListener('click', function() {
    currentDiscipline = null;
    document.getElementById('disciplineSelect').value = '';
    hideDisciplineInfo();
    
    document.getElementById('step3').style.display = 'none';
    document.getElementById('step2').style.display = 'block';
    document.getElementById('message').textContent = '';
});

document.getElementById('checkMyBtn').addEventListener('click', function() {
    if (userData.fio && userData.group) {
        goToStep4(userData.fio, userData.group);
    }
});

document.getElementById('checkMyBtn2').addEventListener('click', function() {
    if (userData.fio && userData.group) {
        goToStep4(userData.fio, userData.group);
    }
});

document.getElementById('editUserBtn').addEventListener('click', function() {
    document.getElementById('step2').style.display = 'none';
    document.getElementById('step1').style.display = 'block';
    document.getElementById('message').textContent = '';
});

document.getElementById('editUserBtn2').addEventListener('click', function() {
    document.getElementById('step4').style.display = 'none';
    document.getElementById('step1').style.display = 'block';
    document.getElementById('message').textContent = '';
});

// ============================================================
// ============ ШАГ 4: МОИ ЗАПИСИ =============================
// ============================================================

async function goToStep4(fio, group) {
    document.getElementById('step1').style.display = 'none';
    document.getElementById('step2').style.display = 'none';
    document.getElementById('step3').style.display = 'none';
    document.getElementById('step4').style.display = 'block';
    
    document.getElementById('userInfo2').textContent = 
        fio + (group ? ' | ' + group : '');
    
    document.getElementById('myRecords').innerHTML = 
        '<div class="loading">Поиск записей...</div>';
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify({
                action: 'findByFio',
                fio: fio,
                group: group || ''
            })
        });
        
        const text = await response.text();
        let result;
        
        try {
            result = JSON.parse(text);
        } catch (e) {
            console.error('Ответ не JSON:', text.substring(0, 300));
            throw new Error('Сервер временно недоступен');
        }
        
        if (result.success && result.found) {
            renderRecords(result.records);
        } else {
            document.getElementById('myRecords').innerHTML = 
                '<div class="loading">Записей не найдено</div>';
        }
        
    } catch (err) {
        document.getElementById('myRecords').innerHTML = 
            '<div class="loading">❌ ' + err.message + '</div>';
    }
}

// ⚠️ Поиск по ФИО без группы
async function findRecordsByFio(fio) {
    document.getElementById('step1').style.display = 'none';
    document.getElementById('step2').style.display = 'none';
    document.getElementById('step3').style.display = 'none';
    document.getElementById('step4').style.display = 'block';
    
    document.getElementById('userInfo2').textContent = fio;
    
    document.getElementById('myRecords').innerHTML = 
        '<div class="loading">Поиск записей...</div>';
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify({
                action: 'findByFio',
                fio: fio
            })
        });
        
        const text = await response.text();
        let result;
        
        try {
            result = JSON.parse(text);
        } catch (e) {
            throw new Error('Сервер временно недоступен');
        }
        
        if (result.success && result.found) {
            renderRecords(result.records);
        } else {
            document.getElementById('myRecords').innerHTML = 
                '<div class="loading">Записей не найдено</div>';
        }
        
    } catch (err) {
        document.getElementById('myRecords').innerHTML = 
            '<div class="loading">❌ ' + err.message + '</div>';
    }
}

function renderRecords(records) {
    const container = document.getElementById('myRecords');
    container.innerHTML = '';
    
    if (records.length === 0) {
        container.innerHTML = '<div class="loading">Записей не найдено</div>';
        return;
    }
    
    records.forEach(r => {
        const div = document.createElement('div');
        div.className = 'record-card status-' + 
            (r.status || 'напроверке').toLowerCase().replace(/\s+/g, '');
        
        let details = '';
        
        let statusText = r.status || 'На проверке';
        let statusIcon = '⏳';
        if (statusText === 'Записан') statusIcon = '🟢';
        else if (statusText === 'Не записан') statusIcon = '🔴';
        else if (statusText === 'Не допущен') statusIcon = '❌';
        
        if (r.day && r.time) {
            details += '📅 <b>День:</b> ' + r.day + '<br>';
            details += '🕐 <b>Время:</b> ' + r.time;
        } else if (statusText === 'Записан') {
            details += '📅 День и время будут назначены';
        }
        
        let commentHtml = '';
        if (r.comment) {
            commentHtml = '<div class="record-comment">💬 ' + r.comment + '</div>';
        }
        
        let extraStatus = '';
        if (r.status2) {
            let s2Icon = '⏳';
            if (r.status2 === 'Сдал') s2Icon = '✅';
            else if (r.status2 === 'Не сдал') s2Icon = '❌';
            extraStatus = '<div class="record-status">📝 <b>Лейко-формула:</b> ' + 
                          s2Icon + ' ' + r.status2 + '</div>';
        }
        
        let groupHtml = '';
        if (r.group) {
            groupHtml = '<div class="record-group">👥 ' + r.group + '</div>';
        }
        
        div.innerHTML = 
            '<div class="record-discipline">📚 ' + r.discipline + '</div>' +
            groupHtml +
            '<div class="record-status"><b>Статус записи:</b> ' + statusIcon + ' ' + statusText + '</div>' +
            extraStatus +
            '<div class="record-details">' + details + '</div>' +
            commentHtml;
        
        container.appendChild(div);
    });
}

document.getElementById('backBtn').addEventListener('click', function() {
    document.getElementById('step4').style.display = 'none';
    
    if (userData.fio && userData.group) {
        document.getElementById('step2').style.display = 'block';
    } else {
        document.getElementById('step1').style.display = 'block';
    }
    
    document.getElementById('message').textContent = '';
});

// ============================================================
// ============ СООБЩЕНИЯ =====================================
// ============================================================

function showMessage(text, type) {
    const msg = document.getElementById('message');
    msg.textContent = text;
    msg.className = type || '';
}

// ============================================================
// ============ ЗАПУСК ========================================
// ============================================================

document.addEventListener('DOMContentLoaded', loadData);
