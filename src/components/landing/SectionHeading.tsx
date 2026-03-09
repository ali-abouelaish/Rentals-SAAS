import { cn } from "@/lib/utils/cn";

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  className?: string;
};

export function SectionHeading({
  eyebrow = "Harbor Platform",
  title,
  subtitle,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn("text-center max-w-3xl mx-auto", className)}>
      <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-harbor-light-blue/45 bg-white/60 px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-harbor-navy backdrop-blur-xl">
        <span className="h-1.5 w-1.5 rounded-full bg-[#4FD1FF] shadow-[0_0_16px_rgba(79,209,255,0.7)]" />
        {eyebrow}
      </p>
      <h2 className="mt-5 text-3xl font-bold tracking-tight text-harbor-navy-deep sm:text-4xl font-heading">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-lg text-harbor-text-neutral/90 leading-relaxed">
          {subtitle}
        </p>
      )}
      <div className="mx-auto mt-6 h-px w-44 bg-[linear-gradient(90deg,rgba(16,62,115,0),rgba(79,209,255,0.75),rgba(16,62,115,0))]" />
    </div>
  );
}
