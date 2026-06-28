(function() {
  // 1. Получаем номер тикета из URL Omnidesk (например, /cases/123456/)
  const match = window.location.pathname.match(/\/cases\/(\d+)/);
  const caseNumber = match ? match[1] : '';

  // 2. Создаем контейнер для виджета с возможностью перетаскивания
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.bottom = '20px';
  container.style.right = '20px';
  container.style.width = '380px';
  container.style.height = '600px';
  container.style.zIndex = '999999';
  container.style.borderRadius = '16px';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.backgroundColor = 'transparent';

  const iframe = document.createElement('iframe');
  
  // URL вашего приложения с параметром режима и номером тикета
  const widgetBaseUrl = 'https://ais-pre-2xbqggct6246qnh4ksospm-790449070015.europe-west2.run.app';
  iframe.src = `${widgetBaseUrl}/?mode=widget&case_number=${caseNumber}`;
  
  // Настраиваем стили iframe
  iframe.style.flex = '1';
  iframe.style.width = '100%';
  iframe.style.border = 'none';
  iframe.style.backgroundColor = 'transparent';
  
  container.appendChild(iframe);

  // Логика перетаскивания (Drag & Drop) через postMessage
  let isDragging = false;
  let currentX = 0;
  let currentY = 0;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      xOffset = currentX;
      yOffset = currentY;
      container.style.transform = `translate(${currentX}px, ${currentY}px)`;
    }
  }

  function dragEnd(e) {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
    iframe.style.pointerEvents = 'auto'; // Включаем обратно
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', dragEnd);
  }
  
  // Безопасное добавление виджета (дожидаемся появления body)
  function injectWidget() {
    if (document.body) {
      document.body.appendChild(container);
    } else {
      setTimeout(injectWidget, 100);
    }
  }

  if (document.readyState === 'loading' || !document.body) {
    document.addEventListener('DOMContentLoaded', injectWidget);
  } else {
    injectWidget();
  }

  // 3. Обрабатываем событие вставки текста от виджета
  window.addEventListener('message', function(event) {
    // В целях безопасности можно добавить проверку: 
    // if (event.origin !== widgetBaseUrl) return;

    if (event.data && event.data.type === 'OMNIDESK_DRAG_START') {
      isDragging = true;
      // Get container bounding rect to calculate offset correctly
      const rect = container.getBoundingClientRect();
      initialX = event.data.clientX + rect.left - xOffset;
      initialY = event.data.clientY + rect.top - yOffset;
      iframe.style.pointerEvents = 'none'; // Отключаем события iframe при перетаскивании
      
      document.addEventListener('mousemove', drag);
      document.addEventListener('mouseup', dragEnd);
    }

    if (event.data && event.data.type === 'OMNIDESK_RESIZE_WIDGET') {
      if (event.data.isCollapsed) {
        container.style.height = '96px'; // Примерная высота свернутого виджета
      } else {
        container.style.height = '600px';
      }
    }
    if (event.data && event.data.type === 'OMNIDESK_INJECT_RESPONSE') {
      const draftText = event.data.content;
      
      // Ищем поле ответа Omnidesk (обычно это div с классом redactor-editor или textarea)
      const editorDiv = document.querySelector('.redactor-editor') || document.querySelector('.redactor_editor');
      
      if (editorDiv) {
        // Добавляем текст в визуальный редактор
        const p = document.createElement('p');
        p.innerText = draftText;
        editorDiv.appendChild(p);
      } else {
        // Запасной вариант для простых textarea
        const textarea = document.querySelector('textarea[name="content"]') || document.querySelector('#reply_content');
        if (textarea) {
          textarea.value += (textarea.value ? '\n\n' : '') + draftText;
        } else {
          console.warn('AI Widget: Не найдено поле для вставки ответа.');
        }
      }
    }
  });
})();
