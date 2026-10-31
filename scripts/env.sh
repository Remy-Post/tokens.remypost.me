# Shared settings for the tokens scripts. Override any of these from the environment.
TOKENS_HOST="${TOKENS_HOST:-ubuntu@40.233.100.237}"
TOKENS_KEY="${TOKENS_KEY:-$HOME/.ssh/oci_n8n}"
TOKENS_URL="${TOKENS_URL:-https://tokens.remy-post.duckdns.org}"
TOKENS_STATE_DIR="${TOKENS_STATE_DIR:-$HOME/.local/state/remypost-tokens}"
TOKENS_HOME="${TOKENS_HOME:-$HOME/.local/share/remypost-tokens}"
SSH=(ssh -i "$TOKENS_KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=20 "$TOKENS_HOST")
export TOKENS_STATE_DIR
