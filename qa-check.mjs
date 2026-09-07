export default async function run(page, ui) {
  await page.waitForTimeout(6000); // allow API fetches to settle
  const result = await page.evaluate(() => {
    const galleries = ['animals', 'trees', 'flowers'].map(c => ({
      c, count: document.getElementById('gallery-' + c)?.children.length,
    }));
    const imgs = [...document.querySelectorAll('.card-img-wrapper img, .card-img-wrapper video, .card-img-wrapper iframe')].slice(0, 12).map(m => ({
      tag: m.tagName, src: (m.currentSrc || m.src || '').slice(0, 110),
      ok: m.tagName === 'IMG' ? (m.complete && m.naturalWidth > 0) : true,
    }));
    const counts = ['animals', 'trees', 'flowers'].map(c => document.getElementById('count-' + c)?.textContent);
    return { galleries, counts, imgCount: document.querySelectorAll('.nature-card').length, imgs };
  });
  return result;
}
