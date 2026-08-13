---
name: global-github-repository-setup
description: 새 GitHub 저장소의 표준 레이블, 이슈 기반 브랜치 생성·삭제 자동화, 설정 파일을 안전하게 준비한다. 사용자가 "GitHub 레포 초기 설정해줘", "레이블과 이슈 브랜치 자동화 설정해줘", "새 레포 GitHub 세팅해줘"처럼 반복되는 GitHub 저장소 설정을 요청할 때 사용한다.
---

# Global GitHub Repository Setup

## 목적

새 저장소에서 반복되는 GitHub 레이블과 이슈 브랜치 자동화를 같은 기준으로 설정한다. 토큰은 채팅, Git 추적 파일, 명령 출력에 남기지 않는다.

## 제공하는 설정

- `.github/labels.json`: feature, fix, hotfix, chore, refactor, test, docs 레이블
- `.github/issue-branch.yml`: 레이블별 브랜치 접두사와 이슈 자동 종료 설정
- `.github/workflows/issue-auto-branch.yml`: 이슈 브랜치 생성과 병합된 브랜치 삭제

자동 종료가 동작하도록 브랜치 이름은 `feature/issue-42`처럼 `issue-<번호>`를 포함한다. `#42`만 사용하는 형식은 이슈 번호를 찾지 못할 수 있다.

## 작업 원칙

1. 대상 저장소의 `AGENTS.md`, 기존 `.github` 파일, 원격 이름, 기존 레이블을 먼저 확인한다.
2. 원격 저장소는 `gh repo view --json nameWithOwner`로 감지하고, 감지할 수 없을 때만 `OWNER/REPO`를 요청한다.
3. 기존 설정 파일은 diff를 보여주고 사용자의 명시적 승인 뒤에만 덮어쓴다.
4. 레이블 동기화는 항상 dry-run을 먼저 실행한다. 기본값은 `--allow-added-labels`로, JSON에 없는 기존 레이블을 보존한다. 삭제 동기화는 사용자가 명시적으로 요청한 경우에만 사용한다.
5. GitHub Actions에는 별도 개인 액세스 토큰 Secret을 만들지 않는다. 워크플로우의 `secrets.GITHUB_TOKEN`과 최소 권한을 사용한다.
6. 사용자에게 개인 액세스 토큰을 대화에 붙여넣으라고 요청하지 않는다. 스크립트가 `gh auth token`, 기존 환경 변수, 숨김 터미널 입력 순서로만 인증을 얻는다.

## 사용 방법

사용자가 실제 대상 저장소 설정을 승인했다면, 그 저장소 루트에서 아래 스크립트를 직접 실행하도록 안내한다.

```bash
bash ~/.agents/skills/global-github-repository-setup/scripts/setup-github-repository.sh
```

기본값은 이슈 담당자 지정 시 브랜치를 만드는 `auto` 모드다. 대부분의 저장소는 이 모드만 사용한다.

`chatops` 모드는 이슈 댓글의 `/cib` 명령으로 브랜치를 만들고 싶을 때만 선택한다. 지금은 기본으로 사용하지 않지만, 추후 댓글 기반 흐름이 필요할 수 있어 템플릿과 선택지를 유지한다. `chatops`를 선택하지 않으면 관련 파일은 대상 저장소에 복사되지 않는다.

```bash
bash ~/.agents/skills/global-github-repository-setup/scripts/setup-github-repository.sh \
  --mode chatops
```

변경 내용을 먼저 확인만 하려면 아래를 사용한다.

```bash
bash ~/.agents/skills/global-github-repository-setup/scripts/setup-github-repository.sh \
  --dry-run
```

## 인증 처리

스크립트는 다음 순서로 레이블 동기화용 인증을 찾는다.

1. `GITHUB_ACCESS_TOKEN` 환경 변수
2. `PERSONAL_ACCESS_TOKEN` 환경 변수
3. `gh auth login`으로 로그인한 GitHub CLI 자격 증명
4. 사용자 터미널의 숨김 입력

토큰은 `github-label-sync` 실행에만 환경 변수로 전달하고, 실행 직후 해제한다. 스킬은 토큰 값이나 `export` 명령을 채팅·문서·커밋에 출력하지 않는다.

GitHub CLI 인증이 없다면 사용자는 자신의 터미널에서만 다음처럼 준비할 수 있다.

```bash
gh auth login
```

## 완료 후 확인

1. `.github` 파일 diff와 레이블 dry-run 결과를 검토한다.
2. 변경 파일을 커밋·푸시한다.
3. Actions 권한 정책이 조직에서 읽기 전용으로 강제된 경우, 저장소 관리자에게 `contents: write`와 `issues: write` 권한 허용을 요청한다.
