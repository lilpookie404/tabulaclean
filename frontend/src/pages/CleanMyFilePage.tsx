import PhaseBoundaryCallout from "../components/PhaseBoundaryCallout";
import ProductIntro from "../components/ProductIntro";
import ProductPrinciples from "../components/ProductPrinciples";
import UploadWorkspace from "../components/UploadWorkspace";

export default function CleanMyFilePage() {
  return (
    <>
      <ProductIntro />
      <UploadWorkspace />
      <ProductPrinciples />
      <PhaseBoundaryCallout />
    </>
  );
}
