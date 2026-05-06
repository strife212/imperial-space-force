// ── Encyclopedia data ─────────────────────────────────────────────────────────
// content: null  →  entry exists but has no article yet (unclickable)
// content: { title, body: [...paragraphs] }  →  full article

const LOREM_A = `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`

const LOREM_B = `Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit.`

const LOREM_C = `At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident. Similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio.`

// ── Helper ────────────────────────────────────────────────────────────────────
const stub = (prefix, n) =>
  Array.from({ length: n }, (_, i) => ({
    id:      `${prefix}-${i + 2}`,
    title:   `${prefix.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} Placeholder ${i + 2}`,
    content: null,
  }))

// ── Topics ────────────────────────────────────────────────────────────────────
export const ENCYCLOPEDIA = [
  {
    id:    'imperial-lore',
    label: 'Imperial Lore',
    entries: [
      {
        id:    'imperial-lore-1',
        title: 'Imperial Lore Placeholder 1',
        content: {
          heading: 'Imperial Lore Placeholder 1',
          body: [LOREM_A, LOREM_B, LOREM_C],
        },
      },
      ...stub('imperial-lore', 19),
    ],
  },
  {
    id:    'technology',
    label: 'Technology',
    entries: [
      {
        id:    'technology-1',
        title: 'Technology Placeholder 1',
        content: {
          heading: 'Technology Placeholder 1',
          body: [LOREM_B, LOREM_C, LOREM_A],
        },
      },
      ...stub('technology', 19),
    ],
  },
  {
    id:    'world',
    label: 'World',
    entries: [
      {
        id:    'world-1',
        title: 'World Placeholder 1',
        content: {
          heading: 'World Placeholder 1',
          body: [LOREM_C, LOREM_A, LOREM_B],
        },
      },
      ...stub('world', 19),
    ],
  },
]
