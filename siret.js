const Siret = {

cache:{},

async enrichAll(rows){
  for(const r of rows){

    let company = r.cleaned[CONFIG.COLUMNS.company];

    if(this.cache[company]){
      Object.assign(r.cleaned, this.cache[company]);
      continue;
    }

    if(r.cleaned[CONFIG.COLUMNS.siret] !== '[À enrichir]') continue;

    let result = await this.fakeApi(company);

    if(result){
      r.cleaned[CONFIG.COLUMNS.siret] = result.siret;
      r.cleaned['Effectif entreprise'] = result.effectif;
      r.cleaned['Code NAF'] = result.naf;
      r.cleaned['Libellé NAF'] = result.nafLib;
      r.cleaned['Nom commercial'] = result.nomCommercial;

      this.cache[company] = {
        'SIRET entreprise': result.siret,
        'Effectif entreprise': result.effectif,
        'Code NAF': result.naf,
        'Libellé NAF': result.nafLib,
        'Nom commercial': result.nomCommercial
      };
    }
  }
},

async fakeApi(name){
  return {
    siret: "12345678901234",
    effectif: "10-19",
    naf: "6201Z",
    nafLib: "Programmation informatique",
    nomCommercial: name
  };
}

};
