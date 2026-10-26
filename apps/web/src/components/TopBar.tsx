import { DocIcon } from "./Icons";
import { Logo } from "./Logo";
import { ProgressRing } from "./ProgressRing";

interface Props {
  title: string;
  file?: { name: string; sub: string } | null;
  ring?: { percent: number; caption: string; spinning?: boolean } | null;
  actions?: React.ReactNode;
}

/** Logo (when there's no sidebar), page title, actions, file chip and progress ring. */
export function TopBar({ title, file, ring, actions }: Props) {
  return (
    <header className="topbar">
      <div className="topbar__brand">
        <Logo size={30} />
        <span>FinePrint</span>
      </div>
      <p className="topbar__title">{title}</p>
      <div className="topbar__right">
        {actions ? <div className="topbar__actions">{actions}</div> : null}
        {file ? (
          <div className="filechip" title={file.name}>
            <DocIcon size={18} />
            <span className="filechip__text">
              <span className="filechip__name">{file.name}</span>
              <span className="filechip__sub">{file.sub}</span>
            </span>
          </div>
        ) : null}
        {ring ? (
          <div className="topbar__ring">
            <ProgressRing percent={ring.percent} spinning={ring.spinning} label={`${ring.caption}, ${ring.percent} percent`} />
            <span className="topbar__ringcap">{ring.caption}</span>
          </div>
        ) : null}
      </div>
    </header>
  );
}
