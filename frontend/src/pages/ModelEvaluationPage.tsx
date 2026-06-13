import PageContainer from "../components/PageContainer";
import PlaceholderCard from "../components/PlaceholderCard";

export default function ModelEvaluationPage() {
  return (
    <PageContainer>
      <h1>Model Evaluation</h1>
      <PlaceholderCard
        action={{
          href: "/play",
          label: "Open evaluation workspace"
        }}
        description="The existing deterministic evaluation remains an advanced layer for comparing cleaning behavior in a controlled environment."
        eyebrow="Advanced workspace"
        title="Compare cleaning behavior in a controlled environment"
      />
    </PageContainer>
  );
}
