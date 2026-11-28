/**
 * What a keeper can do, as examples a person can press: each either says something to the
 * keeper (`say`) or opens a place in the app (`open`). One list, shown on the "What I can do"
 * page; pure data, checked by a test (every example does exactly one thing, no two alike).
 */
export type Place = 'studio' | 'settings' | 'memory';

export interface Example {
  /** What the person sees on the button. */
  title: string;
  /** One line on what happens. */
  hint: string;
  /** Said to the keeper when pressed… */
  say?: string;
  /** …or the place that opens. */
  open?: Place;
  /** With `open: 'settings'`: the words that find its section there ("backup"). */
  find?: string;
  /** Needs something first, said plainly ("Copy some text first"). */
  needs?: string;
}

export interface Group {
  id: string;
  title: string;
  examples: Example[];
}

export const CAN_DO: readonly Group[] = [
  {
    id: 'everyday',
    title: 'Every day',
    examples: [
      { title: 'Brief me', hint: 'Your day: calendar, reminders and the files you changed.', say: 'Brief me' },
      { title: 'Week in review', hint: 'What we talked about, what I learned and what I did.', say: 'Week in review' },
      { title: 'Remind me in 10 minutes to stretch', hint: 'A reminder, spoken when it is due.', say: 'Remind me in 10 minutes to stretch' },
      { title: 'Focus for 25 minutes', hint: 'A quiet stretch: reminders wait until it ends.', say: 'Focus for 25 minutes' },
      { title: 'Find my resume', hint: 'Looks through this Mac for a file by name.', say: 'Find my resume' },
      { title: "What's on tomorrow?", hint: 'Your calendar and reminders for the day, in order.', say: "What's on tomorrow?" },
      { title: 'What reminders do I have?', hint: 'Every reminder still ahead, with Delete beside each.', say: 'What reminders do I have?' },
    ],
  },
  {
    id: 'learn',
    title: 'Learn something',
    examples: [
      { title: 'Explain fractions visually', hint: 'A lesson in panels you can point at and ask about.', say: 'Explain fractions visually' },
      { title: 'Quiz me on what I just learned', hint: 'Questions on the lesson; right answers count toward the level.', say: 'Quiz me on what I just learned' },
      { title: 'Show me a video on how to tie a tie', hint: 'One real video, played right here; two others to swap to.', say: 'Show me a video on how to tie a tie' },
      { title: 'Find my movies', hint: 'Your videos on this Mac, newest first, played right here.', say: 'Find my movies' },
    ],
  },
  {
    id: 'text',
    title: 'Text and files',
    examples: [
      { title: 'Fix what I copied', hint: 'Corrects the text on your clipboard and puts it back.', say: 'Fix what I copied', needs: 'Copy some text first.' },
      { title: 'Shorten what I copied', hint: 'About half the length, same meaning.', say: 'Shorten what I copied', needs: 'Copy some text first.' },
      { title: 'Fix the spelling in a file', hint: 'I show the changes here; you edit them if you like and press Save.', say: 'Fix the spelling in ~/Documents/notes.txt' },
      { title: 'Write a document', hint: 'A new document you read and change here; it is made when you press Save.', say: 'Write a one-page plan for a dinner party for six in my Documents folder' },
      { title: 'Write an email', hint: 'Opens your mail app with the email written; you read it and press Send.', say: 'Write a short email to my landlord asking when the heating will be fixed' },
      { title: 'Check my email', hint: 'Who wrote and what about, for your unread emails (never their words).', say: 'Check my email' },
      { title: 'Drop a file on me', hint: 'Drag a document, a PDF or a picture onto this window: I summarise, explain or remember it.' },
    ],
  },
  {
    id: 'memory',
    title: 'Memory',
    examples: [
      { title: 'What do you know about me?', hint: 'Everything I remember, with Forget beside each.', say: 'What do you know about me?' },
      { title: 'Open my memory', hint: 'Conversations, knowledge, actions and reminders.', open: 'memory' },
      { title: 'Save a backup', hint: 'One locked file with your keepers and everything they remember.', open: 'settings', find: 'backup' },
    ],
  },
  {
    id: 'computer',
    title: 'This computer',
    examples: [
      { title: "How's my computer?", hint: 'Processor, memory, disk and network, live.', say: "How's my computer?" },
      { title: 'What is going on with my network?', hint: 'Your connection right now, then a closer look.', say: 'What is going on with my network?' },
      { title: 'What routines do I have?', hint: 'Things you asked me to do, saved by name ("save that as my Friday tidy routine").', say: 'What routines do I have?' },
    ],
  },
  {
    id: 'mac',
    title: 'Around your Mac',
    examples: [
      { title: "What's my battery?", hint: 'Charge, charging or not, and the time left.', say: "What's my battery?" },
      { title: 'How much space do I have?', hint: 'Free and used space on your startup disk.', say: 'How much space do I have?' },
      { title: 'What time is it in Tokyo?', hint: 'The time anywhere, and how far ahead or behind you it is.', say: 'What time is it in Tokyo?' },
      { title: 'Turn on dark mode', hint: 'Switches the Mac to dark; ask again to switch back.', say: 'Turn on dark mode' },
      { title: 'Keep my Mac awake for an hour', hint: 'No sleeping while you read or present; it lets go by itself.', say: 'Keep my Mac awake for an hour' },
      { title: 'Take a screenshot', hint: 'Silent, saved in Pictures/Keeper and shown here.', say: 'Take a screenshot' },
      { title: 'What Shortcuts do I have?', hint: 'Your Shortcuts, listed; then ask me to run one by its name.', say: 'What Shortcuts do I have?' },
    ],
  },
  {
    id: 'yours',
    title: 'Make it yours',
    examples: [
      { title: 'Make the text bigger', hint: 'Normal, Large or Larger, for all of Keeper.', open: 'settings', find: 'text size' },
      { title: 'Tidy my memory', hint: 'Shows what something newer has replaced, to forget.', say: 'Tidy my memory' },
      { title: 'Open the Studio', hint: 'Look, outfit, soul, feelings, voice, level and the marketplace.', open: 'studio' },
      { title: 'Is everything working?', hint: 'Checks the memory node, the mind, the voice and more.', open: 'settings' },
    ],
  },
];

/** Every example in one list (for searching and for the test). */
export function allExamples(groups: readonly Group[] = CAN_DO): Example[] {
  return groups.flatMap((g) => g.examples);
}

/** The groups with only the examples whose title or hint holds every typed word. */
export function matching(query: string, groups: readonly Group[] = CAN_DO): Group[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...groups];
  return groups.map((g) => ({ ...g, examples: g.examples.filter((e) => words.every((w) => `${e.title} ${e.hint}`.toLowerCase().includes(w))) })).filter((g) => g.examples.length > 0);
}
