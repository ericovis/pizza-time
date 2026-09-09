import { REPO_URL } from '../lib/config'
import '../styles/pages/about.css'

/** The ABOUT screen: what this app is, and where its API lives. */
export function About() {
  return (
    <main className="page page--prose">
      <p className="pill">About</p>
      <h1 className="display display--sm about-heading">
        The most different pizza you will ever <span className="about-accent">try.</span>
      </h1>
      <p className="prose">
        Pizza Time is a small pizza-ordering app that started life as the workload for a
        Cloud Academy course. Some of its hiccups were built in on purpose: they were the
        bugs fixed live, step by step, during the lessons. That course is long gone. This
        fork was cleaned up and modernized, and is now a general-purpose demo app.
      </p>
      <p className="prose">
        Every pizza is cut into eight slices, and every slice can be its own flavor — so a
        table that can't agree doesn't have to. Custom pies are priced at the
        most expensive flavor on them, and delivery is a flat $5.
      </p>
      <div className="about-cards">
        <div className="about-card">
          <p className="about-card-label">Stack</p>
          <p>React 19 · Vite · TypeScript in front; Python 3.12 · Django 5.2 · Django REST Framework · PostgreSQL behind. Everything runs under Docker Compose.</p>
        </div>
        <div className="about-card">
          <p className="about-card-label">API</p>
          <p>JWT auth at /api/auth/ · catalog at /api/pizzas/get/ · orders at /api/orders/get/ and /api/orders/new/</p>
        </div>
        <div className="about-card">
          <p className="about-card-label">Two services</p>
          <p>The API and this frontend are separate containers; the frontend reads its API base URL at start-up from the environment.</p>
        </div>
        <div className="about-card">
          <p className="about-card-label">Source</p>
          <p>
            The whole thing is open on GitHub:{' '}
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">ericovis/pizza-time</a>
          </p>
        </div>
      </div>
    </main>
  )
}

export default About
