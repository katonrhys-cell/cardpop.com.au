// How an article came to be, said once and shown everywhere the article is.
//
// blog_articles.auto_generated marks the drafts the nightly generator wrote
// (src/utils/blogArticleGenerator.js). Google's guidance on AI-assisted content
// is that it is fine when it is accurate and useful and that readers should be
// able to tell how it was made; an ad-network review treats undisclosed
// machine-written pages as a thin-content risk. Every price in such a draft is
// checked against a real snapshot by blogStyleGuard, and drafts are published
// by a person (BLOG_AUTOPUBLISH is off), so this note is a true statement of
// the process. Rendered by the article page and by api/prerender.js —
// dependency-free so both can import it.
export const AI_ASSISTED_DISCLOSURE =
  'How this article was produced: drafted with AI assistance from CardPop’s own Australian market price snapshots — every dollar figure traces to a recorded sale — then checked and published by the CardPop team.';

export const articleDisclosure = (article) => (article?.auto_generated ? AI_ASSISTED_DISCLOSURE : null);
