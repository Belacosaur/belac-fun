import { useState, type ReactNode } from "react";
import { Link, Route, Routes } from "react-router";
import { AdminNav, AuditAdmin, ChallengeAdmin, EpisodeAdmin, PreviewForm, PriceAdmin, SettingsAdmin, SocialAdmin } from "./admin-screens";
import { copy } from "./copy";
import { AdminOverview, ChallengePage, defaultClient, EpisodePage, EpisodesPage, HomePage, LeaderboardPage, StatusPage } from "./pages";
import type { Client } from "./api";

function AdminPage({
  actor,
  title,
  children,
}: {
  actor: { role: string } | null;
  title: string;
  children?: ReactNode;
}) {
  if (!actor) {
    return (
      <Page title="Admin">
        <p>{copy.signIn}</p>
      </Page>
    );
  }
  return (
    <Page title={title}>
      <AdminNav />
      {children}
    </Page>
  );
}

function Page({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <>
      <h1>{title}</h1>
      {children}
    </>
  );
}

export function App({ client = defaultClient, actor = null }: { client?: Client; actor?: { role: string } | null }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <>
      <a className="tap-target" href="#content">
        Skip to content
      </a>
      <header>
        <p>Belac.fun</p>
        <button type="button" className="tap-target menu-button" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
          Menu
        </button>
        <nav className={menuOpen ? "site-nav open" : "site-nav"}>
          <Link className="tap-target" to="/challenge">
            Overview
          </Link>
          <Link className="tap-target" to="/leaderboard">
            Leaderboard
          </Link>
          <Link className="tap-target" to="/episodes">
            Episodes
          </Link>
          <Link className="tap-target" to="/methodology">
            Methodology
          </Link>
          <Link className="tap-target" to="/about">
            About
          </Link>
        </nav>
      </header>
      <main id="content" style={{ maxWidth: 1280 }}>
        <Routes>
          <Route path="/" element={<HomePage client={client} />} />
          <Route path="/challenge" element={<LeaderboardPage client={client} title="Challenge" />} />
          <Route path="/challenge/:slug" element={<ChallengePage client={client} />} />
          <Route path="/leaderboard" element={<LeaderboardPage client={client} />} />
          <Route path="/episodes" element={<EpisodesPage client={client} />} />
          <Route path="/episodes/:slug" element={<EpisodePage client={client} />} />
          <Route
            path="/methodology"
            element={
              <Page title="Methodology">
                <p>method version v1</p>
                <p>Net return is ending equity minus starting equity minus external contributions.</p>
                <p>This is not financial advice.</p>
              </Page>
            }
          />
          <Route
            path="/about"
            element={
              <Page title="About">
                <p>Belac.fun publishes the record of one trading experiment. It is not a fund, an exchange, or financial advice.</p>
              </Page>
            }
          />
          <Route path="/status" element={<StatusPage client={client} />} />
          <Route
            path="/privacy"
            element={
              <Page title="Privacy">
                <p>No account required.</p>
              </Page>
            }
          />
          <Route
            path="/terms"
            element={
              <Page title="Terms">
                <p>Figures describe the experiment. They are not an offer, a solicitation, or financial advice.</p>
              </Page>
            }
          />
          <Route path="/admin" element={<AdminPage actor={actor} title="Admin" />} />
          <Route path="/admin/overview" element={<AdminPage actor={actor} title="Overview"><AdminOverview client={client} /></AdminPage>} />
          <Route path="/admin/challenges" element={<AdminPage actor={actor} title="Challenges"><ChallengeAdmin client={client} /></AdminPage>} />
          <Route path="/admin/transactions" element={<AdminPage actor={actor} title="Transactions"><PreviewForm client={client} /></AdminPage>} />
          <Route path="/admin/prices" element={<AdminPage actor={actor} title="Prices"><PriceAdmin /></AdminPage>} />
          <Route path="/admin/episodes" element={<AdminPage actor={actor} title="Episodes"><EpisodeAdmin client={client} /></AdminPage>} />
          <Route
            path="/admin/media"
            element={
              <AdminPage actor={actor} title="Media">
                <p>Uploads are unavailable.</p>
              </AdminPage>
            }
          />
          <Route path="/admin/social" element={<AdminPage actor={actor} title="Social"><SocialAdmin client={client} /></AdminPage>} />
          <Route path="/admin/audit" element={<AdminPage actor={actor} title="Audit"><AuditAdmin client={client} /></AdminPage>} />
          <Route path="/admin/settings" element={<AdminPage actor={actor} title="Settings"><SettingsAdmin client={client} /></AdminPage>} />
        </Routes>
      </main>
      <footer>
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
      </footer>
    </>
  );
}
