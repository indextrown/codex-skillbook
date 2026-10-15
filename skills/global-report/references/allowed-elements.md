# report.html 허용 요소

`report.html`은 보고서의 유일한 원본이에요. PDF는 이 파일을 Chrome으로 그대로 인쇄해서 만들어요. DOCX는 아래 표에 따라 요소를 Word 요소로 옮겨 적어서 만들어요. 표에 없는 요소나 속성을 쓰면 Word로 옮길 방법이 없으므로 `lint_report.mjs`가 오류로 막아요.

## 문서 뼈대

```html
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>RTK 데모 앱 10월 진행 보고</title>
</head>
<body>
<section class="cover">
  <h1>RTK 데모 앱 10월 진행 보고</h1>
  <p>2026년 10월 셋째 주 · 개발팀</p>
</section>
<nav class="toc"></nav>
<section data-sources="S1">
  <h2>1. 요약</h2>
  <p>…</p>
</section>
</body>
</html>
```

- `<title>`은 비워 두지 않아요. 머리말과 내보낸 파일 이름에 써요.
- `body`의 직접 자식은 아래 순서를 따라요.
  1. `section.cover`: 없거나 하나, 맨 앞
  2. `nav.toc`: 없거나 하나
  3. 장 `section`과 `aside.callout`: 하나 이상
- 장 `section`은 `h2`로 시작하고, 그 뒤에 내용 요소가 하나 이상 있어야 해요.
- `nav.toc`는 빈 요소로 두면 내보낼 때 채워요.
  - PDF: 장·절 제목 목록
  - DOCX: Word 목차 필드

## 요소와 출력 대응

| report.html | PDF (report.css) | DOCX (Word 스타일) |
| --- | --- | --- |
| `<section class="cover">` 안의 `h1`, `p` | 첫 쪽 표지, 머리말·쪽 번호 없음 | 첫 쪽 표지(`Title`, `Subtitle`), 머리말·쪽 번호 없음 |
| `<section class="cover compact">` 안의 `h1`, `p` | 첫 쪽 위쪽 제목 블록, 바로 본문 시작 | 첫 쪽 위쪽 `Title`, `Subtitle` |
| `<h2>` | 장 제목 | `Heading 1` |
| `<h3>` | 절 제목 | `Heading 2` |
| `<h4>` | 소제목 | `Heading 3` |
| `<p>` | 본문 | `Normal` |
| `<strong>`, `<em>`, `<a>`, `<span class="accent">`, `<br>` | 굵게, 기울임, 링크, 강조색, 줄바꿈 | 굵게, 기울임, 하이퍼링크, 강조색, 줄바꿈 |
| `<ul>`, `<ol>` (2단계까지) | 목록 | 글머리·번호 목록 |
| `<table>` | 표, 쪽마다 머리행 반복 | Word 표, 머리행 반복 |
| `<figure>` 안의 `table`, `figcaption` | 캡션이 있는 표, 오른쪽 캡션 | 캡션이 있는 Word 표, 오른쪽 `Table Caption` |
| `<figure>` 안의 `img`, `figcaption` | 그림과 가운데 캡션 | 문서에 넣은 이미지와 가운데 `Caption` |
| `<aside class="callout">` | 왼쪽 강조선이 있는 상자 | `Callout` |
| `<nav class="toc">` | 목차(쪽 번호 없음) | Word 목차 필드 |

## 요소별 규칙

| 요소 | 허용 내용 | 허용 속성 |
| --- | --- | --- |
| `section.cover` | `h1` 하나, 그 뒤 `p` | `class`(`cover` 또는 `cover compact`) |
| 장 `section` | `h2`로 시작, 이후 `h3`, `h4`, `p`, `ul`, `ol`, `table`, `figure`, `aside.callout` | `data-sources` |
| `h1`~`h4` | 인라인(링크·줄바꿈 제외) | 없음 |
| `p`, `figcaption`, `li`, `th`, `td` | 인라인 | `p`: `data-sources`, `th`·`td`: `colspan`, `class="num"` |
| `ul`, `ol` | `li`만 | `data-sources` |
| `li` | 인라인, 그 뒤 하위 `ul`·`ol` 하나 | 없음 |
| `figure` | `table` 또는 `img` 하나, 그 뒤 `figcaption` 하나까지 | `data-sources` |
| `table` | `thead`(선택), `tbody`(필수) | 없음 |
| `thead`, `tbody` | `tr`만 | 없음 |
| `tr` | `th`, `td`만 | 없음 |
| `img` | 없음 | `src`(필수), `alt`, `width`(px 정수) |
| `aside.callout` | 인라인 또는 `p` 여러 개 | `class="callout"`, `data-sources` |
| `a` | 텍스트, `strong`, `em` | `href`(http, https, mailto) |
| `span.accent` | 텍스트, `strong`, `em` | `class="accent"` |

- 인라인은 텍스트, `strong`, `em`, `a`, `span.accent`, `br`이에요.
- 표의 행마다 `colspan`을 더한 칸 수가 같아야 해요.
- 숫자 칸은 `class="num"`으로 오른쪽 정렬해요.
- 이미지는 작업 폴더 안의 PNG, JPG, GIF만 써요. 외부 URL과 SVG는 쓰지 않아요.
- 쓰지 않는 것:
  - `div`, `span`(accent 외), `b`, `i`, `code`, `pre`, `blockquote`, `hr`
  - 인라인 `style`, `id`, `script`, `style` 요소
  - 목록에 없는 class
- `b`·`i` 대신 `strong`·`em`을 써요. `div`는 내용에 맞게 장 `section`, `p`, `aside.callout`으로 바꿔요.

## 출처 연결

- 장 `section`, `p`, `ul`, `ol`, `figure`, `aside.callout`에 `data-sources="S1 S3"`처럼 출처 ID를 공백으로 구분해 붙여요.
- ID는 `sources.md`에 있어야 해요. 출력물에는 보이지 않아요.

## 자리 표시자

- 아직 채우지 않은 자리는 `{{작업 내용}}`처럼 중괄호 두 개로 표시해요.
- `{{`, `}}`, `작성 예정`이 남아 있으면 내보내지 않아요. 사용자에게 비어 있는 섹션을 알리는 데 써요.
