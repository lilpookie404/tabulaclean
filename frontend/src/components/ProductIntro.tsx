export default function ProductIntro() {
  return (
    <>
      <section className="hero" data-cursor-tone="coral">
        <div className="hero-content">
          <p className="eyebrow">AI-assisted spreadsheet cleaning</p>
          <h1>
            Messy data,
            <br />
            <em>made clear.</em>
          </h1>
          <div className="hero-footer">
            <p>
              Spot spreadsheet issues, review suggested fixes, approve risky
              changes, and validate what comes out.
            </p>
            <a className="text-link" href="#workspace">
              Explore the workspace
            </a>
          </div>
        </div>
        <div aria-hidden="true" className="orbit" />
      </section>
      <div aria-hidden="true" className="workflow-marquee">
        <span>
          Preview issues - Review changes - Validate data - Download clean files
          - Preview issues - Review changes - Validate data - Download clean
          files -
        </span>
      </div>
    </>
  );
}
