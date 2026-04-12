/**
 * Chapter 3 – "Sub-Level"
 * The elevator descends to a floor that doesn't exist.
 * Below the building, a shadow board has been running the real company.
 */
const Chapter3 = {
  title: 'Sub-Level',
  subtitle: 'Chapter 3',
  startScene: 'the_descent',
  scenes: {

    the_descent: {
      id: 'the_descent',
      title: 'B3',
      text: 'The elevator opens onto poured concrete and fluorescent tubes. The air is different down here — recycled, chemical, decades old. This isn\'t a parking garage or a maintenance corridor. It\'s built for purpose.\n\nThe hallway stretches thirty metres to a single door. The keycard reader beside it pulses green — unlocked, waiting. Through the walls, muffled voices bleed through. Not an argument. A presentation. Someone is running slides.\n\nYour phone has no signal. The elevator panel behind you shows floors 1 through 40 and three basement levels, but B3 has no button — just a blank space where one should be. The doors close on their own, and the elevator ascends without you.\n\nThere is only forward.',
      choices: [
        { label: 'Walk to the door and listen before entering', target: 'the_door' },
        { label: 'Search the corridor for another way — cameras, vents, anything', target: 'the_corridor' },
      ],
    },

    the_door: {
      id: 'the_door',
      title: 'Behind the Glass',
      text: 'You press your ear to the door. The voices sharpen.\n\n"— quarterly projections hold if we execute Phase 3 by August. The Meridian acquisition was supposed to be the vehicle, but Chen\'s interference has accelerated the timeline."\n\nA different voice, older, calm: "Then we accelerate with it. The SEC investigation is manageable. Reeves is thorough but conventional. She\'ll follow the breadcrumbs to Okonkwo\'s terminal and close the case in six weeks."\n\nA third voice — and this one stops your blood cold. You know it. You\'ve heard it in quarterly calls, in town halls, in the hallway outside your office every morning.\n\nThe door has no handle on this side. Just the keycard reader. You don\'t have a keycard.\n\nBut the green light is blinking. Someone wants you to walk in.',
      choices: [
        { label: 'Push the door open and step inside', target: 'the_shadow_board' },
        { label: 'Record what you can hear on your phone first', target: 'record_evidence' },
      ],
    },

    the_corridor: {
      id: 'the_corridor',
      title: 'The Architecture of Secrets',
      text: 'You move slowly down the corridor, examining everything. The construction is recent — within the last five years. The concrete is smooth, the conduit is modern, the fire suppression system is commercial grade. Someone spent millions building this.\n\nHalfway down, a narrow service alcove holds a breaker panel. The labels are coded — not room numbers but project names: MERIDIAN, STERLING GATE, PHASE 3, OVERSIGHT. One breaker is labeled ARCHIVE and below it, a small access panel.\n\nYou pry it open. Behind it: a shallow space containing a rack-mounted hard drive array, quietly spinning. A single ethernet cable connects it to the wall. Whatever meetings happen in that room, this is where they\'re recorded.\n\nA red LED blinks on the array. It\'s recording right now.',
      choices: [
        { label: 'Disconnect the drive array and take it', target: 'take_the_archive' },
        { label: 'Leave it running — go to the door and confront whoever is inside', target: 'the_shadow_board' },
      ],
    },

    record_evidence: {
      id: 'record_evidence',
      title: 'Dead Air',
      text: 'You open your phone\'s voice recorder. No signal, but local recording works. You hold the microphone to the door.\n\nFor forty seconds you capture it clearly — the voices, the plans, the mention of Phase 3. Then the talking stops abruptly.\n\nSilence.\n\nA new voice, directly on the other side of the door, close enough to touch: "We know you\'re there. The elevator logs are monitored. You\'ve been standing in this hallway for three minutes and twelve seconds."\n\nA pause. Then, almost warmly: "You were invited. It\'s rude to eavesdrop when you could simply join the conversation."\n\nThe door clicks. It swings inward two inches, spilling warm light across the concrete floor.',
      choices: [
        { label: 'Enter — they already know you\'re here', target: 'the_shadow_board' },
        { label: 'Run — back to the elevator, try every button', target: 'no_escape' },
      ],
    },

    no_escape: {
      id: 'no_escape',
      title: 'The Long Walk Back',
      text: 'You turn and walk fast — then run — back to the elevator. You press the call button. Nothing. Press it again. The panel is dark.\n\nYour phone screen flickers. A message appears — not a text, not a notification. Just white text on black, as if the phone itself is speaking to you:\n\n"The elevator will return when the meeting is over. You can wait here in the dark, or you can come sit at the table. We have a chair for you. We\'ve always had a chair for you."\n\nThe corridor lights dim to half. Behind you, the door at the end stands open now, warm light flooding out. You can hear a chair being pulled back. The scrape of wood on polished floor.\n\nThere is no version of tonight where you don\'t walk through that door.',
      choices: [
        { label: 'Walk back to the door and enter', target: 'the_shadow_board' },
      ],
    },

    take_the_archive: {
      id: 'take_the_archive',
      title: 'The Black Box',
      text: 'The drive array is rack-mounted but portable — designed to be removed. You unclip two latches, disconnect the ethernet cable, and slide it out. It\'s the size of a thick hardcover book, warm and humming.\n\nThe red LED goes dark. Whatever was being recorded has stopped.\n\nInside the meeting room, the voices halt. You hear a chair push back.\n\nYou have maybe ninety seconds before someone comes through that door. The elevator is dead. There\'s no exit you can see. But in the alcove, behind where the drive was mounted, there\'s a narrow maintenance shaft — barely shoulder-width — with a metal ladder descending into darkness.\n\nA draft of cold air rises from below. There\'s another level.',
      choices: [
        { label: 'Climb down the shaft with the drive', target: 'the_vault' },
        { label: 'Stay and face them — the drive is your leverage', target: 'the_shadow_board' },
      ],
    },

    the_shadow_board: {
      id: 'the_shadow_board',
      title: 'The Real Boardroom',
      text: 'The room is smaller than you expected. No windows — of course. A round table of black walnut, eight chairs, seven occupied. The walls are hung with oil paintings of the city skyline across decades. A screen at the far end shows financial models you\'ve never seen.\n\nYou recognise four faces. Arthur Briggs — the man David warned you about — sits at what might be twelve o\'clock. Beside him, the charcoal suit from Sterling\'s meeting. Across the table: your company\'s former CEO, the one who "retired" three years ago. And at the far end, back to you, turning now—\n\nIt\'s someone from your own team. Someone you spoke to tonight. Someone who looked you in the eye and lied.\n\nBriggs gestures to the empty chair. "Please. You\'ve had a long night. Let us explain what this company actually is."',
      choices: [
        { label: 'Sit down and listen — information is power', target: 'the_offer' },
        { label: '"I\'m not sitting anywhere until you tell me who sent me that text"', target: 'the_offer' },
      ],
    },

    the_offer: {
      id: 'the_offer',
      title: 'The Proposition',
      text: 'Briggs speaks with the patience of someone who has given this speech before.\n\n"This company has two layers. The one upstairs — quarterly earnings, board votes, SEC filings — that\'s the surface. Down here is where the actual decisions are made. Infrastructure, policy, capital allocation at a scale that boards of directors aren\'t equipped to handle."\n\nHe slides a folder across the table. Inside: your name, your employee history, your performance reviews, personal notes from managers you\'d forgotten. A psychological profile you never consented to.\n\n"We\'ve been watching you for eighteen months. Tonight was your audition — how you handled the merger news, Margaret\'s evidence, the pressure. You passed."\n\nThe former CEO speaks for the first time. "We\'re not asking you to do anything illegal. We\'re asking you to see clearly. The people upstairs react. The people down here anticipate. Join us, and you\'ll understand why things happen before they happen."\n\nBriggs leans forward. "Or leave. The elevator will take you to the lobby. You\'ll wake up Monday and everything will be exactly as it was. The SEC will close its case. The merger will die. Life continues. But you\'ll always know this room exists, and you chose not to sit in it."',
      choices: [
        { label: 'Accept — take a seat at the shadow board', target: 'chapter3_end' },
        { label: 'Refuse — walk to the elevator and don\'t look back', target: 'the_walk_away' },
        { label: '"I need to know one thing first — who sent the texts?"', target: 'the_walk_away' },
      ],
    },

    the_vault: {
      id: 'the_vault',
      title: 'Below Below',
      text: 'The ladder drops fifteen feet into a room that hums with server-grade cooling. It\'s a data vault — rows of black cabinets, indicator lights cascading green. This is where the shadow board keeps everything. Not in the cloud. Not on a network. Here, in a room that doesn\'t exist in a building that officially has no sub-basements.\n\nThe drive array in your arms contains the meeting recordings. The servers around you contain everything else.\n\nIn the far corner, a terminal is logged in. The screen shows a directory tree: PHASE 1 (COMPLETED), PHASE 2 (COMPLETED), PHASE 3 (IN PROGRESS), PHASE 4 (CLASSIFIED). You open Phase 3. A single document:\n\n"Merger target: Meridian Capital. Objective: Controlled failure. Desired outcome: SEC investigation triggers insurance event. Projected return: $2.1B. Status: ON TRACK."\n\nThe merger was never meant to succeed. It was designed to fail. Everything — the doctored numbers, Margaret\'s discovery, even the SEC — is part of the plan.\n\nAbove you, a hatch opens. Light pours down. A voice: "Fascinating, isn\'t it? Now come upstairs. We should talk."',
      choices: [
        { label: 'Climb back up — but keep the drive', target: 'the_offer' },
        { label: 'Look for another exit from the vault', target: 'the_walk_away' },
      ],
    },

    the_walk_away: {
      id: 'the_walk_away',
      title: 'The Longest Elevator Ride',
      text: 'Whether by defiance or by escape, you make it to the elevator. True to Briggs\' word, it opens. You step in. The doors close on sub-basement B3, and it rises.\n\nOn the way up, your phone comes back to life. Three missed calls from Agent Reeves. A text from David Okonkwo: "Where did you go? Reeves is looking for you." And one final message from the unknown number:\n\n"You found the room. You saw the files. You can\'t unknow what you know. We\'ll be in touch. We always are."\n\nThe lobby is quiet. Rain streaks the glass entrance. A security guard nods as you pass. Outside, the city breathes on, oblivious.\n\nYou walk three blocks before you realise you\'re still holding the archive drive. Or your phone still has forty seconds of recorded audio. Or the Phase 3 document is burned into your memory.\n\nMonday is going to be a very different day.',
      choices: [
        { label: 'Call Agent Reeves from a payphone', target: 'chapter3_end' },
        { label: 'Go home. Process everything. Decide Monday.', target: 'chapter3_end' },
      ],
    },

    chapter3_end: {
      id: 'chapter3_end',
      title: 'Dawn',
      text: 'The city lightens from black to grey to pale gold. You\'ve been walking for hours, or sitting in your car, or staring at the ceiling of your apartment — it doesn\'t matter. The night replays in fragments.\n\nA boardroom announcement. A missing CFO. SEC agents. A corridor that shouldn\'t exist. Seven people around a table in a room three stories below the earth, running the company you thought you understood.\n\nYour phone rings at 5:47 AM. The caller ID reads: VICTORIA STERLING.\n\nYou stare at it for three rings. Four. Five.\n\nSterling was in her office when you left the 40th floor. She wasn\'t in the sub-basement. She doesn\'t know about B3.\n\nOr does she?\n\nThe phone rings a sixth time. Seventh.\n\nYou answer.\n\n"It\'s Victoria. Don\'t speak. Just listen. The people you met tonight — I\'ve been trying to destroy them for three years. And as of this morning, you\'re the only person who can help me. Meet me at the office. Not the 40th floor."\n\nShe pauses.\n\n"The roof."\n\nTo be continued...',
      choices: [],
    },
  },
};
