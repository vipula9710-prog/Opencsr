import { renderBuilderPage, builderPageMetadata } from "./render-page";

export const generateMetadata = () => builderPageMetadata(null);

export default function HomePage() {
  return renderBuilderPage(null);
}
