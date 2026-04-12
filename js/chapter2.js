/**
 * Chapter 2 – "The Lockdown"
 * The SEC has arrived. Margaret is missing. No one leaves the 40th floor.
 */
const Chapter2 = {
  title: 'The Lockdown',
  subtitle: 'Chapter 2',
  startScene: 'lockdown_begins',
  scenes: {

    lockdown_begins: {
      id: 'lockdown_begins',
      title: 'No One Leaves',
      text: 'The two figures from the elevator move with the calm authority of people who\'ve done this before. The woman holds up a badge — SEC Enforcement Division. The man is already on his phone, speaking in clipped sentences.\n\n"I\'m Special Agent Diana Reeves," the woman says, scanning the room. "This is Agent Park. We have a federal subpoena for all documents related to the Meridian Capital acquisition. As of now, this floor is secured."\n\nSterling starts to speak, but Reeves cuts her off. "Ms. Sterling, your legal counsel can be present, but no one — and I mean no one — leaves this floor until we\'ve conducted preliminary interviews."\n\nThe boardroom door locks with an electronic click. Through the glass, you see a security guard take position by the elevator.\n\nSomeone whispers: "Where\'s Margaret?"',
      choices: [
        { label: 'Volunteer to be interviewed first — get ahead of this', target: 'sec_interview' },
        { label: 'Slip away while attention is on Sterling — find Margaret', target: 'search_for_margaret' },
      ],
    },

    sec_interview: {
      id: 'sec_interview',
      title: 'Under the Lamp',
      text: 'Agent Reeves commandeers a glass-walled conference room. She sits across from you, a tablet and a legal pad in front of her. Agent Park stands by the door.\n\n"This is a voluntary interview," Reeves says, though the locked floor suggests otherwise. "Tell me about tonight\'s meeting. When did you first learn about the Meridian merger?"\n\nShe watches your hands, not your eyes. You know from her posture that she already has answers — she\'s checking yours against them.\n\nThe USB drive in your pocket feels like it weighs ten pounds. Margaret\'s data. The altered financials. The audit trail. It could blow this wide open — or make you look complicit.\n\nReeves taps her pen twice. "Take your time. But not too much time."',
      choices: [
        { label: 'Hand over the USB drive and tell her everything', target: 'reveal_drive' },
        { label: 'Answer carefully but keep the drive hidden for now', target: 'hide_drive' },
      ],
    },

    reveal_drive: {
      id: 'reveal_drive',
      title: 'All Cards on the Table',
      text: 'You place the USB drive on the table. Reeves\' expression doesn\'t change, but Park straightens up from the wall.\n\n"Margaret Chen gave me this," you say. "It contains the original financial filings and the altered versions submitted for the merger. Someone inside this company falsified the numbers to make the deal look profitable."\n\nReeves picks up the drive carefully, holding it by the edges. "When did she give this to you?"\n\n"Tonight. During the break. She said she was going to the SEC Monday — I think someone found out."\n\nReeves and Park exchange a look. Park leaves the room immediately, phone already at his ear.\n\n"You just made my job significantly easier," Reeves says. "And significantly more dangerous for you. Whoever doctored those files knows Margaret had this evidence. If they see you talking to me..." She glances at the glass walls. David Okonkwo is watching from across the hall. So is James Whitfield.\n\n"Stay close to me tonight," Reeves says quietly. "I mean it."',
      choices: [
        { label: 'Ask Reeves what she already knew before tonight', target: 'sterling_unravels' },
        { label: 'Look for David Okonkwo — he needs to know what\'s happening', target: 'server_room' },
      ],
    },

    hide_drive: {
      id: 'hide_drive',
      title: 'Playing Both Sides',
      text: 'You answer Reeves\' questions precisely — when you arrived, what Sterling said, the timeline of the announcement. You describe the merger terms in broad strokes. You mention nothing about the financial discrepancies. Nothing about Margaret\'s drive.\n\nReeves nods throughout, but when you finish, she leans forward. "You\'re very composed for someone who just learned their company might be engaged in securities fraud. Most people in that room looked like they\'d seen a ghost. You look like you\'re three moves ahead."\n\nShe pauses. "That either makes you the smartest person on this floor, or the most dangerous. I haven\'t decided which."\n\nShe dismisses you with a gesture. "Don\'t leave the floor. I\'ll have more questions."\n\nYou step into the corridor. The USB drive is still in your pocket. You have maybe thirty minutes before Reeves figures out what you\'re holding back. The question is what to do with that time.',
      choices: [
        { label: 'Find a computer and copy the drive\'s contents somewhere safe', target: 'server_room' },
        { label: 'Find Sterling — confront her directly before the SEC does', target: 'sterling_unravels' },
      ],
    },

    search_for_margaret: {
      id: 'search_for_margaret',
      title: 'The Empty Office',
      text: 'While Reeves commands the boardroom\'s attention, you slip down the corridor toward the C-suite offices. The 40th floor is eerily quiet — overhead lights on motion sensors flicker to life as you pass.\n\nMargaret\'s office door is open. The lights are off. You step inside.\n\nHer desk is immaculate — too immaculate. The family photos are gone. Her nameplate is face-down in the wastebasket. The monitor shows a login screen, but the keyboard is still warm.\n\nIn the wastebasket, beneath the nameplate, you find a crumpled sticky note in Margaret\'s handwriting: "Server room B. 10:15. Come alone."\n\nYou check your watch. It\'s 10:12.',
      choices: [
        { label: 'Go to Server Room B immediately', target: 'server_room' },
        { label: 'This feels like a trap — go back and tell Agent Reeves', target: 'sec_interview' },
      ],
    },

    server_room: {
      id: 'server_room',
      title: 'Server Room B',
      text: 'The server room hums with cold, mechanical breath. Rows of racks blink green and amber in the darkness. The air is frigid — you can see your breath.\n\nMargaret Chen is here. She\'s sitting on the floor between two server racks, laptop balanced on her knees, cables snaking into a rack labeled "FIN-ARCHIVE." Her face is lit blue by the screen.\n\n"Close the door," she says without looking up. "I\'m downloading the backup transaction logs. The ones that show exactly when the numbers were changed and from which terminal." She types faster. "Three minutes."\n\n"Margaret, the SEC is here. Agent Reeves—"\n\n"I know. I called them." She finally looks at you. Her eyes are red but steady. "Six weeks ago. I\'m their informant. But someone inside tipped off Sterling before I was ready. Tonight\'s meeting was supposed to happen next month."\n\nA sound from the corridor. Footsteps. Getting closer.\n\nThe download progress bar reads 64%.',
      choices: [
        { label: 'Guard the door — buy her time to finish the download', target: 'the_betrayal' },
        { label: 'Tell her to stop — the SEC can subpoena the servers directly', target: 'the_betrayal' },
      ],
    },

    sterling_unravels: {
      id: 'sterling_unravels',
      title: 'The CEO\'s Confession',
      text: 'You find Victoria Sterling alone in her corner office, standing at the window. The city lights blur behind the rain that\'s started to fall. She\'s holding a glass of something amber — her hand isn\'t shaking, but it wants to.\n\n"You know, don\'t you," she says to your reflection in the glass. It\'s not a question.\n\nShe turns. The mask of the composed CEO is gone. Underneath is someone exhausted and afraid.\n\n"I didn\'t falsify those numbers. But I knew they were wrong three days ago. Arthur Briggs in Finance brought me the discrepancies. I was going to reject the merger Monday morning." She sets the glass down. "But Briggs is on the Meridian board. Did you know that? Sits on both sides of the table. And now the SEC is here before I could act, which makes me look like the architect instead of the target."\n\nShe opens her desk drawer and pulls out a sealed envelope. "This is my resignation and a sworn statement. I wrote it this morning." She holds it out. "Take it to Agent Reeves. She won\'t believe it coming from me."',
      choices: [
        { label: 'Take the envelope to Reeves immediately', target: 'the_betrayal' },
        { label: 'Ask about Arthur Briggs — where is he right now?', target: 'the_betrayal' },
      ],
    },

    the_betrayal: {
      id: 'the_betrayal',
      title: 'The Man Behind the Curtain',
      text: 'The corridor outside erupts in raised voices. You step out to find David Okonkwo and James Whitfield in a standoff, Agent Park between them.\n\n"He\'s lying!" Okonkwo shouts, pointing at Whitfield. "He\'s not an investigator — check his credentials! He\'s Arthur Briggs\' nephew. He\'s been feeding information out of this company for months!"\n\nWhitfield doesn\'t flinch. "That\'s a fascinating accusation from the man whose login credentials were used to alter the Meridian financial projections on March 14th, March 21st, and April 2nd."\n\nOkonkwo\'s face drains of color. "That\'s — someone used my credentials. I reported a phishing attempt in March—"\n\n"Did you?" Whitfield produces his notebook — the one he\'s been writing in all night. "Because IT has no record of that report."\n\nAgent Reeves arrives, taking in the scene. She looks at you. "I think it\'s time you told me which of these gentlemen you\'ve been sharing information with tonight."',
      choices: [
        { label: 'Side with Okonkwo — Whitfield\'s connections are too suspicious', target: 'moment_of_truth' },
        { label: 'Side with Whitfield — the credential evidence is damning', target: 'moment_of_truth' },
        { label: 'Trust neither — tell Reeves about Sterling\'s confession instead', target: 'moment_of_truth' },
      ],
    },

    moment_of_truth: {
      id: 'moment_of_truth',
      title: 'The Weight of a Choice',
      text: 'Reeves listens to everything. Her face is unreadable. When you finish, she nods once and makes a call.\n\nWithin minutes, two more agents arrive from downstairs. Reeves issues quiet instructions. One agent approaches Whitfield. Another approaches Okonkwo. Both are escorted to separate rooms.\n\nThe floor is thinning out. Sterling sits alone in the boardroom, staring at the confidential folders no one has touched since the meeting began. Margaret emerges from the back corridor, laptop under her arm, and walks directly to Park without a word.\n\nReeves turns to you. "What you\'ve done tonight took courage. Or stupidity. The line between them is thinner than people think." She hands you a card. "Go home. Don\'t talk to anyone — not your family, not your lawyer, not your priest. My number is on that card. You\'re going to need it."\n\nShe pauses. "The financials on that drive? The alterations trace back to a single terminal. We know whose office it\'s in. But the person who used it..." She shakes her head. "That\'s not who anyone expects."',
      choices: [
        { label: 'Ask whose terminal it was', target: 'chapter2_end' },
        { label: 'Take the card and leave while you still can', target: 'chapter2_end' },
      ],
    },

    chapter2_end: {
      id: 'chapter2_end',
      title: 'Midnight on the 40th Floor',
      text: 'The elevator doors open for the first time in two hours. The security guard steps aside. You step in, alone.\n\nAs the doors begin to close, your phone buzzes. A text from an unknown number — the same one from before the meeting:\n\n"You chose well tonight. But you\'re looking at the wrong floor. The real boardroom is on 41."\n\nYou stare at the phone. There is no 41st floor. This building has forty stories. You\'ve worked here for six years.\n\nThe elevator passes the lobby without stopping. The display reads: B1... B2... and then a floor that shouldn\'t exist.\n\nB3.\n\nThe doors open onto a corridor you\'ve never seen. Fluorescent lights. Concrete walls. And at the far end, a door with a keycard reader — blinking green.\n\nFrom somewhere beyond it, you hear voices. A meeting in progress.\n\nThe doors begin to close.\n\nTo be continued...',
      choices: [],
    },
  },
};
