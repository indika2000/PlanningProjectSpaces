/**
 * Chapter 1 – "The Boardroom"
 * A corporate thriller: 10 nodes of high-stakes planning meeting intrigue.
 */
const Chapter1 = {
  title: 'The Boardroom',
  subtitle: 'Chapter 1',
  startScene: 'boardroom_entry',
  scenes: {

    boardroom_entry: {
      id: 'boardroom_entry',
      title: 'The 40th Floor',
      text: 'The elevator doors slide open with a soft chime. You step onto polished marble — the 40th floor, executive territory. Through floor-to-ceiling windows, the city sprawls beneath a bruised evening sky.\n\nThe boardroom lies ahead. Its glass doors are closed, but you can see figures already seated inside, their faces lit by the glow of tablets and laptops. This is no ordinary meeting — the email said "mandatory, confidential, no delegates."\n\nYour reflection stares back at you from the glass. Whatever happens in this room tonight will change everything.',
      choices: [
        { label: 'Push through the doors and take your usual seat', target: 'take_seat' },
        { label: 'Pause at the coffee station to read the room first', target: 'read_the_room' },
      ],
    },

    take_seat: {
      id: 'take_seat',
      title: 'Choosing Your Position',
      text: 'The boardroom is a cathedral of dark wood and soft lighting. A long obsidian table dominates the space, ringed by high-backed leather chairs. Name placards have been removed — unusual.\n\nThree seats remain open: one at the head of the table beside the empty CEO chair, one in the middle cluster near the CFO and legal counsel, and one near the door — easy exit, poor visibility.\n\nThe CFO, Margaret Chen, glances up from her papers. She looks like she hasn\'t slept. Across from her, VP of Strategy David Okonkwo drums his fingers on the table.',
      choices: [
        { label: 'Take the seat at the head, beside the CEO\'s chair', target: 'ceo_arrives' },
        { label: 'Sit in the middle, near the CFO and legal', target: 'ceo_arrives' },
        { label: 'Take the seat near the door', target: 'ceo_arrives' },
      ],
    },

    read_the_room: {
      id: 'read_the_room',
      title: 'The Coffee Station',
      text: 'You linger at the espresso machine outside the boardroom, pretending to fuss with the settings. Through the glass walls, you count heads — twelve executives, more than a usual strategy session.\n\nTwo faces stand out: Margaret Chen, the CFO, is speaking urgently to someone on her phone, her hand cupped over the receiver. And near the window, James Whitfield from External Affairs stands alone, staring at the city below. He\'s never been invited to a board meeting before.\n\nYour phone buzzes. A text from an unknown number: "Don\'t trust the numbers they show you tonight."\n\nThe message deletes itself before you can screenshot it.',
      choices: [
        { label: 'Head into the boardroom — you\'ve seen enough', target: 'take_seat' },
        { label: 'Try to catch Margaret before the meeting starts', target: 'side_conversation' },
      ],
    },

    ceo_arrives: {
      id: 'ceo_arrives',
      title: 'The Announcement',
      text: 'The murmur of conversation dies as the boardroom doors swing open. Victoria Sterling, CEO, strides in flanked by two people you\'ve never seen — a man in a charcoal suit carrying a thick binder, and a woman with a laptop already open.\n\n"Thank you all for coming on short notice," Sterling says, not sitting down. "I\'ll be direct. Meridian Capital has made an offer to merge with us. The terms are... generous. The board has seventy-two hours to decide."\n\nThe room erupts. Margaret Chen\'s pen drops. David Okonkwo leans back, jaw tight. The charcoal suit distributes folders stamped CONFIDENTIAL.\n\nSterling raises a hand. "I need each of you to review the terms tonight. We reconvene at six AM."',
      choices: [
        { label: 'Speak up and challenge the timeline', target: 'speak_up' },
        { label: 'Stay quiet and observe everyone\'s reactions', target: 'stay_quiet' },
      ],
    },

    speak_up: {
      id: 'speak_up',
      title: 'Breaking the Silence',
      text: '"Seventy-two hours?" Your voice cuts through the chaos. Heads turn. Sterling\'s gaze locks onto you — cool, measuring.\n\n"This company has three thousand employees. Pension obligations. Long-term contracts. You\'re asking us to rubber-stamp the biggest decision in our history over a weekend?"\n\nThe room goes quiet. Margaret Chen gives you the slightest nod. David Okonkwo looks away.\n\nSterling\'s expression doesn\'t change. "I appreciate the concern. But Meridian\'s offer expires Monday at market open. This isn\'t optional — it\'s physics."\n\nThe woman with the laptop types something. The man in the charcoal suit watches you with what might be interest, or might be a warning.',
      choices: [
        { label: 'Press further — demand an independent valuation', target: 'review_documents' },
        { label: 'Back down for now and review the documents first', target: 'review_documents' },
      ],
    },

    stay_quiet: {
      id: 'stay_quiet',
      title: 'The Observer',
      text: 'You say nothing. Instead, you watch.\n\nMargaret Chen\'s hands are trembling — barely visible, but there. She\'s reading the merger terms, and whatever she\'s finding is making her pale. She flags a page, then another, then closes the folder entirely.\n\nDavid Okonkwo catches your eye and subtly tilts his head toward the door. Later, the gesture says.\n\nJames Whitfield from External Affairs is taking notes — furiously — in a personal notebook, not on company hardware. The charcoal suit notices too.\n\nSterling wraps up with: "Take the evening. Read carefully. And I trust I don\'t need to remind anyone about the NDA you signed walking in."\n\nYou didn\'t sign an NDA walking in. No one did.',
      choices: [
        { label: 'Follow David Okonkwo when the break is called', target: 'side_conversation' },
        { label: 'Stay and examine the merger documents closely', target: 'review_documents' },
      ],
    },

    side_conversation: {
      id: 'side_conversation',
      title: 'The Corridor',
      text: 'The corridor outside the boardroom is empty except for David Okonkwo, leaning against the window with his arms crossed. He waits until the last person passes before speaking.\n\n"This merger isn\'t what it looks like," he says quietly. "I ran the numbers on Meridian last quarter for an unrelated project. Their debt-to-equity ratio doesn\'t match what\'s in that folder. Someone\'s cooking the books — either them or us."\n\nHe glances at the security camera above. "Margaret knows something too. She\'s been pulling financial records for weeks — off-hours, personal login. I only know because IT flagged it and it crossed my desk."\n\nHe straightens his tie. "I\'m going back in. Do what you want with this. But if this merger goes through on false numbers, we\'re all liable."',
      choices: [
        { label: 'Go back in and confront the CFO directly', target: 'confront_cfo' },
        { label: 'Find the merger documents and check the numbers yourself', target: 'review_documents' },
      ],
    },

    review_documents: {
      id: 'review_documents',
      title: 'The Numbers Don\'t Add Up',
      text: 'You spread the confidential folder across the table, cross-referencing figures with what you know from quarterly reports. It takes twenty minutes to find it.\n\nPage 14: Meridian\'s projected revenue shows a clean 12% year-over-year growth. But their public SEC filings — which you pull up on your phone — show flat growth and increasing operational costs. The gap is over $200 million.\n\nPage 22: The "synergy savings" projections assume eliminating 40% of the combined workforce. That number isn\'t mentioned anywhere in Sterling\'s presentation.\n\nPage 31: A subsidiary you\'ve never heard of — Meridian Ventures LLC — holds the actual intellectual property. The merger acquires the parent company, not the subsidiary.\n\nSomeone has built this deal on a foundation of sand.',
      choices: [
        { label: 'Take this directly to the CFO', target: 'confront_cfo' },
        { label: 'Document everything quietly and find an ally', target: 'ally_or_rival' },
      ],
    },

    confront_cfo: {
      id: 'confront_cfo',
      title: 'Margaret Chen',
      text: 'You find Margaret in her office, door half-closed. She doesn\'t look surprised to see you.\n\n"Sit down," she says, before you can speak. "And close the door."\n\nShe turns her monitor toward you. Spreadsheets fill the screen — her own analysis, far more detailed than yours. Red cells everywhere.\n\n"I\'ve known for three weeks," she says flatly. "The numbers are fabricated. Not by Meridian — by someone inside our company. Someone on this floor is feeding false financials to make the merger look profitable."\n\nShe pulls a USB drive from her desk drawer. "Everything\'s on here. The original filings, the altered versions, the audit trail. I was going to take it to the SEC Monday morning."\n\nHer phone rings. She looks at the caller ID and her face changes. "You need to take this drive," she says. "Right now. And you need to decide who you trust in that boardroom."',
      choices: [
        { label: 'Take the drive and find David Okonkwo', target: 'ally_or_rival' },
        { label: 'Take the drive and go straight back to the boardroom', target: 'chapter_end' },
      ],
    },

    ally_or_rival: {
      id: 'ally_or_rival',
      title: 'Trust and Betrayal',
      text: 'You\'re standing in the corridor, USB drive in your pocket, when a voice behind you says: "Interesting evening, isn\'t it?"\n\nIt\'s James Whitfield — External Affairs. The man who\'s never been invited to a board meeting. He\'s leaning against the wall, notebook tucked under his arm, watching you with sharp, steady eyes.\n\n"I know what\'s on that drive," he says. "Margaret\'s been working on this for weeks. What she doesn\'t know is that I\'ve been working on it longer. I\'m not External Affairs — not really. The board hired me six months ago to investigate financial irregularities."\n\nHe extends his hand. "You can trust me, or you can walk back in there alone. But whoever falsified those numbers is in that boardroom right now, and they know Margaret found out. The question is — do they know about you?"',
      choices: [
        { label: 'Accept his help — you need an ally', target: 'chapter_end' },
        { label: 'Trust no one — handle this yourself', target: 'chapter_end' },
      ],
    },

    chapter_end: {
      id: 'chapter_end',
      title: 'The Meeting Reconvenes',
      text: 'The boardroom doors open again at exactly 10 PM. Everyone files back in, but the energy has shifted. Sterling stands at the head of the table, the charcoal suit beside her. Margaret Chen\'s chair is empty.\n\nYour phone vibrates. A news alert: "Meridian Capital stock halted after hours — SEC inquiry reported."\n\nSterling sees it on her own phone. For the first time all evening, her composure cracks — just a flicker, quickly suppressed. She sets the phone face-down.\n\n"It seems," she says slowly, "that our timeline has changed. No one leaves this floor until we have answers."\n\nThe elevator chimes. The doors open. Two people in dark suits step out — and they\'re not from Meridian.\n\nThe boardroom lights flicker once, then hold steady.\n\nTo be continued...',
      choices: [],
    },
  },
};
