#!/usr/bin/env bash
# spine-inventory.sh — drift inventory for the architecture-spine skill.
#
# Counts parallel implementations per concern. The counts are the argument:
# "four sharing models, three role vocabularies, nine timeout values" is harder
# to wave away than "the architecture has drifted".
#
# Usage:  ./spine-inventory.sh [repo-root]        (default: current directory)
# Needs:  git (for file listing) or find. No other dependencies.

set -uo pipefail
ROOT="${1:-.}"
cd "$ROOT" || exit 1

# Prefer git's file list (respects .gitignore); fall back to find.
if git rev-parse --git-dir >/dev/null 2>&1; then
  FILES=$(git ls-files)
else
  FILES=$(find . -type f -not -path '*/.git/*' -not -path '*/node_modules/*' \
                 -not -path '*/venv/*' -not -path '*/.venv/*' -not -path '*/dist/*')
fi

SRC=$(echo "$FILES" | grep -Ei '\.(py|ts|tsx|js|jsx|go|rb|java|kt|cs|php|rs|sql)$' \
        | grep -Eiv '(^|/)(tests?|__tests__|spec|migrations|vendor|node_modules)/' || true)
ALL=$(echo "$FILES" | grep -Ei '\.(py|ts|tsx|js|jsx|go|rb|java|kt|cs|php|rs|sql)$' || true)

hits() { # pattern -> unique files matching
  [ -z "$SRC" ] && return
  echo "$SRC" | tr '\n' '\0' | xargs -0 grep -lEi "$1" 2>/dev/null | sort -u
}
count() { hits "$1" | wc -l | tr -d ' '; }
list()  { hits "$1" | head -"${2:-8}" | sed 's/^/      /'; }

section() { printf '\n\033[1m%s\033[0m\n' "$1"; }
row() { printf '  %-34s %s\n' "$1" "$2"; }

echo "=============================================="
echo " Spine inventory — $(pwd)"
echo " $(echo "$ALL" | wc -l | tr -d ' ') source files scanned"
echo "=============================================="

section "1. Authorization — how many sharing models?"
row "access/share/member tables"  "$(echo "$ALL" | tr '\n' '\0' | xargs -0 grep -lEi 'create table[^;]*(_access|_share|_member|_invite|_permission)|class +[A-Za-z]*(Access|Share|Member|Invite|Permission)\b' 2>/dev/null | sort -u | wc -l | tr -d ' ')"
row "inline owner-equality checks"  "$(count 'owner_id *[=!]=|user_id *[=!]= *(current_user|actor|request\.user)|created_by *[=!]= *(current_user|actor)')"
list 'owner_id *[=!]=|user_id *[=!]= *(current_user|actor|request\.user)'
row "403 responses (should be 404)"  "$(count '\b403\b|Forbidden')"

section "2. Vocabulary — how many role scales?"
row "files with role string literals"  "$(count "[\"'](owner|admin|editor|member|viewer|guest|reader|writer|contributor)[\"']")"
row "files with status literals"       "$(count "[\"'](draft|active|archived|deleted|pending|processing|failed|completed)[\"']")"

section "3. Egress — how many ways out?"
row "HTTP clients constructed"     "$(count 'requests\.(get|post|put|patch|delete)|httpx\.(Client|AsyncClient)|new +HttpClient|axios\.create|fetch\(|http\.Client\{|OkHttpClient')"
row "mail/notification senders"    "$(count 'smtplib|sendmail|sendgrid|mailgun|postmark|nodemailer|send_mail|sendEmail|EmailService|ses_client|SESClient|smtp_(host|server)')"
row "distinct timeout values"      "$(hits 'timeout' | tr '\n' '\0' | xargs -0 grep -hoEi 'timeout[ =:]+[0-9]+' 2>/dev/null | grep -oE '[0-9]+' | sort -u | wc -l | tr -d ' ')"
row "retry/backoff implementations" "$(count 'max_retries|retry_policy|backoff|tenacity|exponential_backoff|@retry')"

section "4. Vendors — SDKs outside an adapter layer"
VEND=$(echo "$SRC" | grep -Eiv '(^|/)(adapters?|integrations?|providers?|clients?|vendors?)/' || true)
vcount() { [ -z "$VEND" ] && { echo 0; return; }; echo "$VEND" | tr '\n' '\0' | xargs -0 grep -lEi "$1" 2>/dev/null | sort -u | wc -l | tr -d ' '; }
row "AI provider SDKs"   "$(vcount 'anthropic|openai|litellm|google\.generativeai|bedrock|dashscope')"
row "cloud/storage SDKs" "$(vcount 'boto3|google\.cloud|azure\.storage|@aws-sdk')"
row "payment SDKs"       "$(vcount 'stripe|paddle|braintree')"
row "queue/broker SDKs"  "$(vcount 'kafka|pika|rabbitmq|redis\.|celery|sqs|pubsub|nats')"

section "5. Model layer — routing and prompts"
row "hardcoded model ids"        "$(count 'claude-[a-z0-9.-]+|gpt-[0-9a-z.-]+|gemini-[0-9a-z.-]+|qwen[0-9a-z.-]*|llama-?[0-9]')"
row "inline prompt strings"      "$(count 'system_prompt *=|SYSTEM_PROMPT|\"\"\"You are |`You are ')"
row "token/cost accounting"      "$(count 'usage\.(input|output)_tokens|prompt_tokens|cost_per|token_count')"

section "6. Retrieval — vector stores"
row "vector store usage"         "$(count 'pgvector|qdrant|pinecone|weaviate|chroma|milvus|faiss|embedding')"
row "post-filter smell (filter after search)" "$(count '(search|query|similarity_search)\(.*\)[^\n]*\n?[^\n]*(filter|\[.*for .* if )')"

section "7. Async — events and jobs"
row "direct broker publishes"    "$(count 'producer\.send|publish\(|basic_publish|\.publish_message|xadd')"
row "outbox pattern present"     "$(count 'outbox')"
row "queue enqueues"             "$(count 'delay\(|apply_async|enqueue|\.send_task|Queue\(')"

section "8. Data — tenancy and migrations"
row "tables/models with tenant_id" "$(count 'tenant_id')"
row "raw SQL outside repositories" "$(count 'execute\( *[\"'\''`]select|SELECT .* FROM ')"
row "migration files"              "$(echo "$FILES" | grep -Eci '(migrations?|alembic)/.*\.(py|sql|ts|js)$' | tr -d ' ')"

section "9. Enforcement — does anything defend this?"
row "uniformity/architecture tests" "$(echo "$FILES" | grep -Eci 'uniformity|architecture.*test|test.*architecture|import.*lint|dependency.*test' | tr -d ' ')"
row "CLAUDE.md / AGENTS.md present" "$(echo "$FILES" | grep -Eci '(CLAUDE|AGENTS)\.md' | tr -d ' ')"
row "spine/core/platform dir"       "$(echo "$FILES" | grep -Eci '(^|/)(spine|core|platform)/' | tr -d ' ')"

cat <<'NOTE'

----------------------------------------------------------------
These are greps, not proofs — read them as signals, then verify the
top two or three by opening the files. High counts in sections 1-4
are the usual argument for starting a migration; a zero in section 9
means nothing is defending whatever you build next.

Next: pick a mode (opportunistic / phased by joint / full) with the
skill's SKILL.md, and joints with references/joints.md.
----------------------------------------------------------------
NOTE
