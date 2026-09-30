export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[0.9rem] leading-relaxed text-ink-soft ${className}`} role="note">
      <strong className="font-semibold text-ink">Ruqyah works alongside medical care, never instead of it.</strong>{" "}
      If you are unwell, in pain or in distress, see a doctor or a mental health professional, and
      contact emergency services if you are in danger.
    </p>
  );
}
