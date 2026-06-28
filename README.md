# 90 Second Word Hunt

## Deployment

Upload `index.html`, `styles.css`, and `script.js` to GitHub Pages.

## Google Sheet leaderboard

The app reads leaderboard rows from:

https://docs.google.com/spreadsheets/d/1uJr0ch0_kONu8HPw9mfU5hUSZ19qjNWmjZzpLtlpUAY/edit

It expects `Sheet1` headers:

`name`, `score_seconds`, `completed`, `solved_count`, `duration_seconds`, `revealed_by`, `puzzle_version`, `created_at`, `user_agent`, `attempt_id`

The app does not use `localStorage` for leaderboard entries. It reads public rows from the Sheet and keeps only the current in-page attempt in memory until the Sheet refresh catches up.

Static browser JavaScript can read the public sheet, but Google still does not expose anonymous direct spreadsheet writes from a website URL. To make live writes happen, deploy this Apps Script as a Web App with "Execute as: Me" and access set to "Anyone", then paste its `/exec` URL into `GOOGLE_SHEETS_WEB_APP_URL` in `script.js`.

The app writes a row as soon as the player starts, with `revealed_by` set to `started`. When the game ends, it sends the same `attempt_id`; the script updates that row. Started-only rows are kept out of the visible leaderboard, and the matching final leaderboard row is highlighted.

```js
const SPREADSHEET_ID = "1uJr0ch0_kONu8HPw9mfU5hUSZ19qjNWmjZzpLtlpUAY";
const SHEET_NAME = "Sheet1";

function doPost(e) {
  const data = JSON.parse(e.postData.contents || "{}");
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);

  const attemptId = data.attempt_id ?? data.attemptId ?? "";
  const row = [
    data.name || "",
    Number(data.score_seconds ?? data.scoreSeconds ?? 90),
    String(data.completed).toLowerCase() === "true",
    Number(data.solved_count ?? data.solvedCount ?? 0),
    Number(data.duration_seconds ?? data.durationSeconds ?? 90),
    data.revealed_by ?? data.revealedBy ?? "",
    data.puzzle_version ?? data.puzzleVersion ?? "v1",
    data.created_at ?? data.createdAt ?? new Date().toISOString(),
    data.user_agent ?? data.userAgent ?? "",
    attemptId
  ];

  const lastRow = sheet.getLastRow();
  const attemptIds = lastRow > 1
    ? sheet.getRange(2, 10, lastRow - 1, 1).getValues().flat()
    : [];
  const existingIndex = attemptIds.findIndex((value) => String(value) === String(attemptId));

  if (attemptId && existingIndex >= 0) {
    sheet.getRange(existingIndex + 2, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## Suggested WhatsApp message

“I found this 90-second word hunt 😂
Best score is 53.4s. I got 58.7.
Beat me if you can:
[short link]”
