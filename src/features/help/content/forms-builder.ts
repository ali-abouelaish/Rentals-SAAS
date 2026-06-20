import type { HelpArticle } from "../domain/types";

export const formsBuilderArticle: HelpArticle = {
  slug: "forms-builder",
  title: "Form Builder",
  route: "/forms",
  match: "prefix",
  summary: "Three-column form builder: select a form on the left, edit questions in the centre, and preview the live form on the right.",
  content: `## Layout

The Forms page uses a three-column layout:
- **Left panel** — list of all your forms. Click any card to load it for editing.
- **Centre panel** — form header editor and the question list with drag-and-drop reordering.
- **Right panel** — live preview showing exactly how respondents will see the form.

## Creating a form

Click **New form** in the top-right. Give it a name, an optional description, and optionally link it to a portfolio. Forms linked to a portfolio only appear in the unit side drawer for units in that portfolio; forms without a portfolio appear for all units.

## Building questions

In the centre panel click **Add item** and choose a type:
- **Short text** — single-line free text
- **Long text** — multi-line paragraph answer
- **Email** — validated email address
- **Phone number** — phone field
- **Date** — date picker
- **Dropdown (select one)** — multiple-choice, pick one
- **Checkbox (yes/no)** — single tick box
- **Number** — numeric input
- **Info / note block** — display-only instructions (not answered by the respondent)
- **File upload** — respondents can attach a file

Drag the grip handle to reorder items. Mark individual questions required with the Required toggle.

## Actions (header toolbar)

- **Edit** — rename, redescribe, or change the portfolio link.
- **Copy link** — copies the public \`/f/\{slug\}\` URL to your clipboard.
- **Open** — opens the live public form in a new tab.
- **Send** — email the form link directly to clients or custom addresses.
- **Import** (sparkle icon) — paste a Google Forms URL to auto-import its questions.
- **Responses** — view all submissions for this form.
- **Toggle** — activate or deactivate the form.
- **Duplicate** (copy icon) — create a copy of the form with all its questions (starts inactive).
- **Delete** (red bin) — permanently deletes the form and all responses.

## Sending from a unit

Open any unit's side drawer and go to the **Forms** tab to see available forms and send them directly to that unit's tenant.

## Viewing responses

Click **Responses** to see all submissions. Each entry shows the respondent's name, email, phone, and submission time. Click a row to expand the full set of answers.`,
};
