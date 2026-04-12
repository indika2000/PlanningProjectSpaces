/**
 * App – wires up Play, Import/Export, Resize, Fullscreen, and loads Chapter 1.
 * Fetches the splash screen SVG and injects it into the game data.
 */
(function () {
  const previewFrame       = document.getElementById('preview-frame');
  const previewPlaceholder = document.getElementById('preview-placeholder');
  const previewPanel       = document.getElementById('preview-panel');
  const editorPanel        = document.getElementById('editor-panel');
  const resizer            = document.getElementById('resizer');

  // Splash SVG cache
  let splashSvgCache = '';

  // Fetch the splash SVG at startup
  fetch('assets/splash.svg')
    .then(function(r) { return r.text(); })
    .then(function(svg) { splashSvgCache = svg; })
    .catch(function() { splashSvgCache = ''; });

  /* ==================== Play ==================== */
  function play() {
    Editor.saveScene();
    const data = Editor.exportGame();
    if (!data.startScene || !Object.keys(data.scenes).length) {
      alert('Add at least one scene before playing.');
      return;
    }
    // Inject splash SVG if available
    data.splashSvg = splashSvgCache;
    const html = Engine.build(data);
    const blob = new Blob([html], { type: 'text/html' });
    previewFrame.src = URL.createObjectURL(blob);
    previewPlaceholder.classList.add('hidden');
  }

  document.getElementById('btn-play').onclick    = play;
  document.getElementById('btn-restart').onclick = play;

  /* ==================== New ==================== */
  document.getElementById('btn-new').onclick = () => {
    Editor.newGame();
    previewFrame.src = 'about:blank';
    previewPlaceholder.classList.remove('hidden');
  };

  /* ==================== Export ==================== */
  document.getElementById('btn-export').onclick = () => {
    Editor.saveScene();
    const data = Editor.exportGame();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (data.title || 'adventure').replace(/\s+/g, '_') + '.json';
    a.click();
  };

  /* ==================== Import ==================== */
  const fileInput = document.getElementById('file-import');
  document.getElementById('btn-import').onclick = () => fileInput.click();
  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.scenes) throw new Error('Invalid format');
        Editor.importGame(data);
        previewFrame.src = 'about:blank';
        previewPlaceholder.classList.remove('hidden');
      } catch (err) {
        alert('Failed to import: ' + err.message);
      }
    };
    reader.readAsText(file);
    fileInput.value = '';
  };

  /* ==================== Fullscreen ==================== */
  document.getElementById('btn-fullscreen').onclick = () => {
    previewPanel.classList.toggle('fullscreen');
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') previewPanel.classList.remove('fullscreen');
  });

  /* ==================== Resizer ==================== */
  let isResizing = false;
  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizer.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const newWidth = Math.max(280, Math.min(e.clientX, window.innerWidth - 300));
    editorPanel.style.width = newWidth + 'px';
  });
  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      resizer.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });

  /* ==================== Mobile Tabs ==================== */
  const mobileTabs = document.getElementById('mobile-tabs');
  const splitPane  = document.querySelector('.split-pane');

  // Set initial state
  splitPane.setAttribute('data-active-tab', 'editor');

  mobileTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.mobile-tab');
    if (!tab) return;
    const target = tab.dataset.tab;
    splitPane.setAttribute('data-active-tab', target);
    mobileTabs.querySelectorAll('.mobile-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
  });

  // Auto-switch to preview when Play is pressed on mobile
  const origPlay = play;
  function playMobile() {
    origPlay();
    if (window.innerWidth <= 768) {
      splitPane.setAttribute('data-active-tab', 'preview');
      mobileTabs.querySelectorAll('.mobile-tab').forEach(t => t.classList.remove('active'));
      mobileTabs.querySelector('[data-tab="preview"]').classList.add('active');
    }
  }
  document.getElementById('btn-play').onclick    = playMobile;
  document.getElementById('btn-restart').onclick = playMobile;

  /* ==================== Keyboard shortcut ==================== */
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd+Enter = Play
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      playMobile();
    }
    // Ctrl/Cmd+S = Save scene
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      Editor.saveScene();
    }
  });

  /* ==================== Load Chapter 1 as starter ==================== */
  // Chapter1 is defined in chapter1.js, loaded before this script
  if (typeof Chapter1 !== 'undefined') {
    Editor.importGame(Chapter1);
  }

})();
