/**
 * Engine – generates a self-contained HTML page for the text adventure game,
 * designed to run inside a sandboxed iframe (the "artifact" screen).
 * Supports an optional splash screen before game start.
 */
const Engine = (() => {

  /**
   * Build a full HTML document string that plays the adventure game.
   * @param {Object} gameData - { title, subtitle, scenes, startScene, splashSvg }
   * @returns {string} Complete HTML document
   */
  function build(gameData) {
    const scenesJSON = JSON.stringify(gameData.scenes);
    const startScene = gameData.startScene || Object.keys(gameData.scenes)[0];
    const title = gameData.title || 'Text Adventure';
    const subtitle = gameData.subtitle || '';
    const splashSvg = gameData.splashSvg || '';
    const hasSplash = !!splashSvg;

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

  /* ---- Splash Screen ---- */
  .splash-screen {
    position: fixed;
    inset: 0;
    background: #0a0c12;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 100;
    transition: opacity 0.8s ease, visibility 0.8s ease;
  }
  .splash-screen.fade-out {
    opacity: 0;
    visibility: hidden;
  }
  .splash-svg {
    width: 90%;
    max-width: 600px;
    margin-bottom: 40px;
    opacity: 0;
    transform: translateY(20px);
    animation: splashFadeIn 1s ease 0.3s forwards;
  }
  .splash-title {
    font-size: 36px;
    font-weight: 700;
    color: #e8eaf3;
    letter-spacing: -0.5px;
    margin-bottom: 8px;
    opacity: 0;
    animation: splashFadeIn 0.8s ease 0.8s forwards;
  }
  .splash-subtitle {
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 3px;
    color: #6c5ce7;
    margin-bottom: 48px;
    opacity: 0;
    animation: splashFadeIn 0.8s ease 1s forwards;
  }
  .splash-begin {
    padding: 16px 48px;
    font-family: inherit;
    font-size: 16px;
    font-weight: 600;
    background: transparent;
    color: #6c5ce7;
    border: 2px solid #6c5ce7;
    border-radius: 12px;
    cursor: pointer;
    letter-spacing: 2px;
    text-transform: uppercase;
    transition: background 0.3s, color 0.3s, transform 0.15s, box-shadow 0.3s;
    opacity: 0;
    animation: splashFadeIn 0.8s ease 1.3s forwards;
  }
  .splash-begin:hover {
    background: #6c5ce7;
    color: #fff;
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(108, 92, 231, 0.3);
  }
  .splash-begin:active { transform: translateY(0); }

  @keyframes splashFadeIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ---- Game Container ---- */
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

  /* To-be-continued styling */
  .end-msg .tbc {
    font-size: 20px;
    font-weight: 600;
    color: #6c5ce7;
    margin-bottom: 12px;
    letter-spacing: 1px;
  }
</style>
</head>
<body>
${hasSplash ? `
<div class="splash-screen" id="splash">
  <div class="splash-svg">${splashSvg}</div>
  <div class="splash-title">${esc(title)}</div>
  <div class="splash-subtitle">${esc(subtitle)}</div>
  <button class="splash-begin" id="splash-begin">Begin</button>
</div>
` : ''}
<div class="game-container" id="game" ${hasSplash ? 'style="display:none"' : ''}>
  <div class="game-title" id="game-title"></div>
  <div id="history"></div>
  <div id="current" class="current-entry"></div>
</div>
<script>
(function() {
  var scenes = ${scenesJSON};
  var startScene = ${JSON.stringify(startScene)};
  var title = ${JSON.stringify(title)};
  var hasSplash = ${hasSplash};

  var historyEl  = document.getElementById('history');
  var currentEl  = document.getElementById('current');
  var gameEl     = document.getElementById('game');
  document.getElementById('game-title').textContent = title;

  var currentSceneId = null;

  function startGame() {
    if (hasSplash) {
      var splash = document.getElementById('splash');
      splash.classList.add('fade-out');
      gameEl.style.display = '';
      setTimeout(function() { splash.remove(); }, 900);
    }
    renderScene(startScene);
  }

  if (hasSplash) {
    document.getElementById('splash-begin').addEventListener('click', startGame);
  } else {
    startGame();
  }

  function renderScene(sceneId) {
    // Push previous scene to history
    if (currentSceneId && scenes[currentSceneId]) {
      var prev = scenes[currentSceneId];
      var entry = document.createElement('div');
      entry.className = 'history-entry';
      entry.innerHTML =
        '<div class="scene-title">' + esc(prev.title) + '</div>' +
        '<div class="scene-text">' + esc(prev.text) + '</div>';
      historyEl.appendChild(entry);
    }

    currentSceneId = sceneId;
    var scene = scenes[sceneId];

    if (!scene) {
      currentEl.innerHTML =
        '<div class="end-msg">' +
        '<p>The adventure ends here.</p>' +
        '<button onclick="location.reload()">Play Again</button>' +
        '</div>';
      return;
    }

    var html =
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
              '<p class="tbc">To be continued...</p>' +
              '<p>Chapter 1 complete.</p>' +
              '<button onclick="location.reload()">Play Again</button>' +
              '</div>';
    }

    currentEl.innerHTML = html;
    currentEl.className = 'current-entry';

    // Bind choice buttons
    currentEl.querySelectorAll('.choice-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
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
