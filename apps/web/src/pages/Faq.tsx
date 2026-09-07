import { Credits } from "@/components/app/Credits";
import { Markdown } from "@/components/app/Markdown";
import { FAQ_HEADING_OFFSET, FAQ_ITEMS } from "@/lib/app/faq";

export function Faq() {
  return (
    <div className="home">
      <article className="faq">
        <h2>FAQ</h2>
        <p className="faq-lead">
          Short answers for a local-first GOTV viewer. Drop a demo on the home page, or open
          Analyzer for saved notes.
        </p>
        {FAQ_ITEMS.map((item) => (
          <section key={item.question} className="faq-item">
            <Markdown headingOffset={FAQ_HEADING_OFFSET}>{item.markdown}</Markdown>
          </section>
        ))}
      </article>
      <Credits />
    </div>
  );
}
