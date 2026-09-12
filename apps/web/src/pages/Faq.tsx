import type { ReactNode } from "react";
import { Credits } from "@/components/app/Credits";
import { FAQ_SLUGS, faqQuestion, type FaqSlug } from "@/lib/app/faq";
import { ISSUES_URL } from "@/lib/app/links";
import type { Messages } from "@/lib/i18n/messages";
import { useMessages, type MessagesApi } from "@/lib/i18n/useMessages";

function FaqArticle({ question, children }: { question: string; children: ReactNode }) {
  return (
    <section className="faq-item">
      <h3>{question}</h3>
      {children}
    </section>
  );
}

function FaqBody({
  slug,
  faq,
  tNodes,
}: {
  slug: FaqSlug;
  faq: Messages["faq"];
  tNodes: MessagesApi["tNodes"];
}) {
  switch (slug) {
    case "what-is":
      return <p>{faq.whatIs.body}</p>;
    case "privacy":
      return <p>{faq.privacy.body}</p>;
    case "what-to-drop":
      return <p>{tNodes(faq.whatToDrop.body, { dem: <code>.dem</code> })}</p>;
    case "saved-notes":
      return <p>{tNodes(faq.savedNotes.body, { dem: <code>.dem</code> })}</p>;
    case "stats":
      return (
        <>
          <p>{faq.stats.intro}</p>
          <h4>{faq.stats.adrHeading}</h4>
          <p>{faq.stats.adrBody}</p>
          <h4>{faq.stats.sidesHeading}</h4>
          <p>{faq.stats.sidesBody}</p>
        </>
      );
    case "gotv-or-pov":
      return <p>{faq.gotvOrPov.body}</p>;
    case "browsers":
      return <p>{faq.browsers.body}</p>;
    case "affiliation":
      return <p>{faq.affiliation.body}</p>;
    case "pre-release":
      return <p>{faq.preRelease.body}</p>;
    case "report":
      return (
        <p>
          {tNodes(faq.report.body, {
            issues: (
              <a href={ISSUES_URL} target="_blank" rel="noreferrer">
                {faq.report.issuesLink}
              </a>
            ),
          })}
        </p>
      );
  }
}

export function Faq() {
  const { messages, tNodes } = useMessages();
  const faq = messages.faq;
  return (
    <div className="home">
      <article className="faq">
        <h2>{faq.title}</h2>
        <p className="faq-lead">{faq.lead}</p>
        {FAQ_SLUGS.map((slug) => (
          <FaqArticle key={slug} question={faqQuestion(faq, slug)}>
            <FaqBody slug={slug} faq={faq} tNodes={tNodes} />
          </FaqArticle>
        ))}
      </article>
      <Credits />
    </div>
  );
}
