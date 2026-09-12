import type { ReactNode } from "react";
import { Credits } from "@/components/app/Credits";
import { ISSUES_URL } from "@/lib/app/links";
import { useMessages } from "@/lib/i18n";

function FaqArticle({ question, children }: { question: string; children: ReactNode }) {
  return (
    <section className="faq-item">
      <h3>{question}</h3>
      {children}
    </section>
  );
}

export function Faq() {
  const { messages, tNodes } = useMessages();
  const faq = messages.faq;
  return (
    <div className="home">
      <article className="faq">
        <h2>{faq.title}</h2>
        <p className="faq-lead">{faq.lead}</p>
        <FaqArticle question={faq.whatIs.question}>
          <p>{faq.whatIs.body}</p>
        </FaqArticle>
        <FaqArticle question={faq.privacy.question}>
          <p>{faq.privacy.body}</p>
        </FaqArticle>
        <FaqArticle question={faq.whatToDrop.question}>
          <p>{tNodes(faq.whatToDrop.body, { dem: <code>.dem</code> })}</p>
        </FaqArticle>
        <FaqArticle question={faq.savedNotes.question}>
          <p>{tNodes(faq.savedNotes.body, { dem: <code>.dem</code> })}</p>
        </FaqArticle>
        <FaqArticle question={faq.stats.question}>
          <p>{faq.stats.intro}</p>
          <h4>{faq.stats.adrHeading}</h4>
          <p>{faq.stats.adrBody}</p>
          <h4>{faq.stats.sidesHeading}</h4>
          <p>{faq.stats.sidesBody}</p>
        </FaqArticle>
        <FaqArticle question={faq.gotvOrPov.question}>
          <p>{faq.gotvOrPov.body}</p>
        </FaqArticle>
        <FaqArticle question={faq.browsers.question}>
          <p>{faq.browsers.body}</p>
        </FaqArticle>
        <FaqArticle question={faq.affiliation.question}>
          <p>{faq.affiliation.body}</p>
        </FaqArticle>
        <FaqArticle question={faq.preRelease.question}>
          <p>{faq.preRelease.body}</p>
        </FaqArticle>
        <FaqArticle question={faq.report.question}>
          <p>
            {tNodes(faq.report.body, {
              issues: (
                <a href={ISSUES_URL} target="_blank" rel="noreferrer">
                  {faq.report.issuesLink}
                </a>
              ),
            })}
          </p>
        </FaqArticle>
      </article>
      <Credits />
    </div>
  );
}
