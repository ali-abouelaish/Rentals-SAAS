import { notFound } from "next/navigation";
import { getPublicForm } from "@/features/forms/data/public-form";
import { PublicFormPage } from "@/features/forms/ui/PublicFormPage";

interface Props {
  params: { slug: string };
}

export default async function PublicFormRoute({ params }: Props) {
  const form = await getPublicForm(params.slug);
  if (!form) notFound();

  return <PublicFormPage form={form} slug={params.slug} />;
}
