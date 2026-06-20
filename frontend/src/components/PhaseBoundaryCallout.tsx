export default function PhaseBoundaryCallout() {
  return (
    <section className="phase-callout" data-cursor-tone="coral">
      <div className="phase-callout-inner">
        <div className="phase-callout-main">
          <h2>TabulaClean</h2>
          <p>
            AI-assisted CSV and Excel cleanup with previews, review gates,
            validation reports, and downloadable exports.
          </p>
          <div className="phase-callout-links">
            <a href="https://github.com/lilpookie404/tabulaclean">
              <GithubIcon />
              GitHub
            </a>
            <a href="https://github.com/lilpookie404/tabulaclean/issues">
              <FeedbackIcon />
              Send feedback
            </a>
          </div>
        </div>
        <div className="phase-callout-bottom">
          <p>© 2026 TabulaClean. All rights reserved.</p>
          <p>{"Designed and Built by Vaishnavi <3"}</p>
        </div>
      </div>
    </section>
  );
}

function GithubIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 2.75a9.25 9.25 0 0 0-2.93 18.03c.46.08.63-.2.63-.44v-1.6c-2.56.56-3.1-1.1-3.1-1.1-.42-1.08-1.03-1.37-1.03-1.37-.84-.57.06-.56.06-.56.93.07 1.42.96 1.42.96.83 1.42 2.18 1.01 2.71.77.08-.6.32-1.01.59-1.24-2.05-.23-4.2-1.02-4.2-4.55 0-1.01.36-1.83.95-2.47-.1-.24-.41-1.18.09-2.44 0 0 .78-.25 2.55.95a8.8 8.8 0 0 1 4.64 0c1.77-1.2 2.54-.95 2.54-.95.5 1.26.19 2.2.09 2.44.6.64.95 1.46.95 2.47 0 3.54-2.16 4.32-4.21 4.55.33.29.63.85.63 1.72v2.55c0 .24.17.53.64.44A9.25 9.25 0 0 0 12 2.75Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function FeedbackIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M4.75 6.75h14.5v10.5H4.75V6.75Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="m5.25 7.25 6.75 5 6.75-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
