#!/usr/bin/env bash
# security-inventory.sh — security drift inventory for the spine-security skill.
#
# Counts how many places each security control is implemented, and where the
# common failure shapes appear. Prints counts and file:line locations only.
# It NEVER prints a matched secret value.
#
# These are greps, not proofs. Open the code behind a finding before reporting
# it, and prefer a real scanner (listed at the end) for secrets and CVEs.
#
# Usage:  ./security-inventory.sh [repo-root]     (default: current directory)
# Needs:  bash, grep, awk; git if available. No other dependencies.

set -uo pipefail
ROOT="${1:-.}"
cd "$ROOT" || exit 1

VENDORED='(^|/)(node_modules|venv|\.venv|env|site-packages|vendor|dist|build|\.next|__pycache__|third_party|coverage|\.tox)/'
IN_GIT=0
if git rev-parse --git-dir >/dev/null 2>&1; then
  IN_GIT=1; FILES=$(git ls-files | grep -Ev "$VENDORED" || true)
else
  FILES=$(find . -type f -not -path '*/.git/*' | sed 's|^\./||' | grep -Ev "$VENDORED" || true)
fi
CODE=$(echo "$FILES" | grep -Ei '\.(py|ts|tsx|js|jsx|mjs|cjs|go|rb|java|kt|cs|php|rs|vue|svelte|html|jinja2?|j2)$' || true)
SRC=$(echo "$CODE" | grep -Eiv '(^|/)(tests?|__tests__|spec|specs|fixtures|migrations)/|(_test|\.test|\.spec)\.' || true)
CFG=$(echo "$FILES" | grep -Ei '(^|/)((docker-)?compose[^/]*\.ya?ml|Dockerfile[^/]*|[^/]+\.tf|\.gitlab-ci\.yml|nginx[^/]*\.conf)$|^\.github/workflows/[^/]+\.ya?ml$|(^|/)(k8s|helm|charts|deploy)/.+\.ya?ml$' || true)
WF=$(echo "$FILES" | grep -Ei '^\.github/workflows/.+\.ya?ml$|(^|/)\.gitlab-ci\.yml$|(^|/)Jenkinsfile$|(^|/)\.circleci/config\.yml$' || true)

_grep()  { [ -z "$1" ] && return 0; echo "$1" | tr '\n' '\0' | xargs -0 grep -H $2 -E "$3" 2>/dev/null; }
nfiles() { _grep "$1" "-lI${3:-}" "$2" | sort -u | grep -c . ; }
nlines() { _grep "$1" "-nI${3:-}" "$2" | grep -c . ; }
# locations only — the matched text is never printed
locs()   { _grep "$1" "-nI${4:-}" "$2" | cut -d: -f1,2 | head -"${3:-5}" | sed 's/^/      /'; }
flist()  { _grep "$1" "-lI${4:-}" "$2" | sort -u | head -"${3:-5}" | sed 's/^/      /'; }

section() { printf '\n\033[1m%s\033[0m\n' "$1"; }
row()     { printf '  %-50s %s\n' "$1" "$2"; }

echo "======================================================"
echo " Security inventory — $(pwd)"
echo " $(echo "$SRC" | grep -c .) source files, $(echo "$CFG" | grep -c .) deploy/CI config files"
echo " Locations only. No matched secret value is ever printed."
echo "======================================================"

# ---------------------------------------------------------------------------
section "V18 SUPPLY-1 — is there a gate?"
row "CI config files" "$(echo "$WF" | grep -c .)"
row "CI files that run tests" "$(nfiles "$WF" 'pytest|npm (run )?test|pnpm (run )?test|yarn test|vitest|jest|go test|cargo test|rspec|gradle(w)? test|mvn (-[^ ]+ )*test')"
echo "      (0 means every enforcement test is advisory)"

# ---------------------------------------------------------------------------
section "V4 SECRETS — credentials, secrets and environment"
TRACKED_ENV=$(echo "$FILES" | grep -E '(^|/)\.env($|\.)|[^/]+\.env$' | grep -Evi '\.(example|sample|template|dist|defaults)$' || true)
row "tracked .env files (real values?)" "$(echo "$TRACKED_ENV" | grep -c .)"
echo "$TRACKED_ENV" | head -5 | sed '/^$/d; s/^/      /'
if [ "$IN_GIT" = 1 ]; then
  HIST=$(git log --all --diff-filter=A --name-only --format= 2>/dev/null | grep -E '(^|/)\.env($|\.)|[^/]+\.env$' | grep -Evi 'example|sample|template|dist' | sort -u)
  row ".env files ever committed (history)" "$(echo "$HIST" | grep -c .)"
  echo "$HIST" | head -5 | sed '/^$/d; s/^/      /'
fi
ENVDIRS=$(find . -type f \( -name '.env' -o -name '.env.*' \) -not -path '*/.git/*' 2>/dev/null | sed 's|^\./||' | grep -Ev "$VENDORED" | grep -Evi '\.(example|sample|template|dist)$' | awk -F/ '{ if (NF==1) print "."; else { NF--; print } }' OFS=/ | sort -u)
row "directories holding a .env (want 1 per app)" "$(echo "$ENVDIRS" | grep -c .)"
echo "$ENVDIRS" | head -5 | sed '/^$/d; s/^/      /'
READERS=$(_grep "$SRC" "-lI" 'os\.getenv|os\.environ|getenv\(|process\.env\.|import\.meta\.env\.|System\.getenv' | grep -Evi '(^|/)(config|settings|env|environment|conf)(\.[a-z]+$|/)' | sort -u)
row "files reading env outside a config loader" "$(echo "$READERS" | grep -c .)"
echo "$READERS" | head -5 | sed '/^$/d; s/^/      /'
PUBNAMES=$(_grep "$FILES" "-hoI" '(VITE|NEXT_PUBLIC|REACT_APP|EXPO_PUBLIC|NUXT_PUBLIC)_[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|PRIVATE|API_KEY|ACCESS_KEY)[A-Z0-9_]*' | sort -u)
row "public-prefixed secret-like variable NAMES" "$(echo "$PUBNAMES" | grep -c .)"
echo "$PUBNAMES" | head -5 | sed '/^$/d; s/^/      /'
CREDPAT='AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|sk-(proj-|ant-)?[A-Za-z0-9_-]{32,}|sk_live_[0-9A-Za-z]{20,}|ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40,}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|-----BEGIN ([A-Z]+ )?PRIVATE KEY-----'
row "credential-shaped literals in tracked files" "$(nlines "$FILES" "$CREDPAT")"
locs "$FILES" "$CREDPAT" 8
INLINE='(PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE_KEY|ACCESS_KEY)[A-Z0-9_]*["'\'']?[[:space:]]*[:=][[:space:]]*["'\'']?[A-Za-z0-9/+_.@-]{8,}'
row "inline secrets in compose/CI/Docker/IaC" "$(nlines "$CFG" "$INLINE")"
locs "$CFG" "$INLINE" 6
row "Dockerfile ARG/ENV carrying secret names" "$(nlines "$CFG" '^(ARG|ENV)[[:space:]]+[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE)')"
row "settings/config objects printed or logged" "$(nlines "$SRC" 'print\((settings|config)[),]|logg?er\.[a-z]+\(.*(settings|config)\)|console\.log\(.*(process\.env|config)\)')"
row "secret-typed config fields (SecretStr etc.)" "$(nfiles "$SRC" 'SecretStr|SecretBytes|secret_field|Sensitive<|redact')"

# ---------------------------------------------------------------------------
section "V1/V2 AUTHN & SESS — authentication, sessions, tokens"
row "token decode/verify sites (want 1)" "$(nlines "$SRC" 'jwt\.decode\(|jwt\.verify\(|jose\.jwt\.decode\(|jwtVerify\(|decode_token\(')"
NOALG=$(_grep "$SRC" "-nI" 'jwt\.decode\(' | grep -v 'algorithms' | cut -d: -f1,2)
row "jwt.decode without algorithms on the same line" "$(echo "$NOALG" | grep -c .)"
echo "$NOALG" | head -4 | sed '/^$/d; s/^/      /'
row "signature/expiry verification disabled" "$(nlines "$SRC" 'verify_signature["'\'']?[[:space:]]*:[[:space:]]*False|verify_exp["'\'']?[[:space:]]*:[[:space:]]*False|ignoreExpiration:[[:space:]]*true|algorithms=\[["'\'']none')"
locs "$SRC" 'verify_signature["'\'']?[[:space:]]*:[[:space:]]*False|verify_exp["'\'']?[[:space:]]*:[[:space:]]*False|ignoreExpiration:[[:space:]]*true' 4
row "adaptive KDF in use (argon2/bcrypt/scrypt)" "$(nfiles "$SRC" 'argon2|bcrypt|scrypt|pbkdf2' i)"
WEAK=0; WEAKF=""
while IFS= read -r f; do [ -z "$f" ] && continue; if grep -qi 'password' "$f" 2>/dev/null; then WEAK=$((WEAK+1)); WEAKF="$WEAKF$f\n"; fi; done <<< "$(_grep "$SRC" "-lI" 'hashlib\.(md5|sha1|sha256)\(|createHash\(["'\''](md5|sha1)')"
row "fast hashes in files that handle passwords" "$WEAK"
printf '%b' "$WEAKF" | head -4 | sed '/^$/d; s/^/      /'
row "== on token/signature/key values (review)" "$(nlines "$SRC" '(token|signature|api_key|secret|digest|otp|verifier|hmac)[A-Za-z_]*[[:space:]]*(==|!=)[[:space:]]*[A-Za-z_]' i)"
locs "$SRC" '(token|signature|api_key|secret|digest|otp|verifier|hmac)[A-Za-z_]*[[:space:]]*(==|!=)[[:space:]]*[A-Za-z_]' 4 i
row "constant-time compares present" "$(nfiles "$SRC" 'compare_digest|timingSafeEqual|ConstantTimeCompare|secure_compare')"
RAND=0
while IFS= read -r f; do [ -z "$f" ] && continue; grep -qiE 'token|otp|nonce|secret|password|reset|invite|verif' "$f" 2>/dev/null && RAND=$((RAND+1)); done <<< "$(_grep "$SRC" "-lI" 'random\.(random|randint|choice|choices|getrandbits)\(|Math\.random\(')"
row "non-CSPRNG random in token-handling files" "$RAND"
row "basic auth / credentials read from env" "$(nlines "$SRC" '(ADMIN|SUPERADMIN|BASIC)_(USER|USERNAME|PASSWORD)|HTTPBasic\(')"

# ---------------------------------------------------------------------------
section "V3 AUTHZ — authorization and tenant isolation"
row "inline ownership predicates in code" "$(nlines "$SRC" 'owner_id[[:space:]]*[=!]=|user_id[[:space:]]*[=!]=[[:space:]]*(current_user|actor|request\.user|user)\.|created_by[[:space:]]*[=!]=')"
MODELS=$(nlines "$SRC" 'class [A-Za-z0-9_]+\((BaseModel|Schema)\)')
FORBID=$(nlines "$SRC" "extra[[:space:]]*=[[:space:]]*['\"]forbid|Extra\.forbid|\.strict\(\)")
row "schema classes / with extra=forbid or .strict()" "$MODELS / $FORBID"
row "403 responses (existence leak where not public)" "$(nlines "$SRC" 'status_code[[:space:]]*=[[:space:]]*403|HTTP_403|status\(403\)|Forbidden\(')"

# ---------------------------------------------------------------------------
section "EXPOSURE — routes, public edges and credentials in responses"
ROUTEPAT='@(app|router|[a-z_]+_router|api|bp|blueprint)\.(get|post|put|patch|delete|api_route|route)\(|(app|router)\.(get|post|put|patch|delete)\(["'\''`]/'
row "route declarations" "$(nlines "$SRC" "$ROUTEPAT")"
row "auth dependency / guard references" "$(nlines "$SRC" 'Depends\([a-z_]*(current_user|auth|require|verify|admin|principal|token|service)[a-z_]*|@(login_required|requires_auth|jwt_required|permission_required|UseGuards)|authMiddleware|requireAuth|isAuthenticated')"
echo "      For the real list, enumerate the framework's route table and name every"
echo "      route with no auth dependency. A client sending a token proves nothing."
DECRYPT=$(_grep "$SRC" "-lI" "$ROUTEPAT" | tr '\n' '\0' | xargs -0 grep -lIE 'decrypt\(|get_secret_value\(\)|\.reveal\(|resolve_credential|decrypted' 2>/dev/null | sort -u)
row "route files that decrypt/reveal secrets (review)" "$(echo "$DECRYPT" | grep -c .)"
echo "$DECRYPT" | head -5 | sed '/^$/d; s/^/      /'
TENPATH='["'\''`][^"'\''`]*/tenants?/\{|tenant_id:[[:space:]]*(int|str|UUID)[[:space:]]*=[[:space:]]*(Path|Query)|params\.tenant(_id|Id)|query\.tenant(_id|Id)'
row "tenant id taken from the path or query" "$(nlines "$SRC" "$TENPATH")"
locs "$SRC" "$TENPATH" 4
EDGEF=$( { echo "$FILES" | grep -Ei '(^|/)(cloudflared|tunnel)[^/]*\.(ya?ml|json)$|(^|/)ngrok[^/]*\.ya?ml$|(^|/)(ingress|traefik)[^/]*\.(ya?ml|toml)$|(^|/)Caddyfile$'; _grep "$FILES" "-lI" '^[[:space:]]*ingress:|cloudflared|tunnel run|ngrok (http|start)|kind:[[:space:]]*Ingress'; } | sort -u)
row "tunnel / ingress definitions (check path limits)" "$(echo "$EDGEF" | grep -c .)"
echo "$EDGEF" | head -5 | sed '/^$/d; s/^/      /'
echo "      A tunnel usually exposes a whole origin. Network segmentation is not auth."
row "'internal only' claims in code/docs (verify!)" "$(nlines "$FILES" '(internal|private)[ -](only|network)|only reachable (from|inside)|not exposed (publicly|to the internet)|protected by (the )?(docker )?network' i)"
row "integration destination fields (review writers)" "$(nlines "$SRC" '(base_url|endpoint_url|webhook_url|server_url|callback_url|redirect_uri)[[:space:]]*[:=]')"

# ---------------------------------------------------------------------------
section "V5/V6 INPUT & OUTPUT — injection, sinks, disclosure"
SINK_SHELL='shell[[:space:]]*=[[:space:]]*True|os\.system\(|os\.popen\(|child_process\.exec\(|execSync\('
SINK_DESER='pickle\.loads?\(|marshal\.loads\(|jsonpickle|node-serialize'
SINK_EVAL='(^|[^.A-Za-z0-9_])eval\(|new Function\(|exec\([^)]*request'
SINK_SQL='(execute|text|raw|query)\([[:space:]]*f["'\'']|(execute|query)\([^)]*%[[:space:]]*\(|(execute|query)\([^)]*\.format\(|query\(`[^`]*\$\{'
SINK_TPL='render_template_string\(|Template\([^)]*(request|body|input)'
SINK_HTML='dangerouslySetInnerHTML|v-html|\.innerHTML[[:space:]]*=|\|[[:space:]]*safe[[:space:]]*}}|mark_safe\(|\{\{\{'
row "shell execution sinks" "$(nlines "$SRC" "$SINK_SHELL")";   locs "$SRC" "$SINK_SHELL" 3
row "unsafe deserialisation" "$(nlines "$SRC" "$SINK_DESER")";  locs "$SRC" "$SINK_DESER" 3
YAML=$(_grep "$SRC" "-nI" 'yaml\.load\(' | grep -Ev 'SafeLoader|safe_load' | cut -d: -f1,2)
row "yaml.load without a safe loader" "$(echo "$YAML" | grep -c .)"; echo "$YAML" | head -3 | sed '/^$/d; s/^/      /'
row "eval / dynamic code" "$(nlines "$SRC" "$SINK_EVAL")";      locs "$SRC" "$SINK_EVAL" 3
row "string-built SQL" "$(nlines "$SRC" "$SINK_SQL")";          locs "$SRC" "$SINK_SQL" 4
row "user content as template" "$(nlines "$SRC" "$SINK_TPL")"
row "raw-HTML render sinks" "$(nlines "$SRC" "$SINK_HTML")";    locs "$SRC" "$SINK_HTML" 4
row "exception text returned to clients" "$(nlines "$SRC" 'detail[[:space:]]*=[[:space:]]*str\((e|exc|err|ex|error)\)|traceback\.format_exc\(\)|res\.(send|json)\(.*(err|error)\.stack')"
locs "$SRC" 'detail[[:space:]]*=[[:space:]]*str\((e|exc|err|ex|error)\)|traceback\.format_exc\(\)' 4
row "debug enabled in code/config" "$(nlines "$FILES" '(^|[^A-Za-z_])debug[[:space:]]*=[[:space:]]*True|DEBUG[[:space:]]*[:=][[:space:]]*["'\'']?(True|true|1)["'\'']?[[:space:]]*$|app\.run\(.*debug=True')"

# ---------------------------------------------------------------------------
section "V7 ABUSE — rate limiting and resource consumption"
MECH=0
for m in 'slowapi' 'flask_limiter|flask-limiter' 'fastapi_limiter|fastapi-limiter' 'express-rate-limit' 'rate-limiter-flexible' 'django_ratelimit|django-ratelimit' 'ThrottlingMiddleware|@throttle|throttle_classes' '@nestjs/throttler' 'class [A-Za-z]*RateLimit|def rate_limit|function rateLimit'; do
  n=$(nfiles "$SRC" "$m"); [ "$n" -gt 0 ] && { MECH=$((MECH+1)); printf '      %-40s %s files\n' "$(echo "$m" | cut -d'|' -f1)" "$n"; }
done
row "distinct limiter mechanisms (want 1)" "$MECH"
row "inline limit literals (\"5/minute\")" "$(nlines "$SRC" "[\"'][0-9]+ ?(/|per )(second|minute|hour|day)[\"']")"
row "in-memory limiter storage" "$(nlines "$FILES" 'memory://|MemoryStore\(|storage_uri[[:space:]]*=[[:space:]]*None')"
row "files reading X-Forwarded-For directly" "$(nfiles "$SRC" 'x-forwarded-for|x_forwarded_for' i)"
row "trusted proxy configuration present" "$(nfiles "$FILES" 'trusted_hosts|TRUSTED_PROXIES|trust proxy|ProxyHeadersMiddleware|forwarded_allow_ips|set_real_ip_from')"
row "body/upload size limits configured" "$(nfiles "$FILES" 'client_max_body_size|MAX_CONTENT_LENGTH|max_upload_size|bodyParser.*limit|max_request_body|MAX_UPLOAD')"

# ---------------------------------------------------------------------------
section "V8 EDGE — middleware, headers, CORS, CSRF, hosts"
row "CORS configuration sites (want 1)" "$(nfiles "$FILES" 'CORSMiddleware|flask_cors|CORS\(|cors\(\{|add_header[[:space:]]+Access-Control-Allow-Origin|Access-Control-Allow-Origin')"
WILD='allow_origins[[:space:]]*=[[:space:]]*\[[[:space:]]*["'\'']\*|origin:[[:space:]]*["'\'']\*["'\'']|Access-Control-Allow-Origin["'\'']?[[:space:]]*[:,]?[[:space:]]*["'\'']\*'
row "wildcard CORS origins" "$(nlines "$FILES" "$WILD")"; locs "$FILES" "$WILD" 3
row "credentials enabled on CORS" "$(nlines "$FILES" 'allow_credentials[[:space:]]*=[[:space:]]*True|credentials:[[:space:]]*true|Access-Control-Allow-Credentials')"
for h in 'Strict-Transport-Security' 'Content-Security-Policy' 'X-Content-Type-Options' 'X-Frame-Options|frame-ancestors' 'Referrer-Policy'; do
  row "files setting $(echo "$h" | cut -d'|' -f1) (want 1)" "$(nfiles "$FILES" "$h" i)"
done
row "CSRF protection present" "$(nfiles "$SRC" 'csrf|xsrf' i)"
row "URLs built from the request Host" "$(nlines "$SRC" 'request\.(host|base_url|url_root|host_url)|req\.(get\(["'\'']host|hostname)|headers\[["'\'']host["'\'']\]' i)"
row "cookies set without httponly/secure (review)" "$(_grep "$SRC" "-nI" 'set_cookie\(|res\.cookie\(|setCookie\(' | grep -viE 'httponly|secure' | grep -c .)"

# ---------------------------------------------------------------------------
section "V9 CRYPTO"
row "weak hash functions (md5/sha1)" "$(nlines "$SRC" 'hashlib\.(md5|sha1)\(|createHash\(["'\''](md5|sha1)|MD5\.|SHA1\.')"
row "ECB mode / DES / RC4" "$(nlines "$SRC" 'MODE_ECB|AES/ECB|DES\.new|\bRC4\b|createCipher\(')"
row "encryption helper implementations (want 1)" "$(nfiles "$SRC" 'Fernet\(|AESGCM\(|createCipheriv\(|nacl\.secret|ChaCha20Poly1305\(')"
row "key rotation support (MultiFernet/keyring)" "$(nfiles "$SRC" 'MultiFernet|key_id|kid|keyring' i)"

# ---------------------------------------------------------------------------
section "V10 EGRESS — outbound requests and SSRF"
row "HTTP client construction sites" "$(nfiles "$SRC" 'httpx\.(Client|AsyncClient)\(|aiohttp\.ClientSession\(|requests\.Session\(|axios\.create\(|new HttpClient|http\.Client\{|OkHttpClient')"
row "one-off requests.* / fetch calls" "$(nlines "$SRC" 'requests\.(get|post|put|patch|delete)\(|httpx\.(get|post|put|patch|delete)\(|[^A-Za-z]fetch\(')"
TLSOFF='verify[[:space:]]*=[[:space:]]*False|rejectUnauthorized:[[:space:]]*false|InsecureSkipVerify:[[:space:]]*true|_create_unverified_context|CERT_NONE|NODE_TLS_REJECT_UNAUTHORIZED'
row "TLS verification disabled" "$(nlines "$FILES" "$TLSOFF")"; locs "$FILES" "$TLSOFF" 4
row "redirects followed (review for user URLs)" "$(nlines "$SRC" 'follow_redirects[[:space:]]*=[[:space:]]*True|allow_redirects[[:space:]]*=[[:space:]]*True|maxRedirects')"
row "SSRF guard present (private range checks)" "$(nfiles "$SRC" 'is_private|is_loopback|is_link_local|169\.254\.169\.254|ipaddress\.ip_address|ssrf' i)"

# ---------------------------------------------------------------------------
section "V11/V12/V13 FILES, HOOKS, QUEUE"
row "upload handlers" "$(nfiles "$SRC" 'UploadFile|multer|FileStorage|request\.files|multipart' i)"
row "content-type sniffing (magic) present" "$(nfiles "$SRC" 'python-magic|import magic|filetype\.guess|file-type|mimetypes\.guess' i)"
row "public bucket / ACL settings" "$(nlines "$FILES" 'public-read|ACL[[:space:]]*[:=][[:space:]]*["'\'']public|block_public_acls[[:space:]]*=[[:space:]]*false|allUsers')"
row "webhook receivers" "$(nfiles "$SRC" 'webhook' i)"
row "webhook signature verification present" "$(nfiles "$SRC" 'hmac\.new|createHmac|construct_event|verify_signature|X-Hub-Signature|Stripe-Signature|svix' i)"
row "pickle task serialisation" "$(nlines "$FILES" 'accept_content.*pickle|task_serializer[[:space:]]*=[[:space:]]*["'\'']pickle|result_serializer[[:space:]]*=[[:space:]]*["'\'']pickle')"
row "enqueue sites (want 1 seam)" "$(nlines "$SRC" '\.delay\(|\.apply_async\(|\.send_task\(|queue\.add\(|\.enqueue\(')"
row "broker URLs without credentials (review)" "$(nlines "$FILES" '(redis|amqp|rediss)://(localhost|127\.0\.0\.1|[a-z0-9_-]+)(:[0-9]+)?(/[0-9]*)?["'\''[:space:]]|amqp://guest:guest')"

# ---------------------------------------------------------------------------
section "V15/V16 AI & MCP"
row "model call sites" "$(nlines "$SRC" 'chat\.completions\.create|messages\.create\(|acompletion\(|completion\(|generate_content\(|\.invoke\(')"
row "model output rendered as raw HTML (review)" "$(_grep "$SRC" "-lI" 'dangerouslySetInnerHTML|v-html|innerHTML' | tr '\n' '\0' | xargs -0 grep -liE 'markdown|completion|assistant|llm|message' 2>/dev/null | grep -c .)"
row "tool definitions" "$(nfiles "$SRC" '@tool|@mcp\.tool|tools=\[|"input_schema"|inputSchema|FunctionTool' i)"
row "approval / human-in-the-loop gates" "$(nfiles "$SRC" 'requires_approval|awaiting_approval|human_in_the_loop|confirm_before|side_effect' i)"
row "MCP server/auth code" "$(nfiles "$SRC" 'mcp|oauth-protected-resource|resource_indicator|audience' i)"

# ---------------------------------------------------------------------------
section "V18 SUPPLY — dependencies, images, CI"
for lf in poetry.lock Pipfile.lock uv.lock package-lock.json pnpm-lock.yaml yarn.lock go.sum Cargo.lock Gemfile.lock composer.lock; do
  n=$(echo "$FILES" | grep -Ec "(^|/)$lf$"); [ "$n" -gt 0 ] && printf '      %-28s %s\n' "$lf" "$n"
done
REQ=$(echo "$FILES" | grep -Ei '(^|/)requirements[^/]*\.txt$' || true)
row "unpinned lines in requirements*.txt" "$( [ -z "$REQ" ] && echo 0 || echo "$REQ" | tr '\n' '\0' | xargs -0 grep -hvE '^[[:space:]]*(#|-|$)|==|@ ' 2>/dev/null | grep -c . )"
DF=$(echo "$FILES" | grep -Ei '(^|/)Dockerfile[^/]*$' || true)
NOUSER=0; while IFS= read -r f; do [ -z "$f" ] && continue; grep -qE '^USER[[:space:]]' "$f" 2>/dev/null || NOUSER=$((NOUSER+1)); done <<< "$DF"
row "Dockerfiles with no USER (run as root)" "$NOUSER / $(echo "$DF" | grep -c .)"
row "base images not pinned by digest" "$(_grep "$DF" "-hI" '^FROM[[:space:]]' | grep -vc '@sha256:')"
row "CI actions not pinned to a commit SHA" "$(_grep "$WF" "-hI" 'uses:[[:space:]]*[^.[:space:]][^@[:space:]]*@' | grep -vEc '@[0-9a-f]{40}')"
row "dependency scanning in CI" "$(nfiles "$WF" 'pip-audit|npm audit|pnpm audit|osv-scanner|trivy|snyk|dependabot|safety check|grype')"
row "secret scanning in CI / pre-commit" "$(nfiles "$FILES" 'gitleaks|trufflehog|detect-secrets|ggshield')"

# ---------------------------------------------------------------------------
section "V19 DEPLOY — hardening and exposure"
row "API docs endpoints configured" "$(nfiles "$SRC" 'docs_url|openapi_url|redoc_url|swagger-ui|SwaggerModule|/api-docs')"
row "docs explicitly disabled somewhere" "$(nlines "$SRC" 'docs_url[[:space:]]*=[[:space:]]*None|openapi_url[[:space:]]*=[[:space:]]*None')"
PORTS=$(_grep "$CFG" "-nI" '^[[:space:]]*-[[:space:]]*["'\'']?([0-9.]+:)?[0-9]+:(5432|3306|6379|27017|5672|15672|5555|9200|11211|2379)["'\'']?[[:space:]]*$' | grep -v '127\.0\.0\.1' | cut -d: -f1,2)
row "data/broker/dashboard ports published (not 127.0.0.1)" "$(echo "$PORTS" | grep -c .)"
echo "$PORTS" | head -5 | sed '/^$/d; s/^/      /'
row "security.txt present" "$(echo "$FILES" | grep -Ec '(^|/)security\.txt$')"

# ---------------------------------------------------------------------------
section "Scanners available on this machine"
for t in gitleaks trufflehog semgrep pip-audit osv-scanner trivy npm; do
  if command -v "$t" >/dev/null 2>&1; then
    case "$t" in
      gitleaks)    hint="gitleaks detect --redact -v            (tree + history)";;
      trufflehog)  hint="trufflehog git file://. --only-verified";;
      semgrep)     hint="semgrep --config p/owasp-top-ten --config p/secrets";;
      pip-audit)   hint="pip-audit -r requirements.txt";;
      osv-scanner) hint="osv-scanner -r .";;
      trivy)       hint="trivy fs --scanners vuln,secret,misconfig .";;
      npm)         hint="npm audit --omit=dev   (in each package dir)";;
    esac
    printf '  %-12s %s\n' "$t" "$hint"
  fi
done

cat <<'NOTE'

------------------------------------------------------------------
Signals, not proofs. For every high or critical finding, open the
code and confirm it — and prove it with a local test where safe.
Never probe production or third-party systems without permission.

"want 1" rows are the chokepoint question: more than one means the
control is scattered, and zero often means the chokepoint (a joint
of the main spine) does not exist yet.

Network segmentation is not authentication: verify internal-only
paths from the public edge, with requests that cannot return real
data (non-existent ids, nonsense parameters), and never write routes.

Never paste a secret value into a report, register or chat. Refer
to file:line and the type of credential.
------------------------------------------------------------------
NOTE
