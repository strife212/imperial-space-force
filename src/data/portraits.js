// ── Sender portrait mapping ───────────────────────────────────────────────────
//
// Add an entry here for any sender whose portrait should appear in the mail
// overlay. The key is the sender name exactly as it appears in messages.js.
// Images live in public/mail_portraits/ and are referenced by path.

const base = import.meta.env.BASE_URL

export const SENDER_PORTRAITS = {
  'Princess Lucia':    `${base}mail_portraits/princess_lucia.png`,
  'Admiralty Command': `${base}imperial_empress_emblem.svg`,
}
