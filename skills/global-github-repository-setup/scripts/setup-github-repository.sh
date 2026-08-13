#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly ASSETS_DIR="$SKILL_DIR/assets"

REPOSITORY=""
MODE=""
PRESERVE_ADDED_LABELS=true
DRY_RUN=false
ASSUME_YES=false

trap 'unset GITHUB_ACCESS_TOKEN' EXIT

usage() {
  cat <<'EOF'
Usage: setup-github-repository.sh [options]

Configure the current GitHub repository with standard labels and issue-branch
automation. The script never writes a token to disk or to Git.

Options:
  --repo OWNER/REPO        Use this repository instead of detecting origin.
  --mode auto|chatops      Use auto by default; choose chatops for /cib comments.
  --replace-labels         Remove existing labels that are not in labels.json.
  --dry-run                Preview file and label changes without writing them.
  --yes                    Accept prompts. Use only after reviewing the defaults.
  -h, --help               Show this help.
EOF
}

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

confirm() {
  local prompt="$1"
  local answer

  if [[ "$ASSUME_YES" == true ]]; then
    return 0
  fi

  read -r -p "$prompt [y/N] " answer
  [[ "$answer" == "y" || "$answer" == "Y" || "$answer" == "yes" || "$answer" == "YES" ]]
}

select_mode() {
  local answer

  if [[ -n "$MODE" ]]; then
    return
  fi

  if [[ "$ASSUME_YES" == true ]]; then
    MODE="auto"
    return
  fi

  printf '\n브랜치 생성 방식:\n'
  printf '  1) auto    — 이슈 담당자 지정 시 자동 생성 (기본값)\n'
  printf '  2) chatops — 필요할 때만: 이슈 댓글의 /cib 명령으로 생성\n'
  read -r -p '선택 [1/2, 기본값 1]: ' answer

  case "$answer" in
    ""|1) MODE="auto" ;;
    2) MODE="chatops" ;;
    *) die "1 또는 2를 입력하세요." ;;
  esac
}

select_label_policy() {
  local answer

  if [[ "$PRESERVE_ADDED_LABELS" == false || "$ASSUME_YES" == true ]]; then
    return
  fi

  read -r -p 'labels.json에 없는 기존 레이블을 유지할까요? [Y/n] ' answer
  case "$answer" in
    ""|y|Y|yes|YES) PRESERVE_ADDED_LABELS=true ;;
    n|N|no|NO) PRESERVE_ADDED_LABELS=false ;;
    *) die "Y 또는 n을 입력하세요." ;;
  esac
}

show_diff() {
  local source="$1"
  local destination="$2"

  printf '\n--- %s\n' "$destination"
  if [[ -e "$destination" ]]; then
    diff -u "$destination" "$source" || true
  else
    diff -u /dev/null "$source" || true
  fi
}

copy_asset() {
  local source="$1"
  local destination="$2"

  mkdir -p "$(dirname "$destination")"
  cp "$source" "$destination"
}

resolve_repository() {
  if [[ -n "$REPOSITORY" ]]; then
    return
  fi

  command_exists gh || die "GitHub CLI(gh)가 필요합니다. --repo OWNER/REPO를 지정하거나 gh를 설치하세요."
  REPOSITORY="$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null || true)"
  [[ -n "$REPOSITORY" ]] || die "현재 저장소를 감지하지 못했습니다. --repo OWNER/REPO를 지정하세요."
}

resolve_token() {
  if [[ -n "${GITHUB_ACCESS_TOKEN:-}" ]]; then
    return
  fi

  if [[ -n "${PERSONAL_ACCESS_TOKEN:-}" ]]; then
    export GITHUB_ACCESS_TOKEN="$PERSONAL_ACCESS_TOKEN"
    return
  fi

  if command_exists gh && gh auth token >/dev/null 2>&1; then
    export GITHUB_ACCESS_TOKEN="$(gh auth token)"
    return
  fi

  [[ -t 0 ]] || die "GitHub 인증을 찾지 못했습니다. gh auth login을 실행하거나 터미널에서 PERSONAL_ACCESS_TOKEN을 export한 뒤 다시 실행하세요."

  read -r -s -p 'GitHub token (입력 내용은 표시되지 않음): ' GITHUB_ACCESS_TOKEN
  printf '\n'
  [[ -n "$GITHUB_ACCESS_TOKEN" ]] || die "토큰이 비어 있습니다."
  export GITHUB_ACCESS_TOKEN
}

run_label_sync() {
  local labels_path="$1"
  local use_dry_run="${2:-false}"
  local -a command=(npx --yes github-label-sync --labels "$labels_path")

  if [[ "$PRESERVE_ADDED_LABELS" == true ]]; then
    command+=(--allow-added-labels)
  fi

  if [[ "$use_dry_run" == true ]]; then
    command+=(--dry-run)
  fi

  command+=("$REPOSITORY")
  "${command[@]}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      [[ $# -ge 2 ]] || die "--repo에는 OWNER/REPO 값이 필요합니다."
      REPOSITORY="$2"
      shift 2
      ;;
    --mode)
      [[ $# -ge 2 ]] || die "--mode에는 auto 또는 chatops 값이 필요합니다."
      MODE="$2"
      shift 2
      ;;
    --replace-labels)
      PRESERVE_ADDED_LABELS=false
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --yes)
      ASSUME_YES=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "알 수 없는 옵션: $1"
      ;;
  esac
done

case "$MODE" in
  ""|auto|chatops) ;;
  *) die "--mode에는 auto 또는 chatops만 사용할 수 있습니다." ;;
esac

command_exists git || die "git이 필요합니다."
command_exists npx || die "npx가 필요합니다. Node.js를 설치한 뒤 다시 실행하세요."

REPOSITORY_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$REPOSITORY_ROOT" ]] || die "Git 저장소 안에서 실행하세요."
cd "$REPOSITORY_ROOT"

resolve_repository
select_mode
select_label_policy

readonly LABELS_SOURCE="$ASSETS_DIR/labels.json"
readonly ISSUE_BRANCH_SOURCE="$ASSETS_DIR/issue-branch-${MODE}.yml"
readonly WORKFLOW_SOURCE="$ASSETS_DIR/issue-auto-branch-${MODE}.yml"
readonly LABELS_DESTINATION=".github/labels.json"
readonly ISSUE_BRANCH_DESTINATION=".github/issue-branch.yml"
readonly WORKFLOW_DESTINATION=".github/workflows/issue-auto-branch.yml"

printf '대상 저장소: %s\n' "$REPOSITORY"
printf '브랜치 생성 방식: %s\n' "$MODE"
if [[ "$PRESERVE_ADDED_LABELS" == true ]]; then
  printf '레이블 정책: 기존 커스텀 레이블 유지\n'
else
  printf '레이블 정책: labels.json에 없는 기존 레이블 삭제\n'
fi

show_diff "$LABELS_SOURCE" "$LABELS_DESTINATION"
show_diff "$ISSUE_BRANCH_SOURCE" "$ISSUE_BRANCH_DESTINATION"
show_diff "$WORKFLOW_SOURCE" "$WORKFLOW_DESTINATION"

if [[ "$DRY_RUN" == true ]]; then
  printf '\nDry-run: 파일을 쓰지 않고 레이블 변경만 미리 확인합니다.\n'
  resolve_token
  run_label_sync "$LABELS_SOURCE" true
  exit 0
fi

confirm '위 설정 파일을 작성하거나 갱신할까요?' || {
  printf '취소했습니다.\n'
  exit 0
}

copy_asset "$LABELS_SOURCE" "$LABELS_DESTINATION"
copy_asset "$ISSUE_BRANCH_SOURCE" "$ISSUE_BRANCH_DESTINATION"
copy_asset "$WORKFLOW_SOURCE" "$WORKFLOW_DESTINATION"

printf '\n레이블 변경을 미리 확인합니다.\n'
resolve_token
run_label_sync "$LABELS_DESTINATION" true

confirm '위 레이블 변경을 GitHub에 반영할까요?' || {
  printf '레이블 반영은 취소했습니다. 설정 파일은 로컬에 작성되어 있습니다.\n'
  exit 0
}

run_label_sync "$LABELS_DESTINATION"

printf '\n완료했습니다. .github 변경사항을 검토한 뒤 커밋하세요.\n'
