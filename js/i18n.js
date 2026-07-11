// UI strings. English only for launch, but structured for future languages.
// The AI (not the UI) speaks each user's own language in private flows.

const STRINGS = {
  en: {
    tagline: "Instant crowd chat. 24 hours. Then it's gone.",
    homeRule: "24 hours. One playful crowd, one shared idea. No money, no pressure — just jump in, bring your imagination, and enjoy the ride. What matters is what happens in these 24 hours. ⚡",
    join: 'Jump into the crowd ⚡',
    onlineNow: 'Online now',
    participants: 'Participants',
    timeLeft: 'Time remaining',
    hallOfFame: 'Hall of Fame',
    coCreators: 'Co-creators Wall',
    startNew: 'Start new challenge',
    experimentOver: 'The experiment is over.',
    send: 'Send',
    typeMessage: 'Type a message…',
    translate: 'Translate',
    share: 'Share',
    shareRecap: 'Share this recap',
    improve: '💡 Improve this app',
    creationSpeed: 'Creation speed',
    proposeExtension: 'Propose +24h',
    voteYes: 'Yes',
    voteNo: 'No',
    goalVote: 'Goal vote',
    finalRating: 'Rate the result (1–10)',
    messageQueued: 'Message queued — moderation is busy, we will post it shortly.',
    rejected: 'Message blocked',
    blocked: 'You have been blocked from this chat after repeated violations.',
    flagsTooltip: 'This chat is multilingual — the AI assistant speaks your language.',
    joining: 'Joining…',
    onboardingTitle: 'Quick intro with the assistant',
    pledge: 'This is an experiment. If your idea is adopted, your contribution stays recognized on the Co-creators Wall. If one day this project generates value, those who built it with us will be the first to be involved. This is a goodwill statement, not a contract: it gives you no rights, ownership or claim of any kind.',
    upvote: 'Upvote',
    adopted: 'Adopted',
    proposed: 'Proposed',
    msgPerHour: 'msg/h',
    ideasPerHour: 'ideas/h',
    copyLink: 'Copy link',
    copied: 'Copied!',
    noChat: 'There is no active challenge right now.',
    backHome: 'Home',
    // End-of-challenge / read-only
    chatEndedTitle: 'Challenge ended',
    chatEndedInfo: 'The 24 hours are over. The chat is now read-only — you can read the final recap and rate the result, but you can no longer send messages.',
    readOnly: 'Read-only — the challenge has ended',
    // Legal / consent
    mustAccept: 'You need to accept the terms to join.',
    terms: 'What is this? · Terms',
    // Admin
    admin: '⚙︎ Admin',
    adminPanel: 'Admin controls',
    adminStartTest: 'Start TEST challenge (10 min)',
    adminStart24: 'Start challenge (24h)',
    adminResetTimer: 'Reset timer to 24h',
    adminSet10: 'Set timer: 10 min',
    adminSet1h: 'Set timer: 1 hour',
    adminCloseNow: 'Close challenge now',
    adminDone: 'Done',
    adminForbidden: 'Admin only.',
  },
};

let current = 'en';

export function setLang(l) { if (STRINGS[l]) current = l; }
export function t(key) {
  return (STRINGS[current] && STRINGS[current][key]) || STRINGS.en[key] || key;
}
