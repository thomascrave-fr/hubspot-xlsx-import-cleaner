// ============================================================
//  SIRET.JS — Enrichissement SIRET via API Sirene (gouv.fr)
//  Appels effectués depuis le navigateur, aucune clé requise.
// ============================================================

const Siret = {

  DELAY_MS: 150, // délai entre requêtes pour ne pas surcharger l'API

  // ----------------------------------------------------------
  //  RECHERCHE D'UN SIRET pour une ligne donnée
  // ----------------------------------------------------------
  async search(row) {
    const cols = CONFIG.COLUMNS;
    const nom    = (row[cols.company] || '').trim();
    const cp     = (row[cols.zip] || '').trim();
    const ville  = (row[cols.city] || '').trim();
    const adresse = (row[cols.address] || '').trim();

    if (!nom && !adresse) return { siret: null, score: 0, source: 'données insuffisantes' };

    // Construction de la requête : nom + ville pour meilleure précision
    const q = [nom, ville].filter(Boolean).join(' ');
    const params = new URLSearchParams({ q, per_page: '3' });
    if (cp) params.set('code_postal', cp);

    const url = 'https://recherche-entreprises.api.gouv.fr/search?' + params.toString();

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();

      if (!json.results || json.results.length === 0) {
        return { siret: null, score: 0, source: 'non trouvé' };
      }

      const top = json.results[0];
      const siret = top.siege?.siret
        || top.matching_etablissements?.[0]?.siret
        || null;
      const score = Math.round((top.score || 0) * 100);
      const nomLegal = top.nom_complet || '';

      return { siret, score, nomLegal, source: 'API Sirene' };
    } catch (e) {
      return { siret: null, score: 0, source: 'erreur : ' + e.message };
    }
  },

  // ----------------------------------------------------------
  //  ENRICHISSEMENT EN MASSE avec callbacks de progression
  // ----------------------------------------------------------
  async enrichAll(rows, { onProgress, onResult, shouldStop }) {
    const toEnrich = rows.filter(r => r.cleaned[CONFIG.COLUMNS.siret] === '[À enrichir]');
    let done = 0;

    for (const row of toEnrich) {
      if (shouldStop && shouldStop()) break;

      const result = await Siret.search(row.cleaned);
      row.siretResult = result;

      if (result.siret) {
        row.cleaned[CONFIG.COLUMNS.siret] = result.siret;
      }

      done++;
      if (onProgress) onProgress(done, toEnrich.length, row, result);
      if (onResult) onResult(row, result);

      await new Promise(r => setTimeout(r, Siret.DELAY_MS));
    }

    return rows;
  },
};
