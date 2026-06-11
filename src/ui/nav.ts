// The screens you can push on top of a tab (detail and form views).
export type View =
  | { kind: 'gun-detail'; id: string }
  | { kind: 'gun-form'; id?: string }
  | { kind: 'session-detail'; id: string }
  | { kind: 'session-form'; id?: string };
