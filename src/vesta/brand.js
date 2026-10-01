// vesta recon: the parts of the brand a template cannot hold. The "‹ vesta"
// link goes to the landing page: this host without the globe's port.

/**
 * @param {{ documentRef?: Document, locationRef?: Location }} [options]
 */
export function mountVestaBrand({
  documentRef = document,
  locationRef = location,
} = {}) {
  const home = `${locationRef.protocol}//${locationRef.hostname}/`;
  for (const link of documentRef.querySelectorAll('a.vesta-home'))
    link.href = home;
  return home;
}
