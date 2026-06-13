type StatusCardProps = {
  number: string;
  title: string;
  description: string;
};

export default function StatusCard({
  number,
  title,
  description
}: StatusCardProps) {
  return (
    <article className="status-card">
      <span>{number}</span>
      <strong>{title}</strong>
      <p>{description}</p>
    </article>
  );
}
