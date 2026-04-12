/**
 * App – wires up Play, Import/Export, Resize, Fullscreen, and loads a starter template.
 */
(function () {
  const previewFrame       = document.getElementById('preview-frame');
  const previewPlaceholder = document.getElementById('preview-placeholder');
  const previewPanel       = document.getElementById('preview-panel');
  const editorPanel        = document.getElementById('editor-panel');
  const resizer            = document.getElementById('resizer');

  /* ==================== Play ==================== */
  function play() {
    Editor.saveScene();
    const data = Editor.exportGame();
    if (!data.startScene || !Object.keys(data.scenes).length) {
      alert('Add at least one scene before playing.');
      return;
    }
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

  /* ==================== Starter Template ==================== */
  const starterGame = {
    title: 'The Forgotten Tower',
    startScene: 'entrance',
    scenes: {
      entrance: {
        id: 'entrance',
        title: 'The Tower Entrance',
        text: 'You stand before a crumbling stone tower, half-swallowed by the forest. Vines crawl up its walls and a heavy oak door hangs ajar. A faint blue glow pulses from somewhere deep inside.\n\nThe air smells of damp earth and something older — like parchment left in the rain for centuries.',
        choices: [
          { label: 'Push the door open and step inside', target: 'ground_floor' },
          { label: 'Circle the tower looking for another way in', target: 'tower_side' },
          { label: 'Turn back into the forest', target: 'forest_retreat' },
        ],
      },
      ground_floor: {
        id: 'ground_floor',
        title: 'The Ground Floor',
        text: 'The door groans as you push it wide. Inside, a circular room stretches upward into darkness. A spiral staircase of stone hugs the wall, some steps cracked and missing.\n\nOn a stone pedestal in the centre sits a leather-bound book, its pages glowing faintly blue. Beside it, a rusted sword leans against the wall.',
        choices: [
          { label: 'Open the glowing book', target: 'read_book' },
          { label: 'Take the rusted sword', target: 'take_sword' },
          { label: 'Climb the spiral staircase', target: 'upper_floor' },
        ],
      },
      tower_side: {
        id: 'tower_side',
        title: 'Around the Tower',
        text: 'You push through thick undergrowth along the tower\'s curved wall. Around the back, you find a narrow window just above head height. The blue glow is stronger here, pulsing like a slow heartbeat.\n\nBelow the window, scratched into the stone, are words in a language you almost recognise.',
        choices: [
          { label: 'Climb through the window', target: 'ground_floor' },
          { label: 'Try to read the inscription', target: 'inscription' },
          { label: 'Return to the front door', target: 'entrance' },
        ],
      },
      forest_retreat: {
        id: 'forest_retreat',
        title: 'The Forest Path',
        text: 'You turn away from the tower, but the forest has changed. The path you followed is gone — replaced by gnarled roots and unfamiliar trees. An owl watches you from above with too-knowing eyes.\n\nSomewhere behind you, the tower\'s blue glow brightens, as if calling you back.',
        choices: [
          { label: 'Follow the owl deeper into the forest', target: 'owl_path' },
          { label: 'Return to the tower', target: 'entrance' },
        ],
      },
      read_book: {
        id: 'read_book',
        title: 'The Glowing Tome',
        text: 'You open the book carefully. The pages are filled with shifting symbols that rearrange themselves as you watch. Slowly, words form in your language:\n\n"The tower remembers all who enter. Speak your name to the stones and the way upward will open."\n\nThe blue glow intensifies. The stone walls seem to lean in, listening.',
        choices: [
          { label: 'Speak your name aloud', target: 'name_spoken' },
          { label: 'Close the book and take the sword instead', target: 'take_sword' },
          { label: 'Climb the stairs without speaking', target: 'upper_floor' },
        ],
      },
      take_sword: {
        id: 'take_sword',
        title: 'The Rusted Blade',
        text: 'You lift the sword. It\'s heavier than it looks, and flakes of rust fall away to reveal an edge that still holds. The moment your hand closes around the grip, the blue glow dims and a low rumble echoes through the tower.\n\nA voice, neither male nor female, whispers from the walls: "A blade will not help you here."',
        choices: [
          { label: 'Keep the sword and head upstairs', target: 'upper_floor' },
          { label: 'Put the sword down and open the book', target: 'read_book' },
        ],
      },
      upper_floor: {
        id: 'upper_floor',
        title: 'The Observatory',
        text: 'The stairs are treacherous but hold your weight. You emerge into a room open to the sky — the roof collapsed long ago. Star maps are painted on every remaining surface, constellations you\'ve never seen.\n\nIn the centre, a stone chair faces upward. Sitting in it, a skeleton wears a crown of silver wire. In its bony hand: a key that gleams as if freshly forged.',
        choices: [
          { label: 'Take the key from the skeleton', target: 'take_key' },
          { label: 'Sit in the stone chair', target: 'sit_chair' },
          { label: 'Study the star maps on the walls', target: 'star_maps' },
        ],
      },
      inscription: {
        id: 'inscription',
        title: 'The Ancient Words',
        text: 'You trace the letters with your fingers. They\'re warm to the touch. As you concentrate, meaning forms in your mind:\n\n"What the tower takes, it does not return. What you give freely, it multiplies."\n\nThe warmth spreads up your arm. You feel as though the tower knows you\'re here.',
        choices: [
          { label: 'Enter through the window, emboldened', target: 'ground_floor' },
          { label: 'Return to the front door', target: 'entrance' },
        ],
      },
      owl_path: {
        id: 'owl_path',
        title: 'The Owl\'s Clearing',
        text: 'You follow the owl through impossible turns in the forest until you reach a moonlit clearing. The owl lands on a stone marker and transforms — shifting, growing — into the translucent figure of a woman in robes.\n\n"Few choose the forest over the tower," she says. "Fewer still find me. You may ask one question."',
        choices: [
          { label: '"What is the tower?"', target: 'answer_tower' },
          { label: '"Who are you?"', target: 'answer_who' },
          { label: '"How do I leave this forest?"', target: 'answer_leave' },
        ],
      },
      name_spoken: {
        id: 'name_spoken',
        title: 'The Tower Remembers',
        text: 'Your name echoes off the stones, growing louder with each repetition until it becomes a chord of sound. The spiral staircase shudders and new steps grow from the walls — perfect, solid stone where before there were only gaps.\n\nThe book snaps shut and dissolves into blue light that flows into your chest. You feel warm. You feel known.\n\nThe way up is clear now.',
        choices: [
          { label: 'Ascend the restored staircase', target: 'upper_floor' },
        ],
      },
      take_key: {
        id: 'take_key',
        title: 'The Gleaming Key',
        text: 'The moment you lift the key, the skeleton crumbles to dust. The silver crown clatters to the floor. The star maps on the walls begin to spin — slowly at first, then faster, the painted stars streaking into lines of light.\n\nA door you hadn\'t noticed before appears in the far wall. The key in your hand grows warm.\n\nYou know, without being told, that this door opens only once.',
        choices: [
          { label: 'Use the key to open the door', target: 'ending_door' },
          { label: 'Put the key back and pick up the crown instead', target: 'sit_chair' },
        ],
      },
      sit_chair: {
        id: 'sit_chair',
        title: 'The Stone Throne',
        text: 'You sit in the cold stone chair. The sky above wheels and shifts — day, night, seasons, centuries pass in moments. You see the tower being built, stone by stone, by hands that glow with blue light.\n\nYou see everyone who ever entered. You see yourself, walking up to the door for the first time.\n\nThe chair does not want to let you go. But you understand now: the tower is a memory, and you are its newest one.',
        choices: [
          { label: 'Accept your place in the tower\'s memory', target: 'ending_stay' },
          { label: 'Force yourself to stand', target: 'take_key' },
        ],
      },
      star_maps: {
        id: 'star_maps',
        title: 'The Impossible Constellations',
        text: 'The star maps show skies that don\'t exist — or perhaps skies that no longer exist. One constellation is circled in gold paint: seven stars forming the shape of a key.\n\nAs you study it, the real sky above begins to mirror the painting. Seven stars brighten and a beam of light falls through the open roof, illuminating the skeleton\'s key with impossible brilliance.',
        choices: [
          { label: 'Take the illuminated key', target: 'take_key' },
          { label: 'Look for more clues in the maps', target: 'sit_chair' },
        ],
      },
      answer_tower: {
        id: 'answer_tower',
        title: 'The Answer',
        text: '"The tower is a question," she says, "asked by someone who forgot what they were asking. It collects answers — people like you — hoping one of them will complete it."\n\nShe fades like morning mist. The clearing is empty. But the path back to the tower is suddenly clear, lit by fireflies that weren\'t there before.',
        choices: [
          { label: 'Return to the tower with new understanding', target: 'entrance' },
        ],
      },
      answer_who: {
        id: 'answer_who',
        title: 'The Guardian',
        text: '"I was the first to enter," she says softly. "And the first to choose the forest instead. The tower remembers those who enter. The forest remembers those who don\'t."\n\nShe places a small stone in your palm — smooth, warm, faintly glowing. "This will light your way, whichever path you choose."\n\nShe dissolves into moonlight.',
        choices: [
          { label: 'Return to the tower, stone in hand', target: 'ground_floor' },
        ],
      },
      answer_leave: {
        id: 'answer_leave',
        title: 'Freedom',
        text: '"Walk forward," she says simply. "Don\'t look back."\n\nYou walk. The trees thin. Birdsong returns. Within minutes, you\'re standing on a road you recognise, the morning sun warm on your face.\n\nBehind you, there is no forest. No tower. Just an empty field.\n\nBut in your pocket, you find a key you\'ve never seen before. It\'s warm to the touch. And somewhere, very far away, you hear stones whispering your name.',
        choices: [],
      },
      ending_door: {
        id: 'ending_door',
        title: 'Beyond the Door',
        text: 'The key turns smoothly. The door opens onto — not a room, not the sky, but a vast library stretching in every direction. Thousands of books glow with soft blue light. Each one, you realise, is a story. Each one is someone who entered the tower.\n\nA pedestal stands empty, waiting. A new book materialises in your hands, its pages blank.\n\n"Write," whispers the tower.\n\nAnd so you do. Your adventure has ended — but your story is just beginning.',
        choices: [],
      },
      ending_stay: {
        id: 'ending_stay',
        title: 'Part of the Tower',
        text: 'You close your eyes and let the centuries wash over you. The tower is not a prison — it\'s a chorus, and you are its newest voice.\n\nSomeday, someone else will find this tower. They\'ll push open the heavy door, see the spiral stairs, find a glowing book on a pedestal. And in that book, among the shifting symbols, your story will be waiting.\n\nYou are remembered. You are home.',
        choices: [],
      },
    },
  };

  // Load the starter game on first load
  Editor.importGame(starterGame);

})();
