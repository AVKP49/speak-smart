/**
 * Content model types — mirrors the scenario schema in spec §5.3.
 * Components render this schema and nothing else (agent rule 3).
 */
import type { Register } from "./config";

export type { Register };

export interface Reply {
  register: Register;
  /** The line, displayed verbatim. Never generated or edited at runtime. */
  line: string;
  /** Second-language rendering, shown as a subtitle when present. */
  line_l2?: string;
  /** Exactly one sentence. Names the mechanism, never generic praise. */
  why: string;
  /** Second-language rendering of the coaching line. */
  why_l2?: string;
  /** Optional per-reply coaching, shown with the line in the reveal. */
  delivery?: string;
  /** e.g. "work-risk". Sharp lines in risky arenas carry a caution. */
  caution?: string | null;
}

export interface Trap {
  /** The satisfying-but-costly reply, shown last and labeled. */
  line: string;
  line_l2?: string;
  /** One line: the cost. */
  why: string;
  why_l2?: string;
}

export interface Scenario {
  /** kebab-case id, e.g. "work.boss-talking-down.0001". */
  id: string;
  category: string;
  subcategory: string;
  /** Setting line only — where you are, who's talking. */
  setting: string;
  setting_l2?: string;
  /** Their line, as actually said in the wild. */
  jab: string;
  jab_l2?: string;
  /** The concrete conversational skill this drill practices. */
  goal?: string;
  /** Authored second turn; never generated during a drill. */
  followUp?: { jab: string; line: string; why: string; delivery: string };
  /** 1–3. */
  difficulty: 1 | 2 | 3;
  tags: string[];
  /** 3–5 entries, distinct registers. */
  replies: Reply[];
  trap?: Trap;
  review: { tier: "full" | "sample"; status: "approved" | "draft" | "flagged"; method?: "agent-editorial" | "human-editorial"; reviewer?: string; reviewedAt?: string; independentHumanReview?: boolean };
}

export interface PackMeta {
  id: string;
  category: string;
  subcategory: string;
  title: string;
  description: string;
  /** Semver-ish content version; bumped on any scenario change. */
  version: string;
}

export interface PackFile {
  pack: PackMeta;
  scenarios: Scenario[];
}

/** Category taxonomy (§5.1). Subcategory slugs per category (locked for V1). */
export interface CategoryMeta {
  id: string;
  title: string;
  subcategories: { slug: string; title: string }[];
}

export const CATEGORIES: CategoryMeta[] = [
  {
    id: "work",
    title: "Work",
    subcategories: [
      { slug: "boss-talking-down", title: "Boss talking down to you" },
      { slug: "credit-stealers", title: "Credit stealers" },
      { slug: "interrupters", title: "Interrupters & talk-overs" },
      { slug: "condescending-coworkers", title: "Condescending coworkers" },
      { slug: "clients-who-push", title: "Clients who push" },
      { slug: "raise-promotion-feedback", title: "Raise, promotion & feedback talks" },
      { slug: "blame-shifting", title: "Blame shifting" },
    ],
  },
  {
    id: "money",
    title: "Money & Buying",
    subcategories: [
      { slug: "car-dealerships", title: "Car dealerships" },
      { slug: "salons-spas-upsells", title: "Salons, spas & upsells" },
      { slug: "retail-pressure", title: "Retail & shopping pressure" },
      { slug: "contractors-quotes", title: "Contractors, quotes & change orders" },
      { slug: "landlords-leasing", title: "Landlords & leasing" },
      { slug: "tipping-checkout", title: "Tipping & checkout pressure" },
      { slug: "friends-selling-mlm", title: "Friends selling / MLM pitches" },
    ],
  },
  {
    id: "dating",
    title: "Dating",
    subcategories: [
      { slug: "first-dates", title: "First dates" },
      { slug: "texting-games", title: "Texting games & mixed signals" },
      { slug: "ghosting-fading", title: "Ghosting & fading" },
      { slug: "exes-resurfacing", title: "Exes resurfacing" },
      { slug: "boundaries-early", title: "Setting boundaries early" },
      { slug: "rejecting-gracefully", title: "Rejecting — and being rejected — gracefully" },
    ],
  },
  {
    id: "friends",
    title: "Friends",
    subcategories: [
      { slug: "moochers", title: "Moochers & money asks" },
      { slug: "one-uppers", title: "One-uppers" },
      { slug: "flaky-friends", title: "Flaky friends" },
      { slug: "group-chat-jabs", title: "Group-chat jabs" },
      { slug: "unsolicited-advice", title: "Unsolicited advice" },
      { slug: "crisis-only-friend", title: "The friend who only calls in crisis" },
    ],
  },
  {
    id: "family",
    title: "Family",
    subcategories: [
      { slug: "parents-in-laws", title: "Parents & in-laws" },
      { slug: "dinner-table-interrogations", title: "Dinner-table interrogations" },
      { slug: "unsolicited-life-advice", title: "Unsolicited life advice" },
      { slug: "sibling-digs", title: "Sibling digs" },
      { slug: "holiday-pressure", title: "Holiday pressure" },
      { slug: "money-family", title: "Money & family" },
    ],
  },
  {
    id: "neighbors",
    title: "Neighbors",
    subcategories: [
      { slug: "noise-parties", title: "Noise & parties" },
      { slug: "parking-driveways", title: "Parking & driveways" },
      { slug: "property-lines-hoa", title: "Property lines, fences & HOA energy" },
      { slug: "chronic-borrowers", title: "Chronic borrowers" },
      { slug: "neighborhood-group-chat", title: "The neighborhood group chat" },
    ],
  },
  {
    id: "public",
    title: "Strangers & Public",
    subcategories: [
      { slug: "condescending-strangers", title: "Condescending strangers" },
      { slug: "line-cutters", title: "Line-cutters" },
      { slug: "pushy-salespeople", title: "Pushy salespeople" },
      { slug: "talked-down-by-staff", title: "Talked down to by service staff" },
      { slug: "escalating-calmly", title: "Escalating calmly as the customer" },
      { slug: "street-transit", title: "Street & transit moments" },
    ],
  },
  {
    id: "social",
    title: "Social & Small Talk",
    subcategories: [
      { slug: "parties-weddings", title: "Parties & weddings" },
      { slug: "what-do-you-do", title: "\u201cSo what do you do?\u201d" },
      { slug: "escaping-conversation", title: "Escaping a conversation politely" },
      { slug: "introductions-names", title: "Introductions & forgotten names" },
      { slug: "compliments", title: "Compliments — giving & receiving" },
      { slug: "networking-events", title: "Networking events" },
    ],
  },
  {
    id: "texting",
    title: "Texting & Online",
    subcategories: [
      { slug: "dry-replies", title: "Dry replies & left on read" },
      { slug: "group-chats-sideways", title: "Group chats gone sideways" },
      { slug: "comments-dms", title: "Comments & DMs" },
      { slug: "sarcasm-in-text", title: "Sarcasm that doesn\u2019t land in text" },
      { slug: "work-chat-tone", title: "Work chat tone traps" },
    ],
  },
  {
    id: "hard-moments",
    title: "Hard Moments",
    subcategories: [
      { slug: "saying-no", title: "Saying no" },
      { slug: "apologizing-well", title: "Apologizing well" },
      { slug: "receiving-fake-apology", title: "Receiving a fake apology" },
      { slug: "delivering-bad-news", title: "Delivering bad news" },
      { slug: "asking-for-help", title: "Asking for help" },
      { slug: "confronting-someone", title: "Confronting someone you care about" },
    ],
  },
];

export interface ContentManifestEntry {
  id: string;
  category: string;
  subcategory: string;
  version: string;
  file: string;
  count: number;
}

export interface ContentManifest {
  /** Manifest version; bumped whenever any pack changes. */
  version: string;
  packs: ContentManifestEntry[];
}
