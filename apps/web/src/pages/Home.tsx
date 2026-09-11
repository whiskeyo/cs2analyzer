import { Link } from "react-router";
import { DemoDrop } from "@/components/app/DemoDrop";
import { CreatePlaybookCard } from "@/components/playbook/CreatePlaybookCard";
import { ROUTES } from "@/lib/app/routes";
import { useMessages } from "@/lib/i18n/useMessages";

function HomeIntro() {
  const { messages } = useMessages();
  return (
    <div className="home-intro">
      <p className="home-kicker">{messages.home.kicker}</p>
      <h2>{messages.home.title}</h2>
      <p className="home-intro-lead">{messages.home.lead}</p>
      <ul className="feature-list">
        <li>{messages.home.featureRadar}</li>
        <li>{messages.home.featureScoreboard}</li>
        <li>{messages.home.featureHabits}</li>
        <li>{messages.home.featureKillfeed}</li>
        <li>{messages.home.featureMore}</li>
      </ul>
    </div>
  );
}

function HomeFaqHint() {
  const { messages } = useMessages();
  return (
    <p className="home-faq-hint muted">
      {messages.home.faqHintBefore}
      <Link to={ROUTES.faq}>{messages.home.faqHintLink}</Link>
      {messages.home.faqHintAfter}
    </p>
  );
}

export function Home() {
  return (
    <DemoDrop
      openAnalyzerOnDrop
      showSavedNotes={false}
      beside={<CreatePlaybookCard />}
      below={<HomeFaqHint />}
    >
      <HomeIntro />
    </DemoDrop>
  );
}
