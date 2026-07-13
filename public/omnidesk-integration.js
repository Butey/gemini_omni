$(function() {
    const URL = 'https://iridi.com';
    
    // --- 1. Инъекция стилей (Вынесено из inline) ---
    $('<style>').html(`
        .iRidiSelectDropdown.select2-drop { background-color:#fff; color:#000; }
        .iRidiSelectDropdown .select2-results .select2-highlighted { background:#ddd; }	
        .iRidiSelectDropdown .select2-no-results { background:#fff; color:#000; }	
        .iRidiSelectDropdown .select2-search input { background:#fff; color:#000; }
        .iridi-btn { pointer-events:auto; font-weight:bold; justify-content:center; display:flex; cursor:pointer; padding:5px; margin:15px 0px; border-radius:3px; }
        .iridi-modal { display:none; position:fixed; top:0; left:0; width:100%; height:100%; align-items:center; justify-content:center; padding:20px; z-index:9999; background:rgba(0,0,0,0.4); }
        .iridi-modal-content { padding:20px; background:#ffffff; box-shadow:0 0 30px rgba(0,0,0,0.5); max-width:500px; width:100%; display:flex; flex-direction:column; border-radius:8px; color:#000; }
        .iridi-input { border:1px solid #3AB34A; background:#ffffff; color:#000; padding: 8px; border-radius: 4px; }
    `).appendTo('head');

    // --- 2. Глобальные переменные ---
    console.log('AI Widget Integration: Starting initialization');
    const CASE_URL = document.location.href;
    console.log('AI Widget Integration: Current URL', CASE_URL);
    
    // Попытка извлечь ID из URL
    let extractedCaseId = '';
    const matchCaseId = CASE_URL.match(/(?:cases|record)s?\/.*?([0-9-]+)(?:[/?#]|$)/i) || CASE_URL.match(/\/([0-9-]+)(?:[/?#][^/]*)?$/);
    if (matchCaseId) {
        extractedCaseId = matchCaseId[1];
        console.log('AI Widget Integration: Extracted Case ID from URL', extractedCaseId);
    } else {
        console.log('AI Widget Integration: Could not extract Case ID from URL');
    }
    
    const CASE_ID = (typeof CurrentCaseId !== 'undefined' && CurrentCaseId) ? CurrentCaseId : extractedCaseId;
    console.log('AI Widget Integration: Final CASE_ID used', CASE_ID);
    const USER_ID = typeof CurrentUserId !== 'undefined' ? CurrentUserId : '';
    const CurrentCaseNumber = CASE_ID;

    const INFORMATION_PANEL_SELECTOR = '#info_user_info_panel';
    const HORIZONTAL_MENU_ELEMENTS_SELECTOR = '.primary-nav';

    // --- 3. Конфигурация кнопок AMO (Устранение дублирования) ---
    const amoButtons = [
        { id: 'iridi_product', text: 'Выбрать продукт', bg: '#FF0033', color: '#fff', action: 'modal' },
        { id: 'iridi_sale', text: 'Передать в ОП', bg: '#F6CB4B', color: '#000', type: 'commerce' },
        { id: 'iridi_presale', text: 'Передать пресейлам', bg: '#B784A7', color: '#000', type: 'presale' },
        { id: 'iridi_edu', text: 'Необходимо обучение', bg: '#1E2EB8', color: '#fff', type: 'education' },
        { id: 'iridi_mkd', text: 'Проект МКД', bg: '#FC6467', color: '#fff', type: 'mkd' },
        { id: 'iridi_sc', text: 'Заявка в СЦ', bg: '#0EA2FF', color: '#fff', action: 'modal' },
        { id: 'iridi_service', text: 'Сервисный центр', bg: '#00C7FD', color: '#fff', type: 'service' },
        { id: 'iridi_idea', text: 'Отправить в идеи', bg: '#3AB34A', color: '#fff', action: 'modal' },
        { id: 'iridi_projects', text: 'Проекты', bg: '#003C87', color: '#fff', action: 'modal' }
    ];

    // --- 4. Утилиты ---
    const getEmails = () => $(".info_fields .click_target_wrap").map(function() { return $(this).text(); }).get();
    const safeText = (str) => $('<div>').text(str || '').html(); // Защита от XSS
    
    const copyToClipboard = async (text) => {
        if (navigator.clipboard && window.isSecureContext) {
            try { await navigator.clipboard.writeText(text); return true; } catch (err) {}
        }
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try { document.execCommand('copy'); return true; } 
        catch (err) { return false; } 
        finally { document.body.removeChild(textarea); }
    };

    // --- 5. Генерация DOM ---
    const buttonsHtml = amoButtons.map(btn => 
        `<div id="${btn.id}" class="iridi-btn" data-type="${btn.type || ''}" data-action="${btn.action || 'api'}" style="background:${btn.bg}; color:${btn.color};">${btn.text}</div>`
    ).join('');

    const modalsHtml = `
        <div id="iridi_idea_modal" class="iridi-modal">
            <div class="iridi-modal-content">
                <textarea class="iridi-input" id="iridi_idea_text" placeholder="Комментарий"></textarea>
                <select class="iridi-input" style="margin-top:15px;" id="iridi_idea_type">
                    <option value="Home/Bus77/KNX">Home/Bus77/KNX</option>
                    <option value="ProAV/i3 Pro/ЛК">ProAV/i3 Pro/ЛК</option>
                    <option value="SCADA/BMS">SCADA/BMS</option>
                </select>
                <div id="iridi_idea_result" style="margin-top:20px;font-weight:bold;"></div>
                <div style="display:flex;justify-content:space-between;margin-top:20px;">
                    <div class="iridi-btn" style="background:#FC6467;color:#fff;margin:0;" data-close="iridi_idea_modal">Закрыть</div>
                    <div class="iridi-btn" style="background:#3AB34A;color:#fff;margin:0;" id="iridi_idea_send">Отправить</div>
                </div>
            </div>
        </div>
        <div id="iridi_projects_modal" class="iridi-modal">
            <div class="iridi-modal-content" style="max-height:80vh;overflow-y:auto;">
                <input class="iridi-input" id="iridi_projects_bx_id" placeholder="Bitrix ID*">
                <input class="iridi-input" style="margin-top:15px;" id="iridi_projects_bx_company_id" placeholder="Bitrix company ID">
                <div id="iridi_projects_result" style="margin-top:20px;display:flex;flex-direction:column;gap:5px;"></div>    
                <div style="display:flex;justify-content:space-between;margin-top:20px;">
                    <div class="iridi-btn" style="background:#FC6467;color:#fff;margin:0;" data-close="iridi_projects_modal">Закрыть</div>
                    <div class="iridi-btn" style="background:#3AB34A;color:#fff;margin:0;" id="iridi_projects_send">Поиск</div>
                </div>
            </div>
        </div>
        <div id="iridi_product_modal" class="iridi-modal">
            <div class="iridi-modal-content">
                <select style="margin-top:15px;width:100%;" id="iridi_product_select"></select>
                <div style="display:flex;justify-content:space-between;margin-top:20px;">
                    <div class="iridi-btn" style="background:#FC6467;color:#fff;margin:0;" data-close="iridi_product_modal">Закрыть</div>
                    <div class="iridi-btn" style="background:#3AB34A;color:#fff;margin:0;" id="iridi_product_choose">Выбрать</div>
                </div>
            </div>
        </div>
        <div id="iridi_sc_modal" class="iridi-modal">
            <div class="iridi-modal-content">
                <input class="iridi-input" id="iridi_sc_company" value="${safeText($("#field_7").val())}" placeholder="Компания" type="text">
                <input class="iridi-input" style="margin-top:10px;" id="iridi_sc_serial" value="${safeText($("#field_10705").val())}" placeholder="Серийный номер" type="text">
                <textarea class="iridi-input" rows="5" style="margin-top:10px;" id="iridi_sc_desc" placeholder="Описание проблемы"></textarea>
                <div id="iridi_sc_result" style="margin-top:20px;font-weight:bold;"></div>
                <div style="display:flex;justify-content:space-between;margin-top:20px;">
                    <div class="iridi-btn" style="background:#FC6467;color:#fff;margin:0;" data-close="iridi_sc_modal">Закрыть</div>
                    <div class="iridi-btn" style="background:#3AB34A;color:#fff;margin:0;" id="iridi_sc_send">Отправить</div>
                </div>
            </div>
        </div>
    `;

    const amoBlockHtml = `
        <div class="info_header clearfix"><p>AMOCRM</p></div>
        <div class="info_fields">${buttonsHtml}${modalsHtml}</div>
        <div class="info_fields"><div style="font-size:16px;font-weight:bold;" id="amo_result"></div></div>
        <div class="info_header clearfix"><p>Дополнительная информация</p></div>
        <div id="iridi_user_info_container"></div>
    `;

    // Ищем блок последних обращений для вставки кнопок под него
    const $casesPanel = $('#info_user_cases_panel');
    if ($casesPanel.length > 0) {
        $casesPanel.after(amoBlockHtml);
    } else {
        const $casesHeader = $('.info_header:contains("Последние обращения"), .info_header:contains("Предыдущие обращения")').last();
        if ($casesHeader.length > 0) {
            const $nextFields = $casesHeader.next('.info_fields');
            if ($nextFields.length > 0) {
                $nextFields.after(amoBlockHtml);
            } else {
                $casesHeader.after(amoBlockHtml);
            }
        } else {
            // Фолбэк, если блок не найден
            $(INFORMATION_PANEL_SELECTOR).append(amoBlockHtml);
        }
    }

    $(HORIZONTAL_MENU_ELEMENTS_SELECTOR).append(`
        <li class="nav-item nav-item-companies inlb"><a class="nav-item-url" target="_blank" href="https://dev.iridi.com/Main_page">Wiki</a></li>
        <li class="nav-item nav-item-companies inlb"><a class="nav-item-url" target="_blank" href="https://docs.google.com/spreadsheets/d/19PjQnLPuWRa3zfJPgOSDaL8H8hdwjD-7K8zWN5hQYrE/edit#gid=1992931452">Идеи</a></li>
        <li class="nav-item nav-item-companies inlb"><a class="nav-item-url" target="_blank" href="https://docs.google.com/spreadsheets/d/1KURB2GmuW_d3h6DheHjEYfsY2BKqDFWbJu56sVm8upY/edit#gid=1979570075">ТП</a></li>
    `);

    // --- 6. События ---
    $(document).on('click', '[data-close]', function() { $(`#${$(this).data('close')}`).css("display", "none"); });

    // Единый обработчик для простых API кнопок AMO
    $('.iridi-btn[data-action="api"]').on('click', async function() {
        const btn = $(this);
        const originalBg = btn.css('background');
        
        $("#amo_result").text('Загрузка...');
        btn.css({"pointer-events": "none", "background": "#E9E9E9"});
        
        try {
            const res = await $.post(`${URL}/system/omnidesk_handler.php`, { user_id: USER_ID, case_id: CASE_ID, case_url: CASE_URL, type: btn.data('type'), emails: getEmails() });
            const data = typeof res === 'string' ? JSON.parse(res) : res;
            $("#amo_result").text(data.msg || 'Успешно');
        } catch (e) {
            $("#amo_result").text('Ошибка сервера сети');
        } finally {
            btn.css({"pointer-events": "auto", "background": originalBg});
        }
    });

    $('#iridi_idea').on('click', () => $('#iridi_idea_modal').css('display', 'flex'));
    $('#iridi_sc').on('click', () => $('#iridi_sc_modal').css('display', 'flex'));
    $('#iridi_projects').on('click', () => $('#iridi_projects_modal').css('display', 'flex'));

    // Работа с модалками
    $('#iridi_product').on('click', async () => {
        $('#iridi_product_modal').css('display', 'flex');
        try {
            const res = await $.get(`${URL}/system/omnidesk/products.php`);
            const data = typeof res === 'string' ? JSON.parse(res) : res;
            const $sel = $('#iridi_product_select').empty().append('<option value="">Выберите продукт</option>');
            data.forEach(item => {
                const text = item.UF_CODE ? `${item.UF_NAME} | ${item.UF_CODE}` : item.UF_NAME;
                $sel.append($('<option>', { value: text, text: text }));
            });
            $sel.select2({ dropdownParent: $('#iridi_product_modal'), width: '100%', dropdownCssClass: 'iRidiSelectDropdown' });
        } catch(e) {}
    });

    $('#iridi_product_choose').on('click', () => {
        $("#field_11439").val($('#iridi_product_select').val());
        $('[data-close="iridi_product_modal"]').click();
    });

    $('#iridi_idea_send').on('click', async function() {
        const btn = $(this);
        btn.css({"pointer-events":"none", "opacity": "0.5"});
        $("#iridi_idea_result").text('Отправка...');
        
        try {
            const res = await $.post(`${URL}/system/omnidesk/api/googletable/sheet.php`, { case_id: CASE_ID, type: $("#iridi_idea_type").val(), case_url: CASE_URL, comment: $("#iridi_idea_text").val() });
            const data = typeof res === 'string' ? JSON.parse(res) : res;
            $("#iridi_idea_result").text(data.msg);
            if(data.status == 200) $('[data-close="iridi_idea_modal"]').click();
        } catch(e) {
            $("#iridi_idea_result").text('Ошибка');
        } finally {
            btn.css({"pointer-events":"auto", "opacity": "1"});
        }
    });

    $('#iridi_sc_send').on('click', async function() {
        const btn = $(this);
        btn.css({"pointer-events":"none", "opacity": "0.5"});
        $("#iridi_sc_result").text('Отправка...');
        
        let fd = new FormData();
        fd.append('ticketId', CASE_ID);
        fd.append('pass', "P67AUyr980ure75Gjer4H"); // ВНИМАНИЕ: Секрет необходимо валидировать на бэкенде!
        fd.append('ticketNumber', CurrentCaseNumber);
        fd.append('ticketUrl', CASE_URL);
        fd.append('ticketDescription', $("#iridi_sc_desc").val());
        fd.append('companyName', $("#iridi_sc_company").val());
        fd.append('hardwareSerial', $("#iridi_sc_serial").val());		
        
        try {
            const result = await $.ajax({ url: 'https://servicecenter.iridi.com/api/request/add', type: 'POST', data: fd, processData: false, contentType: false });
            if(result.data?._id){
                $("#iridi_sc_result").html(`<span style="color:#0EA2FF;cursor:pointer;" class="scRes">https://iridi.com/sc/?mid=${result.data._id}</span>`);
                btn.hide();
            } else {
                $("#iridi_sc_result").text(result.error || 'Ошибка');
            }
        } catch(e) { $("#iridi_sc_result").text('Ошибка сети'); } 
        finally { btn.css({"pointer-events":"auto", "opacity": "1"}); }
    });

    $(document).on("click", ".scRes", function() { copyToClipboard($(this).text()); });

    $('#iridi_projects_send').on('click', async function() {
        const bxUserId = $("#iridi_projects_bx_id").val();
        if(!bxUserId) return $("#iridi_projects_result").text('Укажите Bitrix ID');
        
        const btn = $(this);
        btn.css({"pointer-events":"none", "opacity": "0.5"});
        $("#iridi_projects_result").empty().text('Поиск...');
        
        try {
            const res = await $.post(`${URL}/system/omnidesk/preg.php`, {user: bxUserId, company: $("#iridi_projects_bx_company_id").val()});
            const data = typeof res === 'string' ? JSON.parse(res) : res;
            $("#iridi_projects_result").empty();
            
            if(data.status == 200 && data.projects?.length) {
                data.projects.forEach(el => {
                    const div = $('<div>').css({"cursor": "pointer", "padding": "5px", "border": "1px solid #ddd"}).addClass('iridi_projects_el').attr('data-el', JSON.stringify(el)).text(`${el.name} - ${el.id}`);
                    $("#iridi_projects_result").append(div);
                });
            } else { $("#iridi_projects_result").text(data.msg || 'Проекты не найдены'); }
        } catch(e) { $("#iridi_projects_result").text('Ошибка сервера'); } 
        finally { btn.css({"pointer-events":"auto", "opacity": "1"}); }
    });

    $(document).on("click", ".iridi_projects_el", async function() {
        const el = $(this).data("el");
        const hw = (el.hardware || []).concat(el.hardwareExt || []);
        const names = hw.map(item => item?.production?.name).filter(Boolean).join(', ');
        
        const note = [
            el.name && `Название: ${el.name}`,
            el.objectType?.name && `Тип объекта: ${el.objectType.name}`,
            el.objectTypeExt?.name && `Вид объекта: ${el.objectTypeExt.name}`,
            el.address && `Адрес: ${el.address}`,
            el.customerName && `Заказчик: ${el.customerName}`,
            names && `Спецификация iRidi: ${names}`
        ].filter(Boolean).join('\n');

        try {
            const res = await $.post(`${URL}/system/omnidesk/add_note.php`, { case_id: CASE_ID, note: note, pass: "PIQjmnf68lkr5tyhgfg" });
            const data = typeof res === 'string' ? JSON.parse(res) : res;
            if(data.status == 200) $('[data-close="iridi_projects_modal"]').click();
        } catch(e) { console.error(e); }
    });

    // --- 7. Загрузка карточки пользователя ---
    (async () => {
        try {
            const res = await $.get(`${URL}/system/omnidesk/api/getuserinfo.php`, {user_id: USER_ID, emails: getEmails()});
            const data = typeof res === 'string' ? JSON.parse(res) : res;
            const $cont = $('#iridi_user_info_container');
            
            if(data.status == 200 && data.data) {
                const mapData = {
                    'Bitrix ID': data.data.user_id, 'ФИО': `${data.data.name||''} ${data.data.last_name||''}`, 'Тип': data.data.type,
                    'Личный статус': data.data.status, 'Сумма покупок': data.data.sum_buy, 'Компания': data.data.company
                };
                const html = Object.entries(mapData).filter(([, val]) => val).map(([key, val]) => `<h6>${key}</h6><p>${safeText(val)}</p>`).join('');
                $cont.html(`<div class="info_fields">${html}</div>`);
            } else {
                $cont.html(`<div class="info_fields"><p>${safeText(data.error || 'Нет данных')}</p></div>`);
            }
        } catch(e) { $('#iridi_user_info_container').html('<p>Ошибка загрузки клиента</p>'); }
    })();

    // --- 8. AI Виджет (Подключение) ---
    // Создаем контейнер для виджета с возможностью перетаскивания и ресайза
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.left = '20px';
    container.style.width = '380px';
    container.style.height = '96px'; // Starts collapsed
    container.style.zIndex = '999999';
    container.style.borderRadius = '16px';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.backgroundColor = 'transparent';

    const iframe = document.createElement('iframe');
    
    // URL вашего приложения с параметром режима и номером тикета
    const widgetBaseUrl = 'https://ais-pre-2xbqggct6246qnh4ksospm-790449070015.europe-west2.run.app';
    iframe.src = `${widgetBaseUrl}/?mode=widget&case_number=${CASE_ID}`;
    console.log('AI Widget Integration: Setting iframe src to', iframe.src);
    
    // Настраиваем стили iframe
    iframe.style.flex = '1';
    iframe.style.width = '100%';
    iframe.style.border = 'none';
    iframe.style.backgroundColor = 'transparent';
    
    // Элемент для ресайза
    const resizer = document.createElement('div');
    resizer.style.position = 'absolute';
    resizer.style.width = '20px';
    resizer.style.height = '20px';
    resizer.style.right = '4px';
    resizer.style.bottom = '4px';
    resizer.style.cursor = 'nwse-resize';
    resizer.style.zIndex = '10';
    resizer.style.display = 'none'; // Скрыто в свернутом виде
    // Иконка уголка
    resizer.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 100%; height: 100%; opacity: 0.5; color: #94a3b8;"><path d="M21 15L15 21M21 8L8 21"/></svg>';

    container.appendChild(iframe);
    container.appendChild(resizer);

    // Переменные состояния для виджета
    let isDragging = false;
    let isResizing = false;
    let startX, startY;
    let startLeft, startTop;
    let startWidth, startHeight;
    let lastHeight = 600; // для восстановления после сворачивания
    
    // Оверлей для перехвата мыши поверх всех iframes
    const dragOverlay = document.createElement('div');
    dragOverlay.style.position = 'fixed';
    dragOverlay.style.top = '0';
    dragOverlay.style.left = '0';
    dragOverlay.style.width = '100vw';
    dragOverlay.style.height = '100vh';
    dragOverlay.style.zIndex = '99999999';
    dragOverlay.style.display = 'none';
    dragOverlay.style.background = 'transparent';

    // --- ЛОГИКА ПЕРЕТАСКИВАНИЯ ---
    let hasMoved = false;

    function drag(e) {
      if (isDragging) {
        e.preventDefault();
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          hasMoved = true;
        }
        container.style.left = (startLeft + dx) + 'px';
        container.style.top = (startTop + dy) + 'px';
      }
    }

    function dragEnd() {
      if (isDragging) {
        isDragging = false;
        iframe.style.pointerEvents = 'auto'; 
        dragOverlay.style.display = 'none';
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', dragEnd);
        
        console.log('AI Widget Integration: Drag finished', { hasMoved });
        
        // Notify the iframe that drag is finished and whether it was a small click
        iframe.contentWindow.postMessage({
          type: 'OMNIDESK_DRAG_END',
          wasClick: !hasMoved
        }, '*');
      }
    }

    // --- ЛОГИКА МАСШТАБИРОВАНИЯ ---
    resizer.addEventListener('mousedown', function(e) {
      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = container.getBoundingClientRect();
      startWidth = rect.width;
      startHeight = rect.height;
      
      // Переводим в left/top чтобы ресайз не конфликтовал с bottom/right
      switchToLeftTop(rect);
      
      iframe.style.pointerEvents = 'none';
      dragOverlay.style.display = 'block';
      dragOverlay.style.cursor = 'nwse-resize';
      
      document.addEventListener('mousemove', resize);
      document.addEventListener('mouseup', stopResize);
      e.preventDefault();
      e.stopPropagation();
    });

    function resize(e) {
      if (isResizing) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const newWidth = Math.max(300, startWidth + dx); // минимальная ширина
        const newHeight = Math.max(200, startHeight + dy); // минимальная высота
        container.style.width = newWidth + 'px';
        container.style.height = newHeight + 'px';
        lastHeight = newHeight;
      }
    }

    function stopResize(e) {
      isResizing = false;
      iframe.style.pointerEvents = 'auto';
      dragOverlay.style.display = 'none';
      dragOverlay.style.cursor = 'default';
      document.removeEventListener('mousemove', resize);
      document.removeEventListener('mouseup', stopResize);
    }

    function switchToLeftTop(rect) {
      if (!container.style.left || container.style.left === 'auto' || container.style.left === '') {
        container.style.left = rect.left + 'px';
        container.style.top = rect.top + 'px';
        container.style.bottom = 'auto';
        container.style.right = 'auto';
        container.style.transform = 'none';
      }
    }

    
    // Безопасное добавление виджета (дожидаемся появления body)
    function injectWidget() {
      if (document.body) {
        document.body.appendChild(container);
        document.body.appendChild(dragOverlay);
        console.log('AI Widget Integration: Widget container injected into body');
      } else {
        setTimeout(injectWidget, 100);
      }
    }

    if (document.readyState === 'loading' || !document.body) {
      document.addEventListener('DOMContentLoaded', injectWidget);
    } else {
      injectWidget();
    }

    // 3. Обрабатываем событие вставки текста от виджета (защита от дублирования листенеров)
    if (!window.__omniai_listener_registered) {
      window.__omniai_listener_registered = true;
      window.addEventListener('message', function(event) {
        if (event.data && typeof event.data.type === 'string' && event.data.type.startsWith('OMNIDESK_')) {
          console.log('AI Widget Integration: Received message', event.data);
        }
        
        if (event.data && event.data.type === 'OMNIDESK_DRAG_START') {
          isDragging = true;
          hasMoved = false;
          const rect = container.getBoundingClientRect();
          switchToLeftTop(rect);
          
          startX = event.data.clientX + rect.left;
          startY = event.data.clientY + rect.top;
          startLeft = rect.left;
          startTop = rect.top;
          
          iframe.style.pointerEvents = 'none'; // Prevent iframe from stealing mouse events during drag
          dragOverlay.style.display = 'block';
          dragOverlay.style.cursor = 'move';
          
          document.addEventListener('mousemove', drag);
          document.addEventListener('mouseup', dragEnd);
          
          console.log('AI Widget Integration: Drag initiated', { startX, startY, startLeft, startTop });
        }

        if (event.data && event.data.type === 'OMNIDESK_RESIZE_WIDGET') {
          if (event.data.isCollapsed) {
            container.style.height = '96px';
            resizer.style.display = 'none';
          } else {
            container.style.height = lastHeight + 'px';
            resizer.style.display = 'block';
          }
        }
        if (event.data && event.data.type === 'OMNIDESK_INJECT_RESPONSE') {
          const draftText = event.data.content;
          const target = event.data.target || 'message'; // 'message' or 'note'
          
          console.log('AI Widget Integration: Injecting draft response locally, target:', target);
          
          // Проверяем, чат ли это (Телеграм, WhatsApp, чаты Омнидеска имеют специальную структуру)
          const isChatPage = document.querySelector('.chat_chat_msg_win_wrap, .chat_chat_structure') !== null;
          
          if (isChatPage) {
            console.log('AI Widget: Detected Chat/Messenger Case page');
            
            // 1. Управление режимом Заметка/Ответ для чатов через кнопку и hidden input
            const noteInput = document.getElementById('b_response_note');
            const noteButton = document.querySelector('.chat_btn_connect_c, li.chat_btn_connect_c, li[title*="заметку"], li[title*="Заметку"]');
            
            if (noteInput && noteButton) {
              const isNoteActive = noteInput.value === '1';
              if (target === 'note' && !isNoteActive) {
                console.log('AI Widget: Toggling chat mode to Note');
                noteButton.click();
              } else if (target === 'message' && isNoteActive) {
                console.log('AI Widget: Toggling chat mode to Reply');
                noteButton.click();
              }
            }
            
            // 2. Вставка текста в чат-редактор
            const chatTextarea = document.getElementById('comment') || document.querySelector('textarea.chat_msg_win_box');
            if (chatTextarea) {
              chatTextarea.focus();
              const start = chatTextarea.selectionStart;
              const end = chatTextarea.selectionEnd;
              const val = chatTextarea.value;
              
              if (typeof start === 'number' && typeof end === 'number') {
                chatTextarea.value = val.substring(0, start) + draftText + val.substring(end);
                chatTextarea.selectionStart = chatTextarea.selectionEnd = start + draftText.length;
              } else {
                chatTextarea.value = (val ? val + '\n\n' : '') + draftText;
              }
              
              // Генерируем реактивные события
              chatTextarea.dispatchEvent(new Event('input', { bubbles: true }));
              chatTextarea.dispatchEvent(new Event('change', { bubbles: true }));
              chatTextarea.dispatchEvent(new Event('blur', { bubbles: true }));
              chatTextarea.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Process' }));
              chatTextarea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Process' }));
            } else {
              console.warn('AI Widget: Chat editor textarea not found');
            }
          } else {
            console.log('AI Widget: Detected Standard Case/Email page');
            
            // 1. Переключение вкладки Ответ / Заметка в стандартном тикете
            let tabElement = null;
            if (target === 'note') {
              tabElement = document.querySelector('.js-note-tab, #add_note, #note-tab, [data-tab="note"], [data-type="note"], [data-pane="note"]');
              if (!tabElement) {
                tabElement = Array.from(document.querySelectorAll('a, button, span, div, li')).find(el => {
                  const text = el.textContent.trim().toLowerCase();
                  return text === 'заметка' || text === 'добавить заметку' || text === 'внутренняя заметка' || text === 'создать заметку';
                });
              }
            } else {
              tabElement = document.querySelector('.js-reply-tab, .js-chat-tab, #add_message, #reply-tab, #chat-tab, [data-tab="reply"], [data-tab="chat"], [data-type="message"], [data-type="chat"], [data-pane="reply"], [data-pane="chat"]');
              if (!tabElement) {
                tabElement = Array.from(document.querySelectorAll('a, button, span, div, li')).find(el => {
                  const text = el.textContent.trim().toLowerCase();
                  return text === 'ответ' || text === 'написать ответ' || text === 'сообщение' || text === 'ответить' || text === 'чат' || text === 'написать в чат' || text === 'диалог';
                });
              }
            }

            if (tabElement) {
              console.log('AI Widget: Switching ticket tab', tabElement);
              tabElement.click();
            }
            
            // 2. Поиск контейнера формы
            let containerSelector = '';
            let fallbackSelectors = [];
            
            if (target === 'note') {
              containerSelector = '#case_note_form, .note-block, .note_form_block, .js-note-form, .case-note-editor-holder';
              fallbackSelectors = ['textarea[name="note"]', 'textarea#note_content', '#add_note_form'];
            } else {
              containerSelector = '#case_reply_form, #case_chat_form, .reply-block, .chat-block, .reply_form_block, .chat_form_block, .js-reply-form, .js-chat-form, .case-reply-editor-holder, .case-chat-editor-holder, .chat-editor-holder, #chat_block';
              fallbackSelectors = ['textarea[name="content"]', 'textarea#reply_content', '#reply_content', 'textarea[name="chat_message"]', 'textarea[name="message"]', 'textarea.chat-input'];
            }
            
            const container = document.querySelector(containerSelector);
            let editorDiv = null;
            let textarea = null;
            
            if (container) {
              editorDiv = container.querySelector('.redactor-editor, .redactor_editor, div[contenteditable="true"]');
              if (!editorDiv) {
                textarea = container.querySelector('textarea');
              }
            }
            
            // Фолбэк по селекторам из списка
            if (!editorDiv && !textarea) {
              for (const sel of fallbackSelectors) {
                const el = document.querySelector(sel);
                if (el) {
                  if (el.tagName === 'TEXTAREA') textarea = el;
                  else if (el.getAttribute('contenteditable') === 'true' || el.classList.contains('redactor-editor')) editorDiv = el;
                }
              }
            }
            
            // Исключительный фолбэк по всем видимым редакторам
            if (!editorDiv && !textarea) {
              const allEditors = Array.from(document.querySelectorAll('.redactor-editor, .redactor_editor, div[contenteditable="true"]'));
              editorDiv = allEditors.find(el => {
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
              }) || allEditors[0];
            }
            
            // Выполняем вставку
            if (editorDiv) {
              console.log('AI Widget: Inserting into contenteditable editor');
              editorDiv.focus();
              const currentHTML = editorDiv.innerHTML.trim();
              const p = document.createElement('p');
              p.innerText = draftText;
              
              if (currentHTML && currentHTML !== '<p><br></p>') {
                editorDiv.appendChild(p);
              } else {
                editorDiv.innerHTML = '';
                editorDiv.appendChild(p);
              }
              
              editorDiv.dispatchEvent(new Event('input', { bubbles: true }));
              editorDiv.dispatchEvent(new Event('change', { bubbles: true }));
              editorDiv.dispatchEvent(new Event('blur', { bubbles: true }));
              
              // Синхронизация с Redactor jQuery
              try {
                const $editor = window.jQuery ? window.jQuery(editorDiv) : null;
                if ($editor && typeof $editor.redactor === 'function') {
                  $editor.redactor('code.set', editorDiv.innerHTML);
                }
              } catch (e) {
                console.warn('AI Widget: Redactor jQuery synchronization warning', e);
              }
            } else if (textarea) {
              console.log('AI Widget: Inserting into textarea');
              textarea.focus();
              const start = textarea.selectionStart;
              const end = textarea.selectionEnd;
              const val = textarea.value;
              
              if (typeof start === 'number' && typeof end === 'number') {
                textarea.value = val.substring(0, start) + draftText + val.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + draftText.length;
              } else {
                textarea.value = (val ? val + '\n\n' : '') + draftText;
              }
              
              textarea.dispatchEvent(new Event('input', { bubbles: true }));
              textarea.dispatchEvent(new Event('change', { bubbles: true }));
              textarea.dispatchEvent(new Event('blur', { bubbles: true }));
            } else {
              console.warn('AI Widget: No visible editor or textarea found for injection');
            }
          }
        }
      });
    }
});
