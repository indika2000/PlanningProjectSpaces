/**
 * Engine – generates a self-contained HTML page for the text adventure game,
 * designed to run inside a sandboxed iframe (the "artifact" screen).
 */
const Engine = (() => {

  /**
   * Build a full HTML document string that plays the adventure game.
   * @param {Object} gameData - { title, scenes, startScene }
   * @returns {string} Complete HTML document
   */
  function build(gameData) {
    const scenesJSON = JSON.stringify(gameData.scenes);
    const startScene = gameData.startScene || Object.keys(gameData.scenes)[0];
    const title = gameData.title || 'Text Adventure';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    height: 100%;
    font-family: 'Segoe UI', system-ui, sans-serif;
    background: #0a0c12;
    color: #d4d7e5;
  }
  body {
    display: flex;
    justify-content: center;
    padding: 40px 20px;
  }
  .game-container {
    max-width: 640px;
    width: 100%;
  }
  .game-title {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #555a72;
    margin-bottom: 32px;
    text-align: center;
  }
  .scene-title {
    font-size: 22px;
    font-weight: 700;
    color: #e8eaf3;
    margin-bottom: 16px;
    line-height: 1.3;
  }
  .scene-text {
    font-size: 16px;
    line-height: 1.75;
    color: #b0b4cc;
    margin-bottom: 32px;
    white-space: pre-wrap;
  }
  .choices {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .choice-btn {
    display: block;
    width: 100%;
    padding: 14px 20px;
    font-family: inherit;
    font-size: 15px;
    text-align: left;
    background: #161823;
    color: #c8cbdf;
    border: 1px solid #2a2e42;
    border-radius: 10px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.2s, transform 0.1s;
  }
  .choice-btn:hover {
    background: #1e2136;
    border-color: #6c5ce7;
    transform: translateX(4px);
  }
  .choice-btn:active { transform: translateX(2px); }
  .choice-btn .choice-num {
    display: inline-block;
    width: 24px;
    height: 24px;
    line-height: 24px;
    text-align: center;
    border-radius: 6px;
    background: rgba(108,92,231,0.15);
    color: #6c5ce7;
    font-size: 12px;
    font-weight: 700;
    margin-right: 12px;
    vertical-align: middle;
  }
  .end-msg {
    text-align: center;
    padding: 40px 20px;
    color: #555a72;
    font-size: 15px;
  }
  .end-msg button {
    margin-top: 20px;
    padding: 12px 28px;
    font-family: inherit;
    font-size: 14px;
    background: #6c5ce7;
    color: #fff;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
  }
  .end-msg button:hover { background: #7f71ed; }

  /* Scroll history */
  .history-entry { margin-bottom: 40px; opacity: 0.5; }
  .history-entry .scene-title { font-size: 16px; color: #7a7e96; }
  .history-entry .scene-text { font-size: 14px; color: #5e6280; margin-bottom: 8px; }
  .history-entry .chosen { font-size: 13px; color: #6c5ce7; font-style: italic; }

  .current-entry { animation: fadeIn 0.3s ease; }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
</style>
</head>
<body>
<div class="game-container" id="game">
  <div class="game-title" id="game-title"></div>
  <div id="history"></div>
  <div id="current" class="current-entry"></div>
</div>
<script>
(function() {
  const scenes = ${scenesJSON};
  const startScene = ${JSON.stringify(startScene)};
  const title = ${JSON.stringify(title)};

  const historyEl  = document.getElementById('history');
  const currentEl  = document.getElementById('current');
  document.getElementById('game-title').textContent = title;

  let currentSceneId = null;

  function renderScene(sceneId) {
    // Push previous scene to history
    if (currentSceneId && scenes[currentSceneId]) {
      const prev = scenes[currentSceneId];
      const entry = document.createElement('div');
      entry.className = 'history-entry';
      entry.innerHTML =
        '<div class="scene-title">' + esc(prev.title) + '</div>' +
        '<div class="scene-text">' + esc(prev.text) + '</div>';
      historyEl.appendChild(entry);
    }

    currentSceneId = sceneId;
    const scene = scenes[sceneId];

    if (!scene) {
      currentEl.innerHTML =
        '<div class="end-msg">' +
        '<p>The adventure ends here.</p>' +
        '<button onclick="location.reload()">Play Again</button>' +
        '</div>';
      return;
    }

    let html =
      '<div class="scene-title">' + esc(scene.title) + '</div>' +
      '<div class="scene-text">' + esc(scene.text) + '</div>';

    if (scene.choices && scene.choices.length > 0) {
      html += '<div class="choices">';
      scene.choices.forEach(function(ch, i) {
        html += '<button class="choice-btn" data-target="' + esc(ch.target) + '">' +
                '<span class="choice-num">' + (i + 1) + '</span>' +
                esc(ch.label) +
                '</button>';
      });
      html += '</div>';
    } else {
      html += '<div class="end-msg">' +
              '<p>The adventure ends here.</p>' +
              '<button onclick="location.reload()">Play Again</button>' +
              '</div>';
    }

    currentEl.innerHTML = html;
    currentEl.className = 'current-entry';

    // Bind choice buttons
    currentEl.querySelectorAll('.choice-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        // Record chosen text in history
        var lastHistory = historyEl.lastElementChild;
        if (!lastHistory) {
          // Create history for current scene before navigating
        }
        var chosenLabel = btn.textContent.trim();
        renderScene(btn.getAttribute('data-target'));
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      });
    });

    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  renderScene(startScene);
})();
</script>
</body>
</html>`;
  }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { build };
})();
