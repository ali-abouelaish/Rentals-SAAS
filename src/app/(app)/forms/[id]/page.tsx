import { redirect } from "next/navigation";

// The form builder is now on /forms (3-column layout).
// Individual form URLs redirect there.
export default function FormBuilderRoute() {
  redirect("/forms");
}
