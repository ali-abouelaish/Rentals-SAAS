export type QuestionType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "date"
  | "select"
  | "checkbox"
  | "number"
  | "info";

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  text: "Short text",
  textarea: "Long text",
  email: "Email",
  phone: "Phone number",
  date: "Date",
  select: "Dropdown (select one)",
  checkbox: "Checkbox (yes/no)",
  number: "Number",
  info: "Info / note block",
};
