/**
 * Editor – manages the scene list, scene form, and game data model.
 */
const Editor = (() => {
  // Game data: { title, scenes: { [id]: { id, title, text, choices: [{ label, target }] } }, startScene }
  let game = { title: 'Untitled Adventure', scenes: {}, startScene: null };
  let activeSceneId = null;

  // DOM refs
  const sceneList     = document.getElementById('scene-list');
  const sceneForm     = document.getElementById('scene-form');
  const placeholder   = document.getElementById('editor-placeholder');
  const choicesWrap   = document.getElementById('choices-container');

  const inId    = document.getElementById('scene-id');
  const inTitle = document.getElementById('scene-title');
  const inText  = document.getElementById('scene-text');

  /* ---- Render scene tabs ---- */
  function renderSceneList() {
    sceneList.innerHTML = '';
    const ids = Object.keys(game.scenes);
    if (ids.length === 0) {
      sceneList.innerHTML = '<span style="color:var(--text-dim);font-size:12px;">No scenes yet</span>';
      return;
    }
    ids.forEach(id => {
      const card = document.createElement('div');
      card.className = 'scene-card' + (id === activeSceneId ? ' active' : '') + (id === game.startScene ? ' start-scene' : '');
      card.textContent = game.scenes[id].title || id;
      card.onclick = () => selectScene(id);
      sceneList.appendChild(card);
    });
  }

  /* ---- Select a scene for editing ---- */
  function selectScene(id) {
    activeSceneId = id;
    const scene = game.scenes[id];
    if (!scene) return;

    placeholder.classList.add('hidden');
    sceneForm.classList.remove('hidden');

    inId.value    = scene.id;
    inTitle.value = scene.title;
    inText.value  = scene.text;

    renderChoices(scene.choices);
    renderSceneList();
  }

  /* ---- Render choice rows ---- */
  function renderChoices(choices) {
    choicesWrap.innerHTML = '';
    (choices || []).forEach((ch, i) => {
      addChoiceRow(ch.label, ch.target, i);
    });
  }

  function addChoiceRow(label = '', target = '', index) {
    const row = document.createElement('div');
    row.className = 'choice-row';
    row.innerHTML = `
      <input type="text" class="choice-label" placeholder="Choice text" value="${escHtml(label)}" />
      <input type="text" class="choice-target" placeholder="Target scene ID" value="${escHtml(target)}" />
      <button type="button" class="choice-remove" title="Remove">&times;</button>
    `;
    row.querySelector('.choice-remove').onclick = () => row.remove();
    choicesWrap.appendChild(row);
  }

  /* ---- Collect choices from DOM ---- */
  function collectChoices() {
    return Array.from(choicesWrap.querySelectorAll('.choice-row')).map(row => ({
      label:  row.querySelector('.choice-label').value.trim(),
      target: row.querySelector('.choice-target').value.trim(),
    })).filter(c => c.label && c.target);
  }

  /* ---- Save current scene ---- */
  function saveScene() {
    const id = inId.value.trim().replace(/\s+/g, '_');
    if (!id) return alert('Scene ID is required.');

    // If ID changed, remove old key
    if (activeSceneId && activeSceneId !== id) {
      delete game.scenes[activeSceneId];
      if (game.startScene === activeSceneId) game.startScene = id;
    }

    game.scenes[id] = {
      id,
      title: inTitle.value.trim() || id,
      text:  inText.value.trim(),
      choices: collectChoices(),
    };

    if (!game.startScene) game.startScene = id;
    activeSceneId = id;
    renderSceneList();
  }

  /* ---- Delete scene ---- */
  function deleteScene() {
    if (!activeSceneId) return;
    if (!confirm(`Delete scene "${activeSceneId}"?`)) return;
    delete game.scenes[activeSceneId];
    if (game.startScene === activeSceneId) {
      const ids = Object.keys(game.scenes);
      game.startScene = ids.length ? ids[0] : null;
    }
    activeSceneId = null;
    sceneForm.classList.add('hidden');
    placeholder.classList.remove('hidden');
    renderSceneList();
  }

  /* ---- New scene ---- */
  function addScene() {
    const count = Object.keys(game.scenes).length;
    const id = 'scene_' + (count + 1);
    game.scenes[id] = { id, title: 'New Scene', text: '', choices: [] };
    if (!game.startScene) game.startScene = id;
    selectScene(id);
  }

  /* ---- Import / Export ---- */
  function exportGame() {
    // Auto-save current scene before export
    if (activeSceneId) saveScene();
    return JSON.parse(JSON.stringify(game));
  }

  function importGame(data) {
    game = JSON.parse(JSON.stringify(data));
    activeSceneId = null;
    sceneForm.classList.add('hidden');
    placeholder.classList.remove('hidden');
    renderSceneList();
    // Auto-select start scene
    if (game.startScene && game.scenes[game.startScene]) {
      selectScene(game.startScene);
    }
  }

  function newGame() {
    if (Object.keys(game.scenes).length && !confirm('Start a new game? Unsaved changes will be lost.')) return;
    game = { title: 'Untitled Adventure', scenes: {}, startScene: null };
    activeSceneId = null;
    sceneForm.classList.add('hidden');
    placeholder.classList.remove('hidden');
    renderSceneList();
  }

  /* ---- Helpers ---- */
  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* ---- Wire up buttons ---- */
  document.getElementById('btn-add-scene').onclick  = addScene;
  document.getElementById('btn-save-scene').onclick = saveScene;
  document.getElementById('btn-delete-scene').onclick = deleteScene;
  document.getElementById('btn-add-choice').onclick = () => addChoiceRow();

  renderSceneList();

  return { exportGame, importGame, newGame, saveScene };
})();
