import PageContainer from "../components/PageContainer";
import PlaceholderCard from "../components/PlaceholderCard";

export default function ReviewChangesPage() {
  return (
    <PageContainer>
      <h1>Review Changes</h1>
      <PlaceholderCard
        description="Future versions will show before-and-after values and let you approve risky changes before applying them."
        eyebrow="Human review"
        title="Understand every suggested fix"
      />
    </PageContainer>
  );
}
