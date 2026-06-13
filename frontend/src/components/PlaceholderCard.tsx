type PlaceholderCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  action?: {
    href: string;
    label: string;
  };
};

export default function PlaceholderCard({
  eyebrow,
  title,
  description,
  action
}: PlaceholderCardProps) {
  return (
    <section className="placeholder-card">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? (
        <a className="button button-dark" href={action.href}>
          {action.label}
        </a>
      ) : null}
    </section>
  );
}
