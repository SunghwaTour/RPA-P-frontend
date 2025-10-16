import { title, subtitle } from "@/components/primitives";
import DefaultLayout from "@/layouts/default";

export default function IndexPage() {
  return (
    <DefaultLayout>
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div className="inline-block max-w-xl text-center justify-center align-middle">
          <span className={title()}>Hello,&nbsp;</span>
          <span className={title({ color: "violet" })}>KINGBUS&nbsp;</span>
        </div>
      </section>
    </DefaultLayout>
  );
}
