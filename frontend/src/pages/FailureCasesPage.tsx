import PageContainer from "../components/PageContainer";
import PlaceholderCard from "../components/PlaceholderCard";

export default function FailureCasesPage() {
  return (
    <PageContainer>
      <h1>Failure Cases</h1>
      <PlaceholderCard
        description="Phase 1 does not store failure cases. Future analysis will show where cleaning suggestions need improvement."
        eyebrow="Future analysis"
        title="Learn where cleaning suggestions need improvement"
      />
    </PageContainer>
  );
}
