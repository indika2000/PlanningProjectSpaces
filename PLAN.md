# Plan: Chapter 1 - The Boardroom (10 Nodes) + Splash Screen

## Overview
Add a playable Chapter 1 text adventure called "The Boardroom" with a splash screen.
The game is a corporate thriller set in a high-stakes planning meeting gone wrong.

## Deliverables

### 1. Splash Screen SVG (`assets/splash.svg`)
- Stylish boardroom-themed SVG graphic
- Dark color scheme matching the app (purples, dark blues)
- Conveys corporate tension/energy

### 2. Splash Screen in Engine
- Update `engine.js` to render a splash screen before the game starts
- Show the SVG, game title, and a "Begin" button
- Smooth fade transition into the first scene

### 3. Chapter 1 Game Data - "The Boardroom" (10 Nodes)
Nodes:
1. `boardroom_entry` - You arrive at the 40th floor boardroom for a critical planning meeting
2. `take_seat` - You choose where to sit: head of table, middle, or near the exit
3. `ceo_arrives` - The CEO enters with an unexpected announcement: the company is merging
4. `speak_up` - You challenge the merger plan openly
5. `stay_quiet` - You stay silent and observe the room's reactions
6. `side_conversation` - During the break, a colleague pulls you aside with insider info
7. `review_documents` - You find discrepancies in the merger documents
8. `confront_cfo` - You confront the CFO about the financial irregularities
9. `ally_or_rival` - Another executive offers to help - but can you trust them?
10. `chapter_end` - The meeting reconvenes and Chapter 1 ends on a cliffhanger

### 4. App Updates (`app.js`)
- Replace the starter "Forgotten Tower" game with "The Boardroom" Chapter 1
- Wire up the splash screen to appear on load

## File Changes
- NEW: `assets/splash.svg`
- MODIFY: `js/engine.js` (add splash screen support)
- MODIFY: `js/app.js` (new starter game data + splash)
- MODIFY: `css/style.css` (splash screen styles if needed)
