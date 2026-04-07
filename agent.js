const Agent = {
  processAll(rows){
    const results = rows.map((row, i)=>{
      let cleaned = {...row};

      let siret = (cleaned[CONFIG.COLUMNS.siret] || '').replace(/\s/g,'');

      if(!(siret.length===14 && /^\d+$/.test(siret))){
        cleaned[CONFIG.COLUMNS.siret] = '[À enrichir]';
      }

      return {cleaned, index:i};
    });

    return {results};
  }
};
