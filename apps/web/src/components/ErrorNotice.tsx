import type { ScanError } from "@/lib/errors";
import { AlertIcon } from "./Icons";

interface Props {
  error: ScanError;
  onResume?: () => void;
}

/** Every error says what happened and what to do next. */
export function ErrorNotice({ error, onResume }: Props) {
  return (
    <div className="notice notice--error" role="alert">
      <AlertIcon size={20} />
      <div className="notice__body">
        <h2 className="notice__title">{error.title}</h2>
        <p>{error.message}</p>
        <p>
          <strong>What to do:</strong> {error.next}
        </p>
        {onResume ? (
          <button type="button" className="btn btn--secondary" onClick={onResume}>
            Keep waiting
          </button>
        ) : null}
      </div>
    </div>
  );
}
