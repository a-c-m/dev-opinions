// Subject must end with a tracker reference: `#NNN` (GitHub) or
// `PROJ-NNN` (Jira/Linear). Multiple refs allowed (`... #12 ACME-3`).
// If a commit genuinely has no ticket, open one first
// (`./.claude/commands/create-issue.sh "<title>"`) or bypass the hook
// deliberately with `git commit --no-verify`.
//
// AGENTS.md "Every commit names its ticket" — this rule is universal:
// humans and AI agents both. The AI-side PreToolUse hook
// (`.claude/hooks/block-bash-git.sh`) blocks `--no-verify` on top, so
// agents have no bypass at all.
const TICKET_PATTERN = /(?:#\d+|[A-Z][A-Z0-9]+-\d+)/g;
const TRAILING_PATTERN = /^[\s)]*$/;

const ticketSuffixRule = ({ header }) => {
  if (typeof header !== "string" || header.length === 0) {
    return [true];
  }
  const matches = header.match(TICKET_PATTERN);
  if (!matches || matches.length === 0) {
    return [
      false,
      "subject must end with a tracker reference (#NNN or PROJ-NNN). example: feat(api): add search endpoint #123",
    ];
  }
  // Trailing-position check: the *last* match must abut the end of
  // the header (allow trailing `)` / whitespace). Stops a mid-subject
  // mention from satisfying the rule.
  const last = matches.at(-1);
  const tail = header.slice(header.lastIndexOf(last) + last.length);
  if (!TRAILING_PATTERN.test(tail)) {
    return [
      false,
      `tracker reference must be at the end of the subject (found "${last}" mid-subject)`,
    ];
  }
  return [true];
};

/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        "subject-ticket-suffix": ticketSuffixRule,
      },
    },
  ],
  rules: {
    "body-max-line-length": [0, "always"],
    "footer-max-line-length": [0, "always"],
    "subject-case": [2, "never", ["upper-case", "pascal-case", "start-case"]],
    "subject-ticket-suffix": [2, "always"],
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "chore",
        "revert",
      ],
    ],
  },
};
