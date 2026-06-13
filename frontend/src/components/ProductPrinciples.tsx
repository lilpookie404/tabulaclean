const principles = [
  {
    number: "01",
    title: "Plain-English issue previews",
    description:
      "Explain what is wrong without asking people to understand schemas or technical cleaning terminology."
  },
  {
    number: "02",
    title: "Human review where it matters",
    description:
      "Safe fixes can move quickly. Risky changes pause for explicit approval with clear before-and-after context."
  },
  {
    number: "03",
    title: "Evaluation stays behind the product",
    description:
      "Model comparison tools remain accessible as an advanced layer instead of defining the main journey."
  }
];

export default function ProductPrinciples() {
  return (
    <section className="principles-section" data-cursor-tone="coral">
      <p className="eyebrow">Product principles</p>
      <h2>
        Useful features,
        <br />
        told like a story.
      </h2>
      <div className="principles-list">
        {principles.map((principle) => (
          <article className="principle" key={principle.number}>
            <span>{principle.number}</span>
            <h3>{principle.title}</h3>
            <p>{principle.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
