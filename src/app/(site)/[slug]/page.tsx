import { renderBuilderPage, builderPageMetadata } from "../render-page";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  return builderPageMetadata((await params).slug);
}

export default async function CustomPage({ params }: Props) {
  return renderBuilderPage((await params).slug);
}
