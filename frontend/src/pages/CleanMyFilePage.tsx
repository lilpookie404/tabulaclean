import PageContainer from "../components/PageContainer";
import PlaceholderCard from "../components/PlaceholderCard";

export default function CleanMyFilePage() {
  return (
    <PageContainer>
      <h1>Clean My File</h1>
      <PlaceholderCard
        description="CSV and Excel upload sessions arrive in Phase 2. This phase establishes the application shell and backend connection."
        eyebrow="Phase 1 foundation"
        title="Your guided cleaning workspace is taking shape"
      />
    </PageContainer>
  );
}
