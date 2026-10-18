/** Section eyebrow + heading + intro, in the site's editorial style. */
export default function SectionHead({
  eyebrow,
  title,
  intro,
  id,
  align = "left",
  tone = "light",
  className = "",
}: {
  eyebrow: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  /** id for the <h2>, so the section can use aria-labelledby. */
  id?: string;
  align?: "left" | "center";
  tone?: "light" | "dark";
  className?: string;
}) {
  const dark = tone === "dark";
  return (
    <div
      data-reveal
      className={`max-w-2xl ${align === "center" ? "mx-auto text-center" : ""} ${className}`}
    >
      <p className={`eyebrow ${dark ? "eyebrow-light" : ""} ${align === "center" ? "justify-center" : ""}`}>
        {eyebrow}
      </p>
      <h2
        id={id}
        className={`mt-6 font-display text-[2.5rem] font-normal leading-[1.04] tracking-[-0.02em] sm:text-[3.25rem] lg:text-[4rem] ${
          dark ? "text-[#f4f2ee]" : "text-ink"
        }`}
      >
        {title}
      </h2>
      {intro && (
        <p className={`mt-6 max-w-[60ch] text-base leading-[1.7] sm:text-[1.0625rem] ${dark ? "text-[#b9b6af]" : "text-ink-soft"}`}>
          {intro}
        </p>
      )}
    </div>
  );
}
