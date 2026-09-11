import { Credits } from "@/components/app/Credits";
import { Markdown } from "@/components/app/Markdown";
import { FAQ_ITEMS } from "@/lib/app/faq";
import { useMessages } from "@/lib/i18n/useMessages";

export function Faq() {
  const { messages } = useMessages();
  return (
    <div className="home">
      <article className="faq">
        <h2>{messages.faq.title}</h2>
        <p className="faq-lead">{messages.faq.lead}</p>
        {FAQ_ITEMS.map((item) => (
          <section key={item.question} className="faq-item">
            <Markdown html={item.html} />
          </section>
        ))}
      </article>
      <Credits />
    </div>
  );
}
