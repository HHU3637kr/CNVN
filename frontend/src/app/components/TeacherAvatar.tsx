/** 教师头像：有 URL 用图，否则首字母占位 — plan.md §3.4 */

type Props = {
  src: string | null | undefined;
  label: string;
  className?: string;
  sizeClass?: string;
};

export function TeacherAvatar({ src, label, className = "", sizeClass = "w-full h-full" }: Props) {
  const letter = (label || "?").slice(0, 1).toUpperCase();
  if (src) {
    return (
      <img src={src} alt="" className={`${sizeClass} object-cover ${className}`} />
    );
  }
  return (
    <div
      className={`${sizeClass} flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200 text-blue-800 font-bold text-2xl ${className}`}
      aria-hidden
    >
      {letter}
    </div>
  );
}
