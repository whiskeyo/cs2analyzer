import { Credits } from "@/components/app/Credits";
import { Markdown } from "@/components/app/Markdown";
import { faqItemsFor } from "@/lib/app/faq";
import { useMessages } from "@/lib/i18n/useMessages";

export function Faq() {
  const { locale, messages } = useMessages();
  const items = faqItemsFor(locale);
  return (
    <div className="home">
      <article className="faq">
        <h2>{messages.faq.title}</h2>
        <p className="faq-lead">{messages.faq.lead}</p>
        {items.map((item) => (
          <section key={item.slug} className="faq-item">
            <Markdown html={item.html} />
          </section>
        ))}
      </article>
      <Credits />
    </div>
  );
}
