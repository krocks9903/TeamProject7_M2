/** A pointer to a finding and the page it quotes. Opening one jumps to Document Map. */
export interface PageRef {
  findingId: string;
  page: number;
}

export interface ActiveRef extends PageRef {
  /** Bumped on every jump so the highlighter sweep replays. */
  nonce: number;
}
