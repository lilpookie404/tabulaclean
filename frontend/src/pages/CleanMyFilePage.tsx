import PhaseBoundaryCallout from "../components/PhaseBoundaryCallout";
import ProductIntro from "../components/ProductIntro";
import ProductPrinciples from "../components/ProductPrinciples";
import WorkspacePreview from "../components/WorkspacePreview";

export default function CleanMyFilePage() {
  return (
    <>
      <ProductIntro />
      <WorkspacePreview />
      <ProductPrinciples />
      <PhaseBoundaryCallout />
    </>
  );
}
