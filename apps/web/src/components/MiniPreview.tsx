/** Tiny looping demo: one line of a fake page gets highlighted and a chip pops out. */
export function MiniPreview() {
  const widths = [92, 78, 88, 64, 84, 70, 56];
  return (
    <figure className="mini">
      <div className="mini__stage" aria-hidden="true">
        <div className="mini__page">
          {widths.map((w, i) => (
            <span
              key={i}
              className={`mini__line${i === 3 ? " mini__line--hl" : ""}`}
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
        <span className="mini__chip">Late fee · Page 3</span>
      </div>
      <figcaption className="mini__caption">
        Every risk is highlighted in your document, with its page number.
      </figcaption>
    </figure>
  );
}
