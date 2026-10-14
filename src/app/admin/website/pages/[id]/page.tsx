import { BuilderPage } from "../../loader";

export const metadata = { title: "Website Builder — page" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <BuilderPage panel="pages" pageId={(await params).id} />;
}
