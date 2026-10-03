// vesta recon: the parts of the brand a template cannot hold. The "‹ vesta"
// link goes to the landing page: this host without the globe's port. An
// instance with a name (VITE_VESTA_ENV, "staging" on the staging instance)
// says so beside the wordmark and in the tab, as vesta-voice and the harness do.

/**
 * @param {{ documentRef?: Document, locationRef?: Location, env?: string }} [options]
 * @returns {string} the home link
 */
export function mountVestaBrand({
  documentRef = document,
  locationRef = location,
  env = '',
} = {}) {
  const home = `${locationRef.protocol}//${locationRef.hostname}/`;
  for (const link of documentRef.querySelectorAll('a.vesta-home'))
    link.href = home;
  const tag = typeof env === 'string' ? env.trim() : '';
  if (tag) {
    documentRef.title = `${documentRef.title} · ${tag}`;
    documentRef.documentElement.dataset.vestaEnv = tag;
    for (const mark of documentRef.querySelectorAll('.vesta-wordmark')) {
      if (mark.querySelector('.vesta-env')) continue;
      const badge = documentRef.createElement('span');
      badge.className = 'vesta-env';
      badge.textContent = tag;
      mark.insertBefore(badge, mark.querySelector('.vesta-caret'));
    }
  }
  return home;
}
