export type UserRole = "admin" | "member";
export type RoundStatus = "draft" | "analyzing" | "locked" | "resulted" | "reviewed";
export type MatchCategory =
  | "fixed"
  | "contrarian"
  | "draw_candidate"
  | "info_wait"
  | "pass";
export type Outcome = "ONE" | "DRAW" | "TWO";
export type ProvisionalCall = "axis_1" | "axis_2" | "draw_axis" | "double" | "triple";
export type TicketMode = "conservative" | "balanced" | "upset";

export type User = {
  id: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
};

export type Round = {
  id: string;
  title: string;
  status: RoundStatus;
  budgetYen: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Match = {
  id: string;
  roundId: string;
  matchNo: number;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string | null;
  venue: string | null;
  stage: string | null;
  officialVote1: number | null;
  officialVote0: number | null;
  officialVote2: number | null;
  marketProb1: number | null;
  marketProb0: number | null;
  marketProb2: number | null;
  modelProb1: number | null;
  modelProb0: number | null;
  modelProb2: number | null;
  consensusF: number | null;
  consensusD: number | null;
  consensusCall: string | null;
  disagreementScore: number | null;
  exceptionCount: number | null;
  confidence: number | null;
  category: MatchCategory | null;
  recommendedOutcomes: string | null;
  tacticalNote: string | null;
  injuryNote: string | null;
  motivationNote: string | null;
  adminNote: string | null;
  actualResult: Outcome | null;
  createdAt: string;
  updatedAt: string;
};

export type Pick = {
  id: string;
  roundId: string;
  matchId: string;
  userId: string;
  pick: Outcome;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  user?: User;
};

export type HumanScoutReport = {
  id: string;
  roundId: string;
  matchId: string;
  userId: string;
  scoreStrengthForm: number;
  noteStrengthForm: string | null;
  scoreAvailability: number;
  noteAvailability: string | null;
  scoreConditions: number;
  noteConditions: string | null;
  scoreTacticalMatchup: number;
  noteTacticalMatchup: string | null;
  scoreMicro: number;
  noteMicro: string | null;
  drawAlert: number;
  noteDrawAlert: string | null;
  directionScoreF: number;
  provisionalCall: ProvisionalCall;
  exceptionFlag: boolean;
  exceptionNote: string | null;
  createdAt: string;
  updatedAt: string;
  user?: User;
  match?: Match;
};

export type GeneratedTicket = {
  id: string;
  roundId: string;
  mode: TicketMode;
  ticketJson: string;
  ticketScore: number | null;
  estimatedHitProb: number | null;
  contrarianScore: number | null;
  createdAt: string;
};

export type ReviewNote = {
  id: string;
  roundId: string;
  matchId: string | null;
  userId: string | null;
  note: string;
  createdAt: string;
  user?: User;
  match?: Match;
};

export type RoundWorkspaceRound = Round & {
  matches: Match[];
  picks: Pick[];
  scoutReports: HumanScoutReport[];
  generatedTickets: GeneratedTicket[];
  reviewNotes: ReviewNote[];
};

export type RoundWorkspace = {
  round: RoundWorkspaceRound;
  users: User[];
};

export type DashboardRoundSummary = Round & {
  matches: Match[];
  picks: Pick[];
  scoutReports: HumanScoutReport[];
  matchCount: number;
  pickCount: number;
  resultedCount: number;
  consensusCompletion: number;
  topEdges: Array<{
    matchId: string;
    matchNo: number;
    fixture: string;
    edge: number;
  }>;
};

export type DashboardData = {
  rounds: DashboardRoundSummary[];
  users: User[];
};
