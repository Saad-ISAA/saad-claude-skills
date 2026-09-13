#!/usr/bin/env bash
# spine-inventory.sh — drift inventory for the spine skill.
#
# Counts parallel implementations per concern and lists candidate spines that
# already exist under any name. The counts are the argument: "four sharing
# models, three role vocabularies, nine timeout values" is harder to wave away
# than "the architecture has drifted".
#
# These are greps, not proofs. Re-measure anything you intend to report.
#
# Usage:  ./spine-inventory.sh [repo-root]        (default: current directory)
# Needs:  bash, grep; git if available. No other dependencies.

set -uo pipefail
ROOT="${1:-.}"
cd "$ROOT" || exit 1

# Vendored and generated trees are excluded even when committed — counting a
# checked-in virtualenv is the most common way these numbers go wrong.
VENDORED='(^|/)(node_modules|venv|\.venv|env|site-packages|vendor|dist|build|\.next|__pycache__|third_party|coverage|\.tox)/'

if git rev-parse --git-dir >/dev/null 2>&1; then
  FILES=$(git ls-files | grep -Ev "$VENDORED" || true)
else
  FILES=$(find . -type f -not -path '*/.git/*' | sed 's|^\./||' | grep -Ev "$VENDORED" || true)
fi

ALL=$(echo "$FILES" | grep -Ei '\.(py|ts|tsx|js|jsx|mjs|go|rb|java|kt|cs|php|rs|sql)$' || true)
SRC=$(echo "$ALL" | grep -Eiv '(^|/)(tests?|__tests__|spec|migrations|fixtures)/|(_test|\.test|\.spec)\.' || true)

_grep() { [ -z "$1" ] && return 0; echo "$1" | tr '\n' '\0' | xargs -0 grep -H $2 -E "$3" 2>/dev/null; }
hits()  { _grep "$SRC" "-lHIi" "$1" | sort -u; }
count() { hits "$1" | grep -c . ; }
list()  { hits "$1" | head -"${2:-8}" | sed '/^$/d; s/^/      /'; }

section() { printf '\n\033[1m%s\033[0m\n' "$1"; }
row() { printf '  %-52s %s\n' "$1" "$2"; }

echo "=============================================="
echo " Spine inventory — $(pwd)"
echo " $(echo "$ALL" | grep -c .) source files scanned (vendored trees excluded)"
echo "=============================================="

section "0. Existing spines — candidates to ADOPT before building anything"
echo "  Detect by shape, not name. Confirm each by reading it."
# every directory prefix up to 5 levels deep that holds 3+ source files —
# spines usually sit below app/ or src/, not at the repository root
DIRS=$(echo "$SRC" | awk -F/ '{ p=""; for (i=1; i<NF && i<=5; i++) { p = (p=="" ? $i : p"/"$i); print p } }' | sort | uniq -c | awk '$1>=3{print $2}')
GENERIC=$(echo "$DIRS" | grep -Ei '(^|/)(core|platform|kernel|foundation|fabric|backbone|chassis|gateway|hub|shared|common|spine|spines|access|vault|ledger|dispatch|edge|mesh|bus)$' || true)
row "domain/generic layer dirs (review shape)" "$(echo "$GENERIC" | grep -c .)"
echo "$GENERIC" | head -8 | sed '/^$/d; s/^/      /'
row "docstrings claiming 'the only place'" "$(count 'the (only|one|single) (place|layer|implementation)|every external|single source of truth|one place')"
list 'the (only|one|single) (place|layer|implementation)|every external|single source of truth' 6
row "declared protocols / abstract interfaces" "$(count 'class [A-Za-z0-9_]+\((Protocol|ABC)\)|^export (interface|abstract class) ')"
row "registries (builder dicts / type enums)" "$(count '_(BUILDERS|REGISTRY|CATALOGUE|CATALOG)[[:space:]]*[:=]|^class [A-Za-z0-9_]*(Type|Kind)\((str, )?(Enum|StrEnum)\)')"
STRUCT=$(echo "$FILES" | grep -Ei '(uniformity|architecture|declarations|import_direction|layers?|boundar)[^/]*\.(py|ts|js)$' || true)
row "structural / declaration tests" "$(echo "$STRUCT" | grep -c .)"
echo "$STRUCT" | head -6 | sed '/^$/d; s/^/      /'
row "baseline / ratchet files" "$(echo "$FILES" | grep -Eci 'baseline[^/]*\.(txt|json|ya?ml)$')"
MAPS=$(echo "$FILES" | grep -Ei '(^|/)(CLAUDE|AGENTS)\.md$|(^|/)docs/spines\.md$' || true)
# agents also load instruction files ABOVE the repository root — check three levels up
UP="$(pwd)"
for _ in 1 2 3; do
  UP=$(dirname "$UP")
  for f in CLAUDE.md AGENTS.md; do [ -f "$UP/$f" ] && MAPS="$MAPS"$'\n'"$UP/$f"; done
done
MAPS=$(echo "$MAPS" | sed '/^$/d')
SPINEDOCS=$( [ -z "$MAPS" ] || echo "$MAPS" | tr '\n' '\0' | xargs -0 grep -liE 'spine|seam|layer map' 2>/dev/null )
row "CLAUDE.md/AGENTS.md mentioning spines (+3 parents)" "$(echo "$SPINEDOCS" | grep -c .)"
echo "$SPINEDOCS" | head -4 | sed '/^$/d; s/^/      /'
echo "      Read these first: they may name existing spines and the joints they own."

section "1. Authorization — how many sharing models?"
row "access/share/member tables" "$(_grep "$ALL" "-lIi" 'create table[^;]*(_access|_share|_member|_invite|_permission)|class +[A-Za-z]*(Access|Share|Member|Invite|Permission)\b' | sort -u | grep -c .)"
row "inline owner-equality checks" "$(count 'owner_id *[=!]=|user_id *[=!]= *(current_user|actor|request\.user)|created_by *[=!]= *(current_user|actor)')"
list 'owner_id *[=!]=|user_id *[=!]= *(current_user|actor|request\.user)'
row "403 responses (should usually be 404)" "$(count '[^0-9]403[^0-9]|Forbidden')"

section "2. Vocabulary — how many role and status scales?"
row "files with role string literals" "$(count "[\"'](owner|admin|editor|member|viewer|guest|reader|writer|contributor)[\"']")"
row "files with status literals" "$(count "[\"'](draft|active|archived|deleted|pending|processing|failed|completed)[\"']")"

section "3. Egress — how many ways out?"
row "HTTP clients constructed" "$(count 'requests\.(get|post|put|patch|delete)\(|httpx\.(Client|AsyncClient)|aiohttp\.ClientSession|new +HttpClient|axios\.create|http\.Client\{|OkHttpClient')"
row "mail/notification senders" "$(count 'smtplib|sendmail|sendgrid|mailgun|postmark|nodemailer|send_mail|sendEmail|EmailService|ses_client|SESClient|smtp_(host|server)')"
row "distinct timeout values" "$(hits 'timeout' | tr '\n' '\0' | xargs -0 grep -hoEi 'timeout[ =:]+[0-9]+' 2>/dev/null | grep -oE '[0-9]+' | sort -u | grep -c .)"
row "retry/backoff implementations" "$(count 'max_retries|retry_policy|backoff|tenacity|exponential_backoff|@retry')"

section "4. Vendors — SDKs outside an adapter layer"
VEND=$(echo "$SRC" | grep -Eiv '(^|/)(adapters?|integrations?|providers?|clients?|vendors?|gateway|fabric)/' || true)
vcount() { _grep "$VEND" "-lIi" "$1" | sort -u | grep -c . ; }
row "AI provider SDKs" "$(vcount '^(import|from) (anthropic|openai|litellm|google\.generativeai|dashscope)|require\(.(openai|@anthropic-ai)')"
row "cloud/storage SDKs" "$(vcount '^(import|from) (boto3|google\.cloud|azure\.storage)|@aws-sdk')"
row "payment SDKs" "$(vcount '^(import|from) (stripe|paddle|braintree)|require\(.stripe')"
row "queue/broker SDKs" "$(vcount '^(import|from) (kafka|pika|aio_pika|celery|nats)|kafkajs|amqplib|bullmq')"
row "vector store SDKs" "$(vcount '^(import|from) (qdrant_client|chromadb|pinecone|weaviate|pymilvus)')"

section "5. Configuration, environment and credentials"
ENVREAD='os\.getenv|os\.environ|getenv\(|process\.env\.|import\.meta\.env\.|System\.getenv'
LOADERS='(^|/)(config|settings|env|environment|conf)(\.[a-z]+$|/)'
READERS=$(hits "$ENVREAD" | grep -Evi "$LOADERS" || true)
row "files reading env outside a config loader" "$(echo "$READERS" | grep -c .)"
echo "$READERS" | head -6 | sed '/^$/d; s/^/      /'
ENVDIRS=$(find . -type f \( -name '.env' -o -name '.env.*' \) -not -path '*/.git/*' 2>/dev/null | sed 's|^\./||' | grep -Ev "$VENDORED" | grep -Evi '\.(example|sample|template|dist)$' | awk -F/ '{ if (NF==1) print "."; else { NF--; print } }' OFS=/ | sort -u)
row "directories holding a .env (want 1 per app)" "$(echo "$ENVDIRS" | grep -c .)"
echo "$ENVDIRS" | head -5 | sed '/^$/d; s/^/      /'
row "tracked .env files with real values" "$(echo "$FILES" | grep -E '(^|/)\.env($|\.)' | grep -Evic '\.(example|sample|template|dist)$')"
row "public-prefixed secret-like names" "$(_grep "$FILES" "-hoI" '(VITE|NEXT_PUBLIC|REACT_APP|EXPO_PUBLIC)_[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|PRIVATE|API_KEY)[A-Z0-9_]*' | sort -u | grep -c .)"
row "config objects printed or logged" "$(count 'print\((settings|config)[),]|logg?er\.[a-z]+\(.*(settings|config)\)')"

section "6. Model layer — routing and prompts"
row "hardcoded model ids" "$(count 'claude-[a-z0-9.-]+|gpt-[0-9a-z.-]+|gemini-[0-9a-z.-]+|qwen[0-9a-z.-]*|llama-?[0-9]')"
row "inline prompt strings" "$(count 'system_prompt *=|SYSTEM_PROMPT *=|"""You are |`You are ')"
row "token/cost accounting" "$(count 'usage\.(input|output)_tokens|prompt_tokens|cost_per|token_count')"

section "7. Async — events and jobs"
row "direct enqueue sites" "$(count '\.delay\(|apply_async\(|\.send_task\(|\.enqueue\(')"
row "direct broker publishes" "$(count 'producer\.send|basic_publish|\.publish_message|xadd\(')"
row "outbox pattern present" "$(count 'outbox')"

section "8. Data — tenancy and migrations"
row "files referencing tenant_id" "$(count 'tenant_id')"
row "raw SQL outside repositories" "$(count 'execute\( *f?["'\''`] *select|text\( *f["'\'']')"
row "migration files" "$(echo "$FILES" | grep -Eci '(migrations?|alembic)/.*\.(py|sql|ts|js)$')"

section "9. Enforcement — does anything defend this?"
WF=$(echo "$FILES" | grep -Ei '^\.github/workflows/.*\.ya?ml$|(^|/)\.gitlab-ci\.yml$|(^|/)Jenkinsfile$|(^|/)\.circleci/' || true)
row "CI config files" "$(echo "$WF" | grep -c .)"
row "CI files that run tests (Spine 0 gate)" "$( [ -z "$WF" ] && echo 0 || echo "$WF" | tr '\n' '\0' | xargs -0 grep -liE 'pytest|npm (run )?test|pnpm test|vitest|jest|go test|cargo test|rspec|gradle test' 2>/dev/null | grep -c . )"
row "uniformity/architecture tests" "$(echo "$STRUCT" | grep -c .)"
row "spine map (docs/spines.md)" "$(echo "$FILES" | grep -Eci '(^|/)docs/spines\.md$')"

cat <<'NOTE'

----------------------------------------------------------------
Greps, not proofs. Before reporting a number, open the files behind
it: counts go wrong by including vendored code, by matching one
syntax and missing another (an attribute named as a string), and by
overstating a risk another mechanism already prevents.

Section 0 comes first: if a spine already exists, extend it within
its boundary instead of building a parallel one. A zero in the
"runs tests" row means nothing is enforced yet (Spine 0).
----------------------------------------------------------------
NOTE
