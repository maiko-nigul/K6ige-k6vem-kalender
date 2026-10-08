type IconName =
  | "calendar"
  | "plus"
  | "search"
  | "left"
  | "right"
  | "logout"
  | "location"
  | "sparkle"
  | "sun"
  | "close";
const paths: Record<IconName, string> = {
  calendar:
    "M7 3v4m10-4v4M4 10h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Zm3 9h2m4 0h2m-8 3h2m4 0h2",
  plus: "M12 5v14M5 12h14",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  left: "m14 6-6 6 6 6",
  right: "m10 6 6 6-6 6",
  logout: "M9 4H4v16h5m5-13 5 5-5 5M8 12h12",
  location:
    "M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Zm-4 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  sparkle: "m12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8L12 2Z",
  sun: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z",
  close: "m6 6 12 12M6 18 18 6",
};
export default function Icon({
  name,
  size = 18,
}: {
  name: IconName;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="ui-icon"
    >
      <path d={paths[name]} />
    </svg>
  );
}
