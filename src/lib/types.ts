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
export type ProductType = "toto13" | "mini_toto" | "winner" | "custom";
export type RoundSource = "fixture_master" | "toto_official_manual" | "user_manual" | "demo_sample";
export type CompetitionType = "world_cup" | "domestic_toto" | "winner" | "custom";
export type SportContext = "national_team" | "j_league" | "club" | "other";
export type PrimaryUse = "real_round_research" | "practice" | "demo" | "friend_game";
export type DataProfile = "worldcup_rich" | "domestic_standard" | "manual_light" | "demo";
export type ProbabilityReadiness = "ready" | "partial" | "low_confidence" | "not_ready";
export type ProbabilityConfidence = "high" | "medium" | "low" | "fallback";
export type ModelProfile =
  | "market_plus_adjustments"
  | "market_plus_scout"
  | "scout_only"
  | "fallback_prior";
export type VoidHandling =
  | "manual"
  | "all_outcomes_valid"
  | "exclude_from_combo"
  | "keep_as_pending";
export type CandidateStrategyType =
  | "orthodox_model"
  | "public_favorite"
  | "human_consensus"
  | "ev_hunter"
  | "sleeping_value"
  | "draw_alert"
  | "upset";
export type CandidateDataQuality =
  | "complete"
  | "missing_official_vote"
  | "missing_model_prob"
  | "proxy_only"
  | "demo_data";
export type CandidateVoteValue = "like" | "maybe" | "pass" | "bought_myself";
export type FixtureSource =
  | "fifa_official_manual"
  | "fifa_official_csv"
  | "fifa_official_api"
  | "user_manual"
  | "demo_sample";
export type FixtureDataConfidence = "official" | "manual_official_source" | "demo" | "unknown";
export type TotoOfficialResultStatus =
  | "draft"
  | "selling"
  | "closed"
  | "resulted"
  | "cancelled"
  | "unknown";
export type TotoOfficialMatchStatus =
  | "scheduled"
  | "played"
  | "cancelled"
  | "postponed"
  | "void"
  | "unknown";
export type Goal3TeamRole = "home" | "away";
export type ResearchMemoType =
  | "recent_form"
  | "injury"
  | "suspension"
  | "motivation"
  | "travel_rest"
  | "tactical"
  | "weather"
  | "odds"
  | "news"
  | "other";
export type ResearchMemoConfidence = "high" | "medium" | "low";

export type User = {
  id: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
};

export type PickSupport =
  | { kind: "manual" }
  | { kind: "ai" }
  | { kind: "predictor"; userId: string };

export type Round = {
  id: string;
  title: string;
  status: RoundStatus;
  budgetYen: number | null;
  notes: string | null;
  competitionType: CompetitionType;
  productType: ProductType;
  sportContext: SportContext;
  primaryUse: PrimaryUse;
  requiredMatchCount: number | null;
  activeMatchCount: number | null;
  dataProfile: DataProfile;
  probabilityReadiness: ProbabilityReadiness;
  roundSource: RoundSource;
  sourceNote: string | null;
  outcomeSetJson: string[] | null;
  voidHandling: VoidHandling;
  participantIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type Match = {
  id: string;
  roundId: string;
  fixtureMasterId: string | null;
  officialMatchNo: number | null;
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
  recentFormNote: string | null;
  availabilityInfo: string | null;
  conditionsInfo: string | null;
  homeStrengthAdjust: number | null;
  awayStrengthAdjust: number | null;
  availabilityAdjust: number | null;
  conditionsAdjust: number | null;
  tacticalAdjust: number | null;
  motivationAdjust: number | null;
  adminAdjust1: number | null;
  adminAdjust0: number | null;
  adminAdjust2: number | null;
  homeAdvantageAdjust: number | null;
  restDaysAdjust: number | null;
  travelAdjust: number | null;
  leagueTableMotivationAdjust: number | null;
  injurySuspensionAdjust: number | null;
  rotationRiskAdjust: number | null;
  groupStandingMotivationAdjust: number | null;
  travelClimateAdjust: number | null;
  altitudeHumidityAdjust: number | null;
  squadDepthAdjust: number | null;
  tournamentPressureAdjust: number | null;
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
  support: PickSupport;
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

export type RoundEvAssumption = {
  id: string;
  roundId: string;
  stakeYen: number;
  totalSalesYen: number | null;
  returnRate: number;
  firstPrizeShare: number;
  carryoverYen: number;
  payoutCapYen: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CandidatePick = {
  matchNo: number;
  pick: "1" | "0" | "2";
};

export type CandidateTicket = {
  id: string;
  roundId: string;
  label: string;
  strategyType: CandidateStrategyType;
  picks: CandidatePick[];
  pModelCombo: number | null;
  pPublicCombo: number | null;
  estimatedPayoutYen: number | null;
  grossEvYen: number | null;
  evMultiple: number | null;
  evPercent: number | null;
  proxyScore: number | null;
  hitProbability: number | null;
  publicOverlapScore: number | null;
  contrarianCount: number;
  drawCount: number;
  humanAlignmentScore: number | null;
  dataQuality: CandidateDataQuality;
  rationale: string | null;
  warning: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CandidateVote = {
  id: string;
  roundId: string;
  candidateTicketId: string;
  userId: string;
  vote: CandidateVoteValue;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  user?: User;
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

export type FixtureMaster = {
  id: string;
  competition: string;
  source: FixtureSource;
  sourceUrl: string | null;
  sourceText: string | null;
  externalFixtureId: string | null;
  matchDate: string | null;
  kickoffTime: string | null;
  timezone: string | null;
  homeTeam: string;
  awayTeam: string;
  groupName: string | null;
  stage: string | null;
  venue: string | null;
  city: string | null;
  country: string | null;
  dataConfidence: FixtureDataConfidence;
  createdAt: string;
  updatedAt: string;
};

export type TotoOfficialRound = {
  id: string;
  roundId: string;
  productType: ProductType;
  officialRoundName: string | null;
  officialRoundNumber: number | null;
  salesStartAt: string | null;
  salesEndAt: string | null;
  resultStatus: TotoOfficialResultStatus;
  stakeYen: number;
  totalSalesYen: number | null;
  returnRate: number;
  firstPrizeShare: number | null;
  carryoverYen: number;
  payoutCapYen: number | null;
  sourceUrl: string | null;
  sourceText: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TotoOfficialMatch = {
  id: string;
  roundId: string;
  matchId: string | null;
  fixtureMasterId: string | null;
  officialMatchNo: number;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string | null;
  venue: string | null;
  stage: string | null;
  officialVote1: number | null;
  officialVote0: number | null;
  officialVote2: number | null;
  actualResult: Outcome | null;
  matchStatus: TotoOfficialMatchStatus;
  sourceText: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TotoOfficialRoundLibraryMatch = {
  actualResult: Outcome | null;
  awayTeam: string;
  fixtureMasterId: string | null;
  homeTeam: string;
  kickoffTime: string | null;
  matchStatus: TotoOfficialMatchStatus;
  officialMatchNo: number;
  officialVote0: number | null;
  officialVote1: number | null;
  officialVote2: number | null;
  sourceText: string | null;
  stage: string | null;
  venue: string | null;
};

export type TotoOfficialRoundLibraryEntry = {
  id: string;
  title: string;
  notes: string | null;
  productType: ProductType;
  requiredMatchCount: number | null;
  outcomeSetJson: string[] | null;
  sourceNote: string | null;
  voidHandling: VoidHandling;
  officialRoundName: string | null;
  officialRoundNumber: number | null;
  salesStartAt: string | null;
  salesEndAt: string | null;
  resultStatus: TotoOfficialResultStatus;
  stakeYen: number;
  totalSalesYen: number | null;
  returnRate: number;
  firstPrizeShare: number | null;
  carryoverYen: number;
  payoutCapYen: number | null;
  sourceUrl: string | null;
  sourceText: string | null;
  matchCount: number;
  matches: TotoOfficialRoundLibraryMatch[];
  createdAt: string;
  updatedAt: string;
};

export type ResearchMemo = {
  id: string;
  roundId: string;
  matchId: string | null;
  team: string | null;
  memoType: ResearchMemoType;
  title: string;
  summary: string;
  sourceUrl: string | null;
  sourceName: string | null;
  sourceDate: string | null;
  confidence: ResearchMemoConfidence;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  user?: User;
  match?: Match;
};

export type ProductRule = {
  outcomeSetJson: string[];
  productType: ProductType;
  requiredMatchCount: number | null;
  voidHandling: VoidHandling;
};

export type OutcomeEdge = {
  edge: number | null;
  fixture: string;
  matchId: string;
  matchNo: number;
  marketProb: number | null;
  modelFavorite: boolean;
  modelProb: number | null;
  officialVote: number | null;
  outcome: "1" | "0" | "2";
  publicFavorite: boolean;
  publicOverweight: number | null;
  reasons: string[];
  valueRatio: number | null;
};

export type RoundWorkspaceRound = Round & {
  matches: Match[];
  picks: Pick[];
  scoutReports: HumanScoutReport[];
  researchMemos: ResearchMemo[];
  generatedTickets: GeneratedTicket[];
  evAssumption: RoundEvAssumption | null;
  candidateTickets: CandidateTicket[];
  candidateVotes: CandidateVote[];
  totoOfficialRound: TotoOfficialRound | null;
  totoOfficialMatches: TotoOfficialMatch[];
  reviewNotes: ReviewNote[];
};

export type RoundWorkspace = {
  availableUsers: User[];
  round: RoundWorkspaceRound;
  users: User[];
};

export type DashboardRoundSummary = Round & {
  candidateTicketCount: number;
  matches: Match[];
  picks: Pick[];
  scoutReports: HumanScoutReport[];
  reviewNotes: ReviewNote[];
  matchCount: number;
  pickCount: number;
  resultedCount: number;
  consensusCompletion: number;
  topSignals: Array<{
    attentionShare: number;
    bucket: "core" | "focus" | "darkhorse" | "watch";
    compositeAdvantage: number;
    matchId: string;
    matchNo: number;
    fixture: string;
    outcome: "1" | "0" | "2";
  }>;
};

export type DashboardData = {
  demoUsers: User[];
  rounds: DashboardRoundSummary[];
  users: User[];
};
