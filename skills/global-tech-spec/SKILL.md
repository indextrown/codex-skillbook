---
name: global-tech-spec
description: 기능 요구사항과 저장소 문맥을 뱅크샐러드식 7개 섹션의 간결한 테크 스펙으로 정리하고, Markdown 원본과 같은 내용을 담은 HTML을 생성·동기화한다. 사용자가 테크 스펙, 기술 설계서, 구현 전 설계 문서, Markdown·HTML 쌍, 문서 동기화 훅을 만들거나 수정해 달라고 할 때 사용한다.
---

# Global Tech Spec

## 목적

기능을 구현하기 전에 팀이 합의해야 할 배경, 범위, 설계 방향, 고려 사항, 완료 조건을 짧고 구체적으로 정리해요. AI가 읽고 수정하는 Markdown을 단일 원본으로 사용하고, 사람이 읽는 HTML은 같은 정보로 자동 생성해요.

이 스킬은 테크 스펙 작성을 위한 스킬이에요. 사용자가 함께 호출한 다른 스킬은 도메인 제약과 저장소 규칙을 파악하는 입력으로 사용해요. 사용자가 구현까지 요청하지 않았다면 기능 코드는 수정하지 않아요.

## 결과물

저장소 루트의 `docs/tech-specs` 아래에 기능별 폴더를 만들어요. Markdown과 HTML 파일명은 항상 `tech-spec`으로 맞춰요.

```text
docs/tech-specs/<feature-slug>/
├── tech-spec.md
└── tech-spec.html
```

- `<feature-slug>`는 기능을 설명하는 짧은 영문 kebab-case 이름으로 정해요. 예를 들어 프로젝트별 이메일 알림 설정은 `project-email-notifications`를 사용해요.
- `new-feature`, `spec`, `document`처럼 의미가 드러나지 않는 폴더명은 사용하지 않아요.
- Markdown이 단일 원본이에요.
- HTML은 Markdown과 같은 사실, 요구사항, 결정, 미결 사항을 담아요.
- 목차, 색상, 여백처럼 읽기 위한 표현만 HTML에 추가할 수 있어요.
- HTML을 직접 수정하지 않아요. Markdown을 고친 뒤 다시 생성해요.

## 참조 문서

테크 스펙을 만들거나 수정하기 전에 반드시 `references/tech-spec-template.md`를 끝까지 읽어요.

## 작성 원칙

- 본문은 `-요`체로 통일해요.
- 한 문장에는 하나의 핵심만 담아요.
- 수동형보다 주체와 행동이 드러나는 능동형을 우선해요.
- 사용자가 제공하지 않은 수치, 일정, API, 테이블, 장애 상황을 지어내지 않아요.
- 확인한 사실과 제안하는 설계를 구분해요.
- 구현 전에 결정이 필요한 내용만 `고려 사항`에 남겨요.
- 모든 섹션을 같은 길이로 채우지 않아요. `계획`에 가장 많은 정보를 두되, 기능에 필요하지 않은 하위 항목은 만들지 않아요.
- G, M, NG 같은 식별자나 과도한 요구사항·리스크 매트릭스를 기본으로 사용하지 않아요.
- 코드, API 예시, 데이터 구조, 다이어그램은 설명을 실제로 더 명확하게 만들 때만 넣어요.

## 실행 순서

### 1. 문맥을 확인해요

사용자 요구사항, 함께 호출한 스킬, `AGENTS.md`, 관련 코드와 기존 문서를 확인해요. 아래 정보가 있으면 우선 사용해요.

- 해결하려는 문제와 사용자
- 목표와 범위에서 제외할 내용
- 현재 동작과 바꿀 동작
- 기술 제약과 기존 인터페이스
- 배포 순서와 완료 조건

핵심 설계가 달라질 만큼 정보가 부족하면 필요한 질문만 짧게 물어요. 합리적인 초안을 만들 수 있으면 가정을 명시하고 계속 진행해요.

### 2. Markdown을 먼저 작성해요

`references/tech-spec-template.md`의 7개 섹션과 순서를 유지해요.

1. 요약
2. 배경
3. 목표
4. 목표가 아닌 것
5. 계획
6. 고려 사항
7. 마일스톤

기능 이름에서 `<feature-slug>`를 정하고 `docs/tech-specs/<feature-slug>/tech-spec.md`를 만들어요. 초안에 남은 빈 자리 표시자와 안내 문구는 최종 파일에서 제거해요. 문서 맨 위에는 `kind: tech-spec`을 포함한 최소 frontmatter를 넣어 HTML 동기화 대상을 식별해요.

### 3. HTML을 생성해요

Markdown을 저장한 뒤 이 스킬의 변환 스크립트를 실행해요.

```bash
python3 <skill-directory>/scripts/sync_tech_specs.py \
  --root <repository-root> \
  docs/tech-specs/<feature-slug>/tech-spec.md
```

HTML에는 Markdown 원본의 해시를 기록해요. 변환 뒤 아래 명령으로 두 파일이 최신 상태인지 확인해요.

```bash
python3 <skill-directory>/scripts/sync_tech_specs.py \
  --root <repository-root> \
  --check \
  docs/tech-specs/<feature-slug>/tech-spec.md
```

### 4. 프로젝트 훅을 설치해요

테크 스펙을 생성하거나 수정할 때 사용자가 훅을 제외하라고 하지 않는 한 프로젝트 로컬 훅 설치기를 실행해요. 설치기는 반복 실행해도 기존 설정을 보존하며, 복사된 변환기가 오래되었으면 최신 버전으로 바꿔요.

```bash
python3 <skill-directory>/scripts/install_project_hook.py --root <repository-root>
```

설치 스크립트는 아래 작업만 수행해요.

- 변환기를 `.codex/hooks/sync_tech_specs.py`에 복사해요.
- 기존 `.codex/hooks.json`을 보존하면서 `PostToolUse`와 `Stop` 훅을 추가해요.
- 같은 훅이 있으면 중복으로 추가하지 않아요.

Codex는 프로젝트 훅을 실행하기 전에 신뢰를 요구할 수 있어요. 설치 뒤 `/hooks`에서 구성을 검토하고 신뢰해야 한다고 사용자에게 알려요. 신뢰 전에도 현재 작업에서는 변환 스크립트를 직접 실행해 HTML을 맞춰요.

훅의 위치, 설정 형식, 신뢰 절차는 [Codex 훅 공식 문서](https://developers.openai.com/codex/hooks)를 기준으로 해요.

### 5. 수정 요청을 반영해요

사용자가 내용을 추가하거나 수정하면 Markdown만 편집해요. 이후 변환 스크립트를 실행하고 `--check`로 HTML이 최신인지 확인해요. 훅이 설치되어 있더라도 현재 작업의 검증을 훅에만 맡기지 않아요.

## 완료 기준

- Markdown에 7개 필수 섹션이 순서대로 있어요.
- 내용이 사용자 요구사항과 저장소 문맥을 벗어나지 않아요.
- Markdown과 HTML이 같은 사실과 결정을 담아요.
- 변환기의 `--check`가 성공해요.
- 새 훅을 설치했다면 기존 훅이 보존되고 재실행해도 중복되지 않아요.
- 기능 구현 범위를 임의로 넓히지 않았어요.

## 사용자 응답

생성이나 수정을 마치면 파일 경로와 동기화 상태를 짧게 알려요. 마지막 문장은 항상 아래 의미를 자연스럽게 담아요.

```text
테크 스펙과 HTML 문서를 최신 상태로 맞췄어요. 수정하거나 더 구체화하고 싶은 부분이 있나요?
```
