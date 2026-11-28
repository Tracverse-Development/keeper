# Changelog

Every released version of Keeper, newest first: what was added, what changed and what was fixed,
in the words a person using it would recognise. A version is written here before it is tagged
(`scripts/release.sh` refuses a version with no entry), and its entry becomes the release's notes
on GitHub. Fix numbers (FIX-0026) point to `FIXLOG.md`, which holds the cause and the guard.

Versions follow `major.minor.patch`: a new minor for new abilities, a patch for fixes and small
refinements.

## [0.19.3] - 2026-11-28

The Forge works for everyone, and the Studio is tidier.

### Fixed
- **Forge from words works without Claude.** With no AI connected (or Claude not signed in),
  "a cosy green scarf with cream stripes" failed; Keeper now reads plain descriptions itself:
  the item you name, its colours, fast or slow (FIX-0059).
- Soul cards stack as one tidy list; the Feelings line reads as a sentence.
- Your keeper stays awake while you go through the Studio's tabs.

## [0.19.2] - 2026-11-28

Your keeper's memory recovers by itself.

### Fixed
- **Memory that stayed offline after an abrupt stop.** If your Mac lost power or was forced to
  restart, the memory node could be left with a damaged file and never start again, so your
  keeper said its memory was offline for good. Keeper now repairs that file itself when it starts
  its node (it keeps the damaged copy beside it; your memories are never touched) and is back in
  about half a minute (FIX-0058).
- The Studio, Inventory and Memory try again by themselves while the memory node is still
  starting, instead of showing an error until you reopen them.
- Memory node messages read as plain sentences ("still catching up with its network").

## [0.19.1] - 2026-11-28

Everything beside your keeper takes turns, so it is never squeezed or covered.

### Changed
- **Memory moves your keeper aside** like the Transcript, instead of covering the message box.
  Every Memory tab is in view, the counts read "2 things known", and each entry says what
  answered ("Claude Code", "built-in mind") instead of an internal id.
- On a narrower window the keepers list folds when the Transcript or Memory opens (at start
  too), and opening the list while the Stage shows puts the Stage away; "Scenes" brings it back.
- **Your keeper stays awake while you type or read** the conversation.
- **Captions rest:** a while after a reply they dim so your keeper has the screen; point at
  them to read again.
- Health: a check you fix in Settings has a button that takes you there ("Choose a mind").

### Fixed
- The Stage's header no longer overlaps on a narrow window (the title shortens instead).
- The keepers list button did nothing while the Stage was showing.
- "Scenes" no longer sits on top of the Transcript; chips never break their words.

## [0.19.0] - 2026-11-28

See your keeper while you talk, and talk without your hands.

### Added
- **Captions under your keeper.** The latest exchange shows like subtitles under your keeper,
  so the conversation never covers it: your words on one small line, then its reply. A long
  reply shows its first lines and **Read all**.
- **The Transcript.** The whole conversation, with everything you know from the cards
  (what it remembered, the steps it took, the memory trail, undo), in a column at the side.
  Open it with the button by the message box, **Read all**, or a past chat; your keeper moves
  over so nothing sits on top of it.
- **Hands-free, one press.** A **Hands-free** switch beside Mode and Style: say your keeper's
  name and talk. It shows "Yes? Biscuit is listening." when it hears its name, and after it
  answers out loud you can keep talking for a few seconds without saying its name again.

### Changed
- Beside the Stage's panels, the message box and captions fit your keeper's column.
- Asking for the same reminder twice keeps one reminder ("You already have that").
- Reminder lists that run past today say "Today 9:00 AM" beside "Tomorrow 9:00 AM".
- Conversions say which cup they mean ("2.113 US cups").
- Golden Coat for the dog is matte now.

### Fixed
- What's new (and two other dialogs) now close with Escape, and typing while one is open no
  longer goes to the message box behind it (FIX-0056).
- A video request looks once more when YouTube answers with an empty page.
- The message box shows focus on its whole bar; the Voice tab has one scroll; "1 DKG query".

## [0.18.1] - 2026-11-28

Smooth keepers, and coats you have to earn.

### Changed
- **The dog and the owl are smooth by standard.** A real coat is now special: a dog's fur coat is
  **mythical** and an owl's full feathers are **legendary**. A coat is never unlocked by level; a
  keeper wears one only once it has obtained it (how keepers obtain coats is coming). The Studio's
  Look tab has a **Coat** switch (Smooth or the coat) and the coat finishes (Golden Fleece, Snow
  Wolf, Tawny Plumage, Snowy Owl) show "obtained only" until then.
- Golden Coat and Snow Coat for the dog, and Moss Green for the owl, are smooth finishes now.
- A keeper shared as a pack never brings a coat with it.

## [0.18.0] - 2026-11-28

Keepers that work out of the box, tested end to end on a fresh Mac.

### Added
- **Useful with no AI connected.** Before you connect a mind, a keeper now does the everyday
  things at once: "remind me in 10 minutes to stretch", "show me a video on how to tie a tie",
  "what time is it in Tokyo", "turn on dark mode", "keep my Mac awake for an hour", "take a
  screenshot", "how many cups is 500 ml", "what's 15% of 86", "open Notes", "make a note: …",
  "define serendipity", "find my movies", "is everything working". With a mind connected these
  answer instantly too.
- **"Is everything working?"** shows the health checks right in the conversation.
- **What I can do** lists the newest abilities: videos, your movies, fixing a file, what's on
  tomorrow and your reminders.

### Changed
- **The Keeper SDK covers more.** Each ability names the modes that offer it and the words it
  answers at once; the instant answers and the window's panels are part of the SDK, so a new
  ability or panel is one entry.

### Fixed
- YouTube videos play inside Keeper again (FIX-0044).
- A permission question from macOS no longer times out while you are reading it (FIX-0043).
- On a smaller screen the window fits, the What's new sheet reads whole, the top bar and chat
  titles stay tidy, and the draft's Save button stays in reach (FIX-0041, 0042, 0047, 0054).
- An agenda's Delete no longer covers the reminder, and a panel shown alone uses the whole Stage
  (FIX-0045).
- Set-progress notes no longer cover the message box (FIX-0046).
- "What's on today" never says "nothing on your calendar" when it could not read it (FIX-0050).
- Finding files and movies works on a Mac with Spotlight indexing off (FIX-0051, 0052).
- "My name is Amos and I love cricket" remembers both things (FIX-0053).
- Inventory shows what your keeper can wear now first (FIX-0055).
- Smaller wording fixes: "2.113 cups", "your calendar", "1 thing known" (FIX-0048, 0049, 0054).

## [0.17.0] - 2026-11-27

Keepers that are genuinely useful, built on the new Keeper SDK.

### Added
- **Edit in Keeper, then save.** Ask a keeper to change a text file ("fix the spelling in
  notes.txt") and the file opens in Keeper with the changes shown line by line, removed and
  added, as they arrive. Edit it yourself if you like, then Save, Change something, or Throw
  away. Nothing touches the real file until you press Save, and Keeper will not overwrite a file
  that changed while you were looking.
- **Watch it work, pause it, change its course.** The working card shows each step as it happens
  (which file, which command) and the time worked. Pause freezes the job in place; Resume carries
  on; Change course lets you type a correction ("leave the heading alone") and the keeper picks up
  from where it was, not from the start. Typing while it works offers "Send as a correction".
- **Real videos, inside Keeper.** "Show me a video on how to tie a tie" finds one real video and
  plays it in place (with two others to swap to), never a search page. Movies and songs on your
  Mac play inside Keeper too ("play my holiday video", "find my movies"). Nothing loads until you
  press Play.
- **Calendar heads-ups.** Before each event on your calendar a keeper tells you it is coming up
  (10 minutes before by default; 5, 15, 30 or off in Settings, Reminders and calendar).
- **Reminders you can see.** Setting a reminder shows it with your next few; "what reminders do I
  have" and "what's on tomorrow" show an agenda of reminders and events, with Delete on each
  reminder.
- **Things a keeper can do on your Mac:** battery, Wi-Fi, disk space, open apps, the time in any
  city, your Shortcuts (list and run), show a folder in the Finder, open a System Settings pane,
  look up a word; and, when you ask: dark mode, volume, keep the Mac awake, sleep the display,
  lock the screen, copy text, take a screenshot, make a note in Notes. Exact sums and unit
  conversions everywhere. A paired phone can ask and look, but never change your Mac.
- **The Keeper SDK.** Everything a keeper can do is an ability in a pack, built to one contract,
  so new abilities are one entry each (docs/design/keeper-sdk.md).

### Fixed
- A reminder was said twice, and "what reminders do I have" contradicted itself (FIX-0039).
- A lesson replayed from memory said "Switching to Tutor mode" when nothing switched (FIX-0033).
- A keeper switched modes just to answer a one-line fact (FIX-0034).
- A storage question repeated the same number in four panels (FIX-0035).
- The setup step bar's "Welcome" ran into the next step on smaller screens (FIX-0036).
- A chart's unit was cut inside its brackets (FIX-0037).
- Stop left the command the keeper was running still going (FIX-0038).
- "Show me a video" gave a search page instead of a video (FIX-0040).

## [0.16.1] - 2026-11-27

### Fixed
- When a keeper moves to another mode to answer ("Switching to Tutor mode for this."), the mode
  picker now changes the moment it switches, and a message you send while it is still answering
  goes in the new mode. Before, the picker stayed on the old mode until the answer finished and
  your next message made it switch again (FIX-0032).

## [0.16.0] - 2026-11-27

### Added
- Elbows: people and the God Keeper bend their arms at the elbow, and long sleeves bend with them. Hands now reach real places: the watch comes up across the chest, a hand rests on the knot of a tie, fingertips come up to the spectacles' rim, a lantern is lifted to chin height. Under a hat, a person gives a small bow with a hand on the heart.
- Expressions: every keeper can look happy, focused, sleepy or surprised in its own way (brows and lids, the dog's ears, the owl's feather brows, the robot's visor, the God Keeper's brows of light), following what it is doing and the stage mood.
- Cloth that moves: capes, gowns, shawls and scarf ends sway and settle when the keeper moves or turns, and so do the dog's ears and tail and the owl's ear tufts.
- Colour choices: every item can be worn in a few colours, picked from swatches on its card in the Marketplace and the Inventory. Pointing at a swatch tries it on.
- Photo mode: the Photo button in the Studio saves a portrait or the keeper card as a large picture in Pictures/Keeper on this Mac. Nothing is uploaded. Saving the card from the Level tab now goes there too.
- Six new sets, one for each keeper, with twelve new pieces: Harbour Watch for the dog (sailor collar, pea coat), Clockwork for the owl (top hat with turning gears, gear loupe), Test Match for the man (batting whites with pads, cricket bat), Sky Pilot for the woman (flight cap, goggles), Ark Sentinel for the robot (breastplate, kite shield) and Good Shepherd for the God Keeper (shepherd's crook, stole).

### Changed
- A keeper turned round in the Studio is lit like its front: the stage lights turn with the camera.
- The owl's chest is soft overlapping feathers instead of a grid.
- The God Keeper's glow stays on its rim, halo and rays, so its engraved gold, armour and robe folds show, and a crown's flare is a burst of light rather than a white-out.
- The man has a slimmer nose, a new mouth, and a beard with no gap.
- Item moments were tuned by watching them: the owl's wing now reaches its spectacles and the dog's sniff of its brooch reads.
- Battery: drawing stops while Keeper's window is hidden, slows when it is not in front, and steps down quality when frames run slow. Fur and feathers get lighter when the keeper is small on screen.

### Fixed
- Outfit changes made by hand while in a mode with its own set are remembered for that mode (FIX-0030).
- After gaining several levels at once, the set note counts every piece opened, not only the last level's (FIX-0029).

## [0.15.0] - 2026-11-27

### Added
- Every keeper in more detail. The dog has real fur, a stronger brow, cheek tufts, a nose with nostrils and toes. The owl is fully feathered, with a barred chest, feathered ear tufts, layered wings, a hooked beak and talons. The man and the woman have sculpted faces with real noses, ears and lips, hands with fingers, and textured hair (a fade and a beard for him, coils for her). The robot has panel seams, screws, cables and inner light in its visor. The God Keeper has engraved gold, layered armour, robe folds and a second ring of rays.
- Little moments with what they wear: when idle, the owl adjusts its spectacles and settles its cloak, the dog sniffs its brooch and looks at its booties, people check their watch and tug their tie, the robot taps its visor and bobs in its headphones, and the God Keeper's crown flares.
- Stage moods: neon, lamplight, dawn, starfield and celestial light, which really light the keeper. The stage takes a set's mood on its own when three pieces of that set are worn.
- Glowing eyes: a glow on the eyes now lights the iris round a dark pupil.
- Turn around in the Studio: drag beside the keeper to turn it and see its back (packs, cloaks, wings), or press Turn around. It returns to the front by itself.
- A set for each mode: tie a set to a mode, and the keeper changes into it when it switches to that mode, and back when it leaves.
- When a level opens new pieces, a note says how far each set has come ("Gala Night: 4 of 5 ready"), and new pieces are marked New.
- Two new pieces: the Ranger Jacket (worn leather, stitching, belts and arm bands) and the Cord Necklace (three twisted cords, a glowing brooch and a swinging chain).

### Changed
- Sleeves follow the arms: when a keeper waves, the sleeve, cuff and arm band go with it.
- Shoes are real shoes: soles, heels and shaped toes, laces and eyelets, straps on sandals, a heel on heels, soft booties for paws.
- The keeper card shows the set it wears and its rarest piece.

## [0.14.0] - 2026-11-27

### Added
- The first collection: 20 sets and over 100 items. Three sets for each starter keeper (Workshop, Deep Space and Circuit Garden for the robot; Park Day, Rescue Ranger and Cozy Den for the dog; Island Linen, Studio Producer and Sharp Suit for the man; Market Morning, Explorer and Gala Night for the woman; Scholar, Night Watch and Forest Keeper for the owl), sets for a whole race (Everyday Basics and Mas Band for humans, Wild Trail for animals), Ark Pilgrim for everyone, and Celestial Regalia for the God Keeper alone.
- Sets: wear three pieces of one set and they glow together. Each set has a signature piece as its reward. The Marketplace has a Sets side with how far each keeper has got, and "Wear the set" puts on every piece it can wear in one press. Pointing at a set tries the whole set on.
- New things to wear: hats, caps, headwraps, headphones, a headlamp, crowns and circlets, a monocle, bandanas, ties and a shawl, tees, shirts, hoodies, sweaters, blazers, vests, waistcoats, sequins, robot plating, blouses and a robe, an evening gown, trousers, jeans and a wrap skirt, shoes, boots, sandals, heels and booties, bracelets and arm bands, a tote and a book, a cloak, carnival wings and wings of light, packs, toolboxes, saddlebags, satchels and thrusters, halos (satellites, petals, a crescent moon, a compass rose, the Halo of Ages), platforms (a hover ring, a cushion, a branch, a stone, waves, a spotlight, a cloud) and drifting auras (pollen, a night sky, fireflies, lantern light).
- New moments: Comet, Beacon, Dream, Waveform, Compass and Page Flutter while thinking; Spark Shower, Petal Fall, Ball Burst, Ripple, Rainbow and Shooting Star when celebrating.
- People now wear trousers and shoes, and the owl wears things on its talons.
- Finishes: a ready-made look for the whole body in the Look tab (Brushed Titanium and Solar Gold for the robot, Golden Coat and Snow Coat for the dog, Moss Feathers and Snowy Owl for the owl, Dawn and Obsidian Sovereign for the God Keeper), opened by level like items.
- Starter keepers: Bolt, Biscuit, Malik, Amara, Sage and Seraph, each added in one press from the Marketplace's Keepers side, wearing its starter piece. Two new souls: Wise Owl and Radiant.

### Changed
- The Marketplace's Shop shows one shelf per set, the sets this keeper can wear first.
- Trying an item on shows its rarity effect, even before the keeper's level opens it.
- The collar fits any animal, so the owl can wear one too. The puppy is called the Dog in every list.

## [0.13.0] - 2026-11-26

### Added
- Four new keepers to choose from: a man, a woman, a wise owl and the God Keeper. The God Keeper hovers over the ark with a golden mask, eyes of light, a crown of rays, turning rings and crystal shards, and gets brighter as it works.
- Races: every keeper is human, robot, animal or divine, and every item says who may wear it. Pieces for humans fit the man and the woman, never the robot, the dog or the owl. The God Keeper wears anything from any race, each piece in its own golden light.
- Rarity you can see: an item's effect grows with its tier. Uncommon shimmers, rare glows and wears a halo ring, legendary adds crossed rings, rays and a light of its own, and mythical shifts through every colour inside a vortex of particles that bursts now and then.
- New places to wear things: the face, the wrist and the hand. New items: Round Spectacles (every face), a Welder's Visor (robots), a Trail Watch that keeps the real time (humans) and a Star Lantern carried in the hand (humans).
- In the Marketplace: the Trail Watch at every tier (Field, Tide, Sky, Sun and Nebula), Scholar Spectacles, the First Light Lantern and the Arc Visor.

### Changed
- The Studio says why a keeper cannot wear something ("Only for humans", "Bolt has no wrist") instead of offering it and then refusing.

## [0.12.0] - 2026-11-26

### Added
- What's new: after an update, Keeper shows once what changed in each version since you last looked.
- Undo for 30 seconds after a fact is forgotten or replaced by a newer one.
- Packs are signed with your own key. Before a pack is added, Keeper says whether it is unchanged since it was made, whether it comes from a maker whose packs you added before, and warns when it uses a known maker's name with a different key. A pack that was changed after signing is refused.
- "Copy a report for support" in Settings, Health: the version, this Mac's system, every health check and Keeper's recent problems, with no conversations, facts or keys.
- Keeper keeps its own log of what went wrong, on this Mac only, including any crash.
- Under an answer, a note when what it learned is waiting to reach your memory (it is kept on this Mac until the node answers).

### Changed
- A read from the memory node that fails because the node was busy or slow is tried once more before an error is shown.
- Chat search covers your latest 3,000 exchanges (was 400), and the chat list shows up to 500 chats (was 100).
- The window opens a little faster: the Studio, Settings and Memory screens load the first time they are opened.
- Each release is checked, in a fresh virtual Mac, to update an installed copy of the version before it by itself.

### Fixed
- A lesson opened again from memory said "Switching to Tutor mode" although nothing switched.

## [0.11.2] - 2026-11-26

### Fixed
- Reminders stopped being scheduled after about 50 days of use, and a repeating reminder never came back if Keeper was closed for more than a day (FIX-0027).
- Telling Keeper something like "I moved to the night shift" or "my car is in the shop" could erase an unrelated fact (your address, your car). Keeper now replaces a fact by itself only when it is certain (a new name, address, phone number, email, birthday or favourite); anything else is only suggested in "Tidy my memory" (FIX-0027).
- Bringing in a backup made on another Mac merged its first keeper into yours. It now arrives as its own keeper (FIX-0027).
- A dropped document could break out of the space it is read in, and a turn about a dropped file could still forget facts or run skills. Material is now fenced so it cannot close its own fence, and such a turn only reads and answers (FIX-0027).
- Keeper's own folder (with its keys) and special files could be dropped and read. Only ordinary files outside Keeper's own folders are read, and web pages are read as text without being opened (FIX-0027).
- On a child profile, an edited Tutor could give a child the web, modes and souls could still be edited, deleting one file turned the profile off, and a phone link left running stayed on. All closed (FIX-0027).
- The Studio could save over and over without stopping, retried a failed save without end, and lost a change made while a save was running (FIX-0027).
- "Save that as a PDF" was taken as saving a routine. Saving a routine now needs the word "routine" ("save that as my Friday tidy routine").
- Reminders and focus sessions ran late after the Mac had been asleep.
- A phone on the network could ask Keeper to read the Mac's clipboard. Copied text is now only worked on at the Mac.
- Panels with nothing in them (a table with no rows, a chart with no numbers) no longer appear.

### Added
- This changelog, kept for every version and shown as the notes of each release.

## [0.11.1] - 2026-11-26

### Added
- Reminders that came due while Keeper was closed are said once at the next start, in one line. A repeating one comes back at its next time.
- "Tidy my memory" lists facts that something newer has replaced, each with a Forget button.
- The "What I can do" page gains "Make the text bigger" and "Tidy my memory".

### Changed
- Examples on the "What I can do" page open Settings at the right section (backup, text size).
- Settings opens on the Health tab each time.
- The memory pill in the top bar is a button that opens the health checks.
- On a child profile the phone link will not start and a backup cannot be brought in.
- Every release now also runs an end-to-end test: a test copy of the real app is sent real messages and each reply is checked.

### Fixed
- "Save that as my Friday tidy" saved the request before the last one. It now takes the request just before it.

## [0.11.0] - 2026-11-26

### Added
- A "What I can do" page: every ability as an example you press to try, with a search.
- "Is everything working?" in Settings: the memory node, this keeper's memory, the mind, the voice, the calendar and the spending limit are checked for real, with a fix button where Keeper can act.
- A receipt under any answer that changed something on the computer, with "Put it back".
- Reminders can repeat (daily, weekdays, weekly), be snoozed, and be deleted from the list.
- Chats: search every conversation, rename a chat, pin a chat to the top.
- Dropped PDFs are read, and so are the words in a dropped picture.
- A text size setting (Normal, Large, Larger) for all of Keeper.
- Every release runs the memory tests for real against a memory node before it can be tagged.

### Changed
- Errors say what actually failed (not running, too slow, refused, busy) instead of one message for everything.
- Every panel shows one line on what you can do with it, and the keeper leads numbers with what they mean.
- Settings is in five tabs with a search that finds a section in any tab.
- The Studio saves everything as you change it. One Done button replaces Save.
- Touching the keeper, or starting to type, stops it talking. A long answer is spoken as its first two sentences; the rest is on screen.
- Every control shows a focus ring when reached by keyboard.

## [0.10.2] - 2026-11-26

### Added
- Memory recalls by meaning, not only by matching words: "who should I call for family news?" finds "Your sister is Maya".
- A newer fact replaces the one it makes out of date (a new address, job, phone number or favourite). The chat shows "Replaced: …" under the answer.

### Changed
- A fact named by its own words is forgotten alone. Before, forgetting could also take other facts that shared a word with it.

## [0.10.1] - 2026-11-26

### Fixed
- The Studio said "Your memory node isn't answering" and could not read the level. After memory moved into sub-graphs, six reads still used the wrong address; the level, pinned scenes, quiz streaks, saved scenes, routines and season progress read correctly again (FIX-0026).
- The first panel on a network question showed two numbers and no explanation. It now says what the traffic means and shows speed in and out, the peak, this Mac's address and totals (FIX-0025).

## [0.10.0] - 2026-11-26

### Added
- Under every answer: what the keeper knew about you when it answered, with Forget beside each fact.
- Drop a file or dragged text on the keeper: it summarises, explains or remembers it.
- Backup: every keeper, its memory and the kit in one passphrase-locked file, which can be brought in on another Mac.
- Spending: the cost under each answer, the month's total, and a monthly limit that keeps answers on this Mac.
- Child profile: a passcode-locked switch for a child's Keeper.
- Focus sessions: a quiet stretch with reminders held, counted toward the keeper's level.
- Routines: save a request under a name and run it again by that name.
- Week in review, built from the keeper's own memory.
- Work on text you copied in any app: rewrite, shorten, fix, translate or explain it.
- Seasons: a small set open for a few weeks, each item earned by something useful you do.
- Keeper card: a picture of the keeper with its name, level and soul.
- Pick the keeper up: press and hold, then move.
- Packs carry their maker's name and link, shown before a pack is added.
- The Forge's base maker sets every effect by hand, tried on live.

### Changed
- A touch is answered from the keeper's soul and current mood, not from a fixed list of lines.
- The keeper's mood shows in its body: smile and light, breathing, blinking, lids.
- One spacing and type scale across every screen, a rebuilt Marketplace, and a side menu in the Studio (FIX-0024).
- All memory lives in one context graph with a sub-graph per keeper and one for the kit. Existing memory is moved exactly and verified (FIX-0021, FIX-0022).
- Answers are faster and fit the question better: looks run in one call, and lessons and panels are checked by a scenario bench.

### Fixed
- An answer that arrived malformed or cut off lost its panels. The reply and every complete panel are now kept (FIX-0023).

## [0.9.1] - 2026-11-26

### Fixed
- A look at the computer that was refused one command now carries on instead of stopping; computer work shows clear steps, its panels arrive together, and a level-up no longer replaces the answer (FIX-0020).

## [0.9.0] - 2026-11-26

### Added
- Panels that fit the job: a live dashboard of the computer, watch, visit, file and sources.
- Optional feelings: a simulated mood for a keeper, with safety rules built in.
- Modes can be edited and are stored with the kit; the soul can be edited.

### Changed
- Modes are locked to their job: a request outside a mode's scope switches mode (FIX-0017).
- The Studio's tabs are grouped as Appearance, Mind and Progress.

### Fixed
- Network questions now run their look instead of stalling (FIX-0019).

## [0.8.0] - 2026-11-25

### Added
- The Studio: look, inventory, forge, habits, voice, level and marketplace for each keeper.
- Modes (jobs with their own skills and tools) and answer styles, chosen per chat.
- Rarity, and levels earned by use; your own picture on a pendant or a T-shirt.
- Design a wardrobe item from words.

### Changed
- Each chat is its own train of thought.
- Work on the computer is shown live in words and animation, never as commands.
- Panel actions answer instantly; a lesson's cards are prepared together.

## [0.7.4] - 2026-11-25

### Fixed
- Everyday words no longer send a chat down the slow acting path.
- Idle engine processes are ended after 20 minutes (FIX-0014).

## [0.7.3] - 2026-11-25

### Added
- Delete a conversation, and its words leave the memory node.

### Changed
- Keeper starts speaking at the first sentence of an answer.
- A lesson answered before opens from memory without a round trip to the node.

### Fixed
- "Forget" erases the fact from the node instead of only hiding it (FIX-0013).

## [0.7.2] - 2026-11-25

### Added
- Approve a plan from the phone.

### Changed
- "What was I working on?" answers at once from the files changed.
- Lessons are tighter, the speed line shows when the first picture arrived, and approving is twice as fast.

## [0.7.1] - 2026-11-25

### Fixed
- A System Administrator keeper answers ordinary chat at chat speed (FIX-0012).

## [0.7.0] - 2026-11-25

### Added
- The command palette (Command-K).
- One wardrobe per person: any keeper wears any item, fitted to its body.
- An expressive face: emotes, idle life and naps.
- Stop ends a turn; messages sent while the keeper is busy wait their turn.
- Keeper sets up Claude Code and opens its sign-in.
- Remove Keeper from this Mac.

### Changed
- Faster answers: hot memory, writes after the reply, warm spare engines, quick replies and live typing.
- Scenes have breadcrumbs, a strip and arrow keys.

### Fixed
- Keeper keeps answering when its memory node stops, and starts it again (FIX-0009, FIX-0010, FIX-0011).
- Keeper installs its own checksum-verified Node.js for the memory node (FIX-0008).

## [0.6.2] - 2026-11-25

### Fixed
- The collapsed keepers rail shows one clean active frame (FIX-0006).

## [0.6.1] - 2026-11-25

### Added
- Pinned scenes.

### Changed
- An approved plan is enforced: the first step outside it stops the engine.
- The morning brief lists files in 20 ms.

## [0.6.0] - 2026-11-25

### Added
- Panels you work in (checklists, forms, quizzes), approve before acting, and the morning brief.

### Changed
- Faster answers.

## [0.5.1] - 2026-11-25

### Fixed
- Cards show their title and text together; engine tags no longer wrap.

## [0.5.0] - 2026-11-25

### Added
- Scenes you can go back to, panels that arrive while the answer is still being written, a visual mode, and fast updates.

## [0.4.0] - 2026-11-25

### Added
- The Stage (answers shown as panels), the Keeper Kit (soul, role, body, outfit) and work animations.

## [0.3.1] - 2026-11-25

### Fixed
- The Windows and Linux builds failed to compile (a macOS-only event).

## [0.3.0] - 2026-11-25

### Added
- Several keepers, each with its own memory graph; chats; the question catalog; push to talk; Windows and Linux builds.

### Changed
- API keys are kept in Keeper's own private store, so macOS no longer asks for the Keychain.

## [0.2.0] - 2026-11-25

### Added
- The first release, as Keeper (renamed from Umoja Desk): a personal assistant whose memory is your own OriginTrail DKG node, with open-mic listening and chat history read from the node.
