import { MountainBackdrop, type BackdropVariant } from "./MountainBackdrop";

interface Props {
  theme: "dark" | "ice";
  backdrop: BackdropVariant;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
}

/** Page frame: themed background + mountains + optional sidebar. */
export function AppShell({ theme, backdrop, sidebar, children }: Props) {
  return (
    <div className={`app app--${theme}`}>
      <MountainBackdrop variant={backdrop} />
      <div className={`shell${sidebar ? " shell--sidebar" : ""}`}>
        {sidebar}
        <div className="shell__main">{children}</div>
      </div>
    </div>
  );
}
