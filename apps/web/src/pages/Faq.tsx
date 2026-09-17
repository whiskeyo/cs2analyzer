import { Link } from "react-router";
import { Credits } from "@/components/app/Credits";
import { Markdown } from "@/components/app/Markdown";
import { FAQ_ITEMS } from "@/lib/app/faq";
import { ROUTES } from "@/lib/app/routes";

export function Faq() {
  return (
    <div className="home">
      <article className="faq">
        <h2>FAQ</h2>
        <p className="faq-lead">
          Short answers for a local-first GOTV analyzer and playbook. Drop a demo on the{" "}
          <Link to={ROUTES.home}>home page</Link>,{" "}
          <Link to={ROUTES.analyzer}>open Analyzer for saved notes</Link>, or{" "}
          <Link to={ROUTES.playbook}>start a Playbook</Link>.
        </p>
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
