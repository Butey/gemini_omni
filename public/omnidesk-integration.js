(function() {
  // 1. Получаем номер тикета из URL Omnidesk (например, /cases/123456/)
  const match = window.location.pathname.match(/\/cases\/(\d+)/);
  const caseNumber = match ? match[1] : '';

  // 2. Создаем iframe виджета
  const iframe = document.createElement('iframe');
  
  // URL вашего приложения с параметром режима и номером тикета
  // Используем window.location.origin виджета, если скрипт отдается с того же домена, 
  // либо жестко задаем Shared App URL
  const widgetBaseUrl = 'https://ais-pre-2xbqggct6246qnh4ksospm-790449070015.europe-west2.run.app';
  iframe.src = `${widgetBaseUrl}/?mode=widget&case_number=${caseNumber}`;
  
  // Настраиваем стили (плавающее окно справа снизу)
  iframe.style.position = 'fixed';
  iframe.style.bottom = '20px';
  iframe.style.right = '20px';
  iframe.style.width = '380px';
  iframe.style.height = '600px';
  iframe.style.border = 'none';
  iframe.style.borderRadius = '16px';
  iframe.style.boxShadow = '0 10px 30px rgba(0,0,0,0.15)';
  iframe.style.zIndex = '999999';
  // Позволяем кликать сквозь прозрачные области, если нужно, или просто оставляем фон виджета
  iframe.style.backgroundColor = 'transparent';
  
  document.body.appendChild(iframe);

  // 3. Обрабатываем событие вставки текста от виджета
  window.addEventListener('message', function(event) {
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
